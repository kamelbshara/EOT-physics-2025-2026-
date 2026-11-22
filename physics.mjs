import { fieldsFor, coach, unpack } from './lib/coach.mjs'
import { grade, rubricFor } from './lib/grader.mjs'
import { platformApi } from './lib/platform.mjs'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const bank = new DatabaseSync(new URL('./bank/physics.sqlite', import.meta.url), { readOnly: true })
const feedbackEn = JSON.parse(readFileSync(new URL('./bank/feedback-en.json', import.meta.url), 'utf8'))
const cards = bank.prepare(`SELECT l.id,l.grade,l.exam_slot slot,l.outcomes_en en,
 json_extract(l.data_json,'$.summary_ar') ar, json_extract(l.data_json,'$.type') examType,
 json_extract(l.data_json,'$.book_pages_reference') bookPages, count(q.id) total
 FROM learning_outcomes l JOIN questions q ON q.lo_id=l.id AND q.kind=json_extract(l.data_json,'$.type') GROUP BY l.id ORDER BY l.grade,l.exam_slot`).all()
const byId = bank.prepare('SELECT data_json FROM questions WHERE id=? UNION ALL SELECT data_json FROM previous_questions WHERE id=?')
const retired = new Set(bank.prepare('SELECT id FROM previous_questions').all().map(row=>row.id))
const movedWithoutEdits = new Map(bank.prepare(`SELECT p.id,p.replacement FROM previous_questions p
 JOIN questions q ON q.id=p.replacement
 WHERE q.kind=json_extract(p.data_json,'$.kind') AND q.question_en=json_extract(p.data_json,'$.question_en')
 AND q.question_ar=json_extract(p.data_json,'$.question_ar') AND q.answer=json_extract(p.data_json,'$.answer')
 AND json_extract(q.data_json,'$.options')=json_extract(p.data_json,'$.options')`).all().map(r=>[r.id,r.replacement]))
const cardQuestions = bank.prepare(`SELECT q.data_json FROM questions q JOIN learning_outcomes l ON l.id=q.lo_id
 WHERE l.id=? AND q.kind=json_extract(l.data_json,'$.type')
 ORDER BY coalesce(json_extract(q.data_json,'$.base_id'),q.id)`)
const imageById = bank.prepare('SELECT path FROM images WHERE id=?')
const question = id => JSON.parse(byId.get(id,id)?.data_json ?? 'null')
const pictures = (q, role) => q.images.filter(i => i.role === role).map(i => i.asset_id)
const figureLabels=new Map(bank.prepare(`SELECT i.id,i.page,s.name,
 json_extract(i.data_json,'$.display_en') en,json_extract(i.data_json,'$.display_ar') ar
 FROM images i JOIN sources s ON s.id=i.source_id`).all().map(({id,...label})=>[id,label]))
function figureNotes(q,role){
 return Object.fromEntries(pictures(q,role).map(id=>[id,figureLabels.get(id)]))
}
// Start with the existing core item, then rotate between illustrated and text questions.
function practiceOrder(rows){
 const [first,...rest]=rows
 if(!first)return []
 const result=[first]
 const variant=rest.findIndex(q=>q.origin==='original_practice_variant')
 if(variant>=0)result.push(...rest.splice(variant,1))
 const groups=new Map()
 for(const q of rest){
  const type=q.kind+(q.has_question_image?'-figure':'-text')
  if(!groups.has(type))groups.set(type,[])
  groups.get(type).push(q)
 }
 for(let i=0;result.length<rows.length;i++){
  for(const group of groups.values())if(group[i])result.push(group[i])
 }
 return result
}
// Only questions solved with a calculator show the calculator guide:
// written answers whose rubric has a numerical result, and multiple choice with mostly numerical options and given data.
const calcCache=new Map()
function needsCalculator(q){
  if(calcCache.has(q.id))return calcCache.get(q.id)
  let calc
  if(q.kind==='FRQ')calc=rubricFor(q).numbers.some(n=>n.value!==0)
  else{
    const numeric=(q.options||[]).filter(o=>/\d/.test(o.en)&&!/^[A-D]$/.test(o.en.trim())).length
    const data=/\d/.test(q.question_en.replace(/\b(?:Figure|Fig\.|Table|Row)\s*\d+/gi,''))||(q.images||[]).some(i=>i.role==='question')
    calc=numeric>=Math.max(2,Math.ceil((q.options||[]).length*0.75))&&data
  }
  calcCache.set(q.id,calc)
  return calc
}
function prompt(q,allowGap=true) {
  return { id:q.id, calc:needsCalculator(q), lo:q.lo_id, kind:q.kind, ar:q.question_ar, en:q.question_en, options:q.options, fields:q.kind==='FRQ'?fieldsFor(q,allowGap):[], images:pictures(q,'question'), figureNotes:figureNotes(q,'question'), stimulus:q.stimulus }
}
function solution(q, response) {
  const selected = q.options.find(o => o.key === response)
  const correct = q.options.find(o => o.key === q.answer)
  let advice = q.misconception_ar || ''
  let adviceEn = feedbackEn[q.id] || (q.kind===q.original_kind && !q.revised_content ? feedbackEn[q.base_id] : '') || ''
  if (selected && correct && response !== q.answer) {
    const value = s => Number(s.replace(/−/g,'-').match(/^[+\-]?\d+(?:\.\d+)?/)?.[0] ?? NaN)
    const a = value(selected.en), b = value(correct.en)
    if (a === -b && a !== 0) {
      adviceEn = 'The magnitude agrees. Check your positive direction and sign convention.'
      advice = 'المقدار متساوٍ لكن الإشارة مختلفة. راجع الاتجاه الموجب واتفاقية الإشارات.'
    } else if (Number.isFinite(a) && Number.isFinite(b) && a*b > 0 && [3,6,9].some(n=>Math.abs(Math.abs(Math.log10(a/b))-n)<0.0001)) {
      adviceEn = 'Check the unit prefixes and write the conversion factor before substituting.'
      advice = 'راجع بادئات الوحدات واكتب عامل التحويل قبل التعويض.'
    }
  }
  return { correct:correct?.key, ar:q.solution_ar, en:q.solution_en, advice, adviceEn, coach:q.kind==='FRQ'?coach(q,response):null, grade:q.kind==='FRQ'&&response?grade(q,unpack(response)):null, images:pictures(q,'solution'), figureNotes:figureNotes(q,'solution') }
}

// db is the asynchronous adapter from lib/db.mjs (Neon Postgres or SQLite); the question bank stays a read-only SQLite file.
export function physicsApi(db) {
  const studyView=db.prepare('SELECT 1 AS x FROM physics_study_views WHERE student=? AND question=?')
  const activeVisit=db.prepare('SELECT 1 AS x FROM physics_visits WHERE student=? AND expires>?')
  const profile = db.prepare('SELECT name,school,started AS "startedAt",code,class_code AS "classCode" FROM physics_profiles WHERE student=?')
  const progress = db.prepare('SELECT question,response,checked FROM physics_progress WHERE student=?')
  const write = db.prepare('INSERT INTO physics_progress(student,question,response,checked) VALUES(?,?,?,?) ON CONFLICT(student,question) DO UPDATE SET response=excluded.response,checked=excluded.checked')
  const copyProgress=db.prepare('INSERT INTO physics_progress(student,question,response,checked) VALUES(?,?,?,?) ON CONFLICT(student,question) DO NOTHING')
  async function studentProgress(student){
    const rows=await progress.all(student)
    const ids=new Set(rows.map(r=>r.question))
    for(const r of rows.slice()){
      const replacement=movedWithoutEdits.get(r.question)
      if(!replacement || ids.has(replacement))continue
      await copyProgress.run(student,replacement,r.response,r.checked)
      rows.push({...r,question:replacement})
    }
    return rows.map(r=>({...r,lo:retired.has(r.question)?null:question(r.question)?.lo_id}))
  }
  const getMock = db.prepare(`SELECT * FROM physics_mocks WHERE student=? ORDER BY ${db.seq} DESC LIMIT 1`)
  async function mockView(row) {
    if (!row) return null
    if (!row.done && Date.now() >= row.deadline) {
      await db.prepare('UPDATE physics_mocks SET done=1 WHERE id=?').run(row.id)
      row.done=1
      await platform.logMock(row.student,row)
    }
    const answers=JSON.parse(row.answers)
    return { id:row.id,grade:row.grade,title:row.title||null,testId:row.test_id||null,answers,deadline:row.deadline,done:Boolean(row.done),
      questions:JSON.parse(row.ids).map(id=>{const q=question(id);return {...prompt(q,false),...(row.done ? {review:solution(q,answers[id])} : {})}}) }
  }
  async function createMock(student,gradeNumber,ids,title=null,testId=null){
    const minutes=ids.reduce((n,id)=>n+(bank.prepare('SELECT estimated_minutes m FROM questions WHERE id=?').get(id)?.m||2),0)
    await db.prepare('INSERT INTO physics_mocks(id,student,grade,ids,answers,deadline,done,test_id,title) VALUES(?,?,?,?,?,?,0,?,?)').run(randomUUID(),student,gradeNumber,JSON.stringify(ids),'{}',Date.now()+60000*minutes,testId,title)
    return mockView(await getMock.get(student))
  }
  const isActive=async student=>Boolean(await activeVisit.get(student,Date.now()) && (await profile.get(student))?.school)
  const platform=platformApi(db,{bank,cards,question,prompt,solution,validAnswer,studentProgress,mockView,getMock,createMock,isActive,profile,write,readBank:file=>readFileSync(new URL('./bank/'+file,import.meta.url))})
  return async function(path,req,res,student,reply,readBody,session={}) {
    await platform.ready
    if (path === '/api/catalog' && req.method==='GET') return reply(200,{cards,profile:await activeVisit.get(student, Date.now()) ? await profile.get(student) : null})
    let body={}
    if (req.method==='POST') {
      try {body=await readBody(req); if (!body || typeof body!=='object') throw Error()} catch {return reply(400,{error:'طلب غير صالح'})}
    }
    if(path==='/api/profile' && req.method==='POST'){
      const name=typeof body.name==='string' ? body.name.trim() : ''
      const school=typeof body.school==='string' ? body.school.trim() : ''
      const classCode=typeof body.classCode==='string' ? body.classCode.trim().toUpperCase() : ''
      if(name.length<2 || name.length>80 || school.length<2 || school.length>120)return reply(400,{error:'تحقق من اسم الطالب والمدرسة'})
      const existing=await db.prepare('SELECT code FROM physics_profiles WHERE student=?').get(student)
      if(classCode && !await db.prepare('SELECT 1 AS x FROM physics_classes WHERE code=?').get(classCode))return reply(400,{error:'رمز الصف غير صحيح'})
      await db.prepare('INSERT INTO physics_profiles(student,name,started,school) VALUES(?,?,?,?) ON CONFLICT(student) DO UPDATE SET name=excluded.name,school=excluded.school').run(student,name,new Date().toISOString(),school)
      if(classCode)await db.prepare('UPDATE physics_profiles SET class_code=? WHERE student=?').run(classCode,student)
      if(!existing?.code){
        let code
        do code=String(100000+Math.floor(Math.random()*900000)); while(await db.prepare('SELECT 1 AS x FROM physics_profiles WHERE code=?').get(code))
        await db.prepare('UPDATE physics_profiles SET code=? WHERE student=?').run(code,student)
      }
      await db.prepare('INSERT INTO physics_visits(student,expires) VALUES(?,?) ON CONFLICT(student) DO UPDATE SET expires=excluded.expires').run(student,Date.now()+86400000)
      return reply(200,await profile.get(student))
    }
    await platform(path,req,res,student,reply,body,session)
    if(res.headersSent)return
    if(!await isActive(student)) return reply(403,{error:'انتهت جلسة التدريب. حدّث الصفحة وسجّل الدخول للمتابعة.'})
    if(req.method==='GET'){
      if(path==='/api/progress') return reply(200,await studentProgress(student))
      if(path==='/api/mock') return reply(200,await mockView(await getMock.get(student)))
      if(path.startsWith('/api/card/')){
        return reply(200,practiceOrder(cardQuestions.all(path.slice(10)).map(r=>JSON.parse(r.data_json))).map(q=>prompt(q)))
      }
      if(path.startsWith('/api/figure/')){
        const [, , ,id,role,index]=path.split('/')
        const q=question(id)
        const mock=await getMock.get(student)
        const reviewed=role==='solution' && ((await db.prepare('SELECT checked FROM physics_progress WHERE student=? AND question=?').get(student,id))?.checked || await studyView.get(student,id) || (mock?.done && JSON.parse(mock.ids).includes(id)))
        const asset=q && (role==='question'||reviewed) && pictures(q,role)[Number(index)]
        if(!asset)return reply(404,{error:'الصورة غير متاحة'})
        const file=imageById.get(asset).path
        res.writeHead(200,{'Content-Type':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'private,no-store'})
        return res.end(readFileSync(new URL('./bank/'+file,import.meta.url)))
      }
    }
    if(req.method==='POST' && path==='/api/mock/new' && [9,10,11,12].includes(body.grade)){
      const previous=await mockView(await getMock.get(student))
      if(previous && !previous.done) return reply(409,{error:'أكمل الاختبار الحالي أولاً'})
      const pick=bank.prepare(`SELECT id,estimated_minutes FROM questions WHERE lo_id=? AND kind=? ORDER BY random() LIMIT 1`)
      const rows=cards.filter(c=>c.grade===body.grade).map(c=>pick.get(c.id,c.examType))
      const deadline=Date.now()+60000*rows.reduce((n,r)=>n+r.estimated_minutes,0)
      await db.prepare('INSERT INTO physics_mocks(id,student,grade,ids,answers,deadline,done) VALUES(?,?,?,?,?,?,0)').run(randomUUID(),student,body.grade,JSON.stringify(rows.map(r=>r.id)),'{}',deadline)
      return reply(201,await mockView(await getMock.get(student)))
    }
    if(req.method==='POST' && ['/api/mock/answer','/api/mock/finish'].includes(path)){
      const row=await getMock.get(student)
      if(!row || row.id!==body.mock)return reply(409,{error:'تحقق من جلسة الاختبار'})
      if(!(await mockView(row)).done){
        if(path.endsWith('finish')){await db.prepare('UPDATE physics_mocks SET done=1 WHERE id=?').run(row.id);await platform.logMock(student,await getMock.get(student))}
        else {
          if(!JSON.parse(row.ids).includes(body.id)||!validAnswer(question(body.id),body.response))return reply(400,{error:'إجابة غير صالحة'})
          const a=JSON.parse(row.answers);a[body.id]=body.response
          await db.prepare('UPDATE physics_mocks SET answers=? WHERE id=?').run(JSON.stringify(a),row.id)
        }
      }
      return reply(200,await mockView(await getMock.get(student)))
    }
    // Reset (teacher request 2026-11-22): the student starts the questions again. Saved answers move to an archive the
    // teacher can still read; attempts, mastery, streak, points and badges stay, because they are the student's record.
    if(path==='/api/reset' && req.method==='POST'){
      const now=Date.now()
      await db.prepare('INSERT INTO physics_progress_archive(student,question,response,checked,reset_at) SELECT student,question,response,checked,? FROM physics_progress WHERE student=?').run(now,student)
      const cleared=(await db.prepare('DELETE FROM physics_progress WHERE student=?').run(student)).changes
      await db.prepare('DELETE FROM physics_study_views WHERE student=?').run(student)
      return reply(200,{cleared})
    }
    if(path==='/api/walkthrough' && req.method==='POST'){
      const q=typeof body.id==='string' && question(body.id)
      if(!q)return reply(404,{error:'غير متاح'})
      await db.prepare('INSERT INTO physics_study_views(student,question) VALUES(?,?) ON CONFLICT(student,question) DO NOTHING').run(student,q.id)
      return reply(200,await platform.withTeacher(student,q.id,solution(q,'')))
    }
    if(path==='/api/record' && req.method==='POST'){
      const q=typeof body.id==='string' && question(body.id)
      if(!q || !validAnswer(q,body.response) || (body.check && !body.response.trim()))return reply(400,{error:'أدخل إجابتك أولاً'})
      await write.run(student,q.id,body.response,body.check?1:0)
      if(!body.check)return reply(200,{saved:true})
      const result=solution(q,body.response)
      await platform.logAttempt(student,q,body.response,result)
      return reply(200,await platform.withTeacher(student,q.id,result))
    }
    return reply(404,{error:'غير متاح'})
  }
}
function validAnswer(q,value){return typeof value==='string' && value.length<=2500 && (q.kind==='FRQ' || q.options.some(o=>o.key===value))}

