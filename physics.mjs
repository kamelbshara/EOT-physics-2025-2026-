import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const bank = new DatabaseSync(new URL('./bank/physics.sqlite', import.meta.url), { readOnly: true })
const cards = bank.prepare(`SELECT l.id,l.grade,l.exam_slot slot,l.outcomes_en en,
 json_extract(l.data_json,'$.summary_ar') ar, count(q.id) total
 FROM learning_outcomes l JOIN questions q ON q.lo_id=l.id GROUP BY l.id ORDER BY l.grade,l.exam_slot`).all()
const byId = bank.prepare('SELECT data_json FROM questions WHERE id=?')
const imageById = bank.prepare('SELECT path FROM images WHERE id=?')
const question = id => JSON.parse(byId.get(id)?.data_json ?? 'null')
const pictures = (q, role) => q.images.filter(i => i.role === role).map(i => i.asset_id)
function prompt(q) {
  return { id:q.id, lo:q.lo_id, kind:q.kind, ar:q.question_ar, en:q.question_en, options:q.options, images:pictures(q,'question') }
}
function solution(q, response) {
  const selected = q.options.find(o => o.key === response)
  const correct = q.options.find(o => o.key === q.answer)
  let advice = q.misconception_ar || ''
  if (selected && correct && response !== q.answer) {
    const value = s => Number(s.replace(/−/g,'-').match(/^[+\-]?\d+(?:\.\d+)?/)?.[0] ?? NaN)
    const a = value(selected.en), b = value(correct.en)
    if (a === -b && a !== 0) advice = 'المقدار متساوٍ لكن الإشارة مختلفة. راجع الاتجاه الموجب واتفاقية الإشارات.'
    else if (Number.isFinite(a) && Number.isFinite(b) && a*b > 0 && [3,6,9].some(n=>Math.abs(Math.abs(Math.log10(a/b))-n)<0.0001)) advice = 'راجع بادئات الوحدات واكتب عامل التحويل قبل التعويض.'
  }
  return { correct:correct?.key, ar:q.solution_ar, en:q.solution_en, advice, images:pictures(q,'solution') }
}

export function physicsApi(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS physics_profiles(student TEXT PRIMARY KEY,name TEXT NOT NULL,started TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS physics_progress(student TEXT, question TEXT, response TEXT, checked INTEGER, PRIMARY KEY(student,question));
    CREATE TABLE IF NOT EXISTS physics_mocks(id TEXT PRIMARY KEY,student TEXT,grade INTEGER,ids TEXT,answers TEXT,deadline INTEGER,done INTEGER);`)
  const profile = db.prepare('SELECT name,started AS startedAt FROM physics_profiles WHERE student=?')
  const progress = db.prepare('SELECT question,response,checked FROM physics_progress WHERE student=?')
  const write = db.prepare('INSERT INTO physics_progress VALUES(?,?,?,?) ON CONFLICT(student,question) DO UPDATE SET response=excluded.response,checked=excluded.checked')
  const getMock = db.prepare('SELECT * FROM physics_mocks WHERE student=? ORDER BY rowid DESC LIMIT 1')
  function mockView(row) {
    if (!row) return null
    if (!row.done && Date.now() >= row.deadline) {
      db.prepare('UPDATE physics_mocks SET done=1 WHERE id=?').run(row.id)
      row.done=1
    }
    const answers=JSON.parse(row.answers)
    return { id:row.id,grade:row.grade,answers,deadline:row.deadline,done:Boolean(row.done),
      questions:JSON.parse(row.ids).map(id=>{const q=question(id);return {...prompt(q),...(row.done ? {review:solution(q,answers[id])} : {})}}) }
  }
  return async function(path,req,res,student,reply,readBody) {
    if (path === '/api/catalog' && req.method==='GET') return reply(200,{cards,profile:profile.get(student) ?? null})
    let body={}
    if (req.method==='POST') {
      try {body=await readBody(req); if (!body || typeof body!=='object') throw Error()} catch {return reply(400,{error:'طلب غير صالح'})}
    }
    if(path==='/api/profile' && req.method==='POST' && typeof body.name==='string' && body.name.trim().length>=2 && body.name.length<=80){
      db.prepare('INSERT INTO physics_profiles VALUES(?,?,?) ON CONFLICT(student) DO UPDATE SET name=excluded.name').run(student,body.name.trim(),new Date().toISOString())
      return reply(200,profile.get(student))
    }
    if(!profile.get(student)) return reply(403,{error:'أدخل اسمك لبدء التدريب'})
    if(req.method==='GET'){
      if(path==='/api/progress') return reply(200,progress.all(student).map(r=>({...r,lo:question(r.question).lo_id})))
      if(path==='/api/mock') return reply(200,mockView(getMock.get(student)))
      if(path.startsWith('/api/card/')){
        return reply(200,bank.prepare('SELECT data_json FROM questions WHERE lo_id=? ORDER BY id').all(path.slice(10)).map(r=>prompt(JSON.parse(r.data_json))))
      }
      if(path.startsWith('/api/figure/')){
        const [, , ,id,role,index]=path.split('/')
        const q=question(id)
        const mock=getMock.get(student)
        const reviewed=role==='solution' && (db.prepare('SELECT checked FROM physics_progress WHERE student=? AND question=?').get(student,id)?.checked || (mock?.done && JSON.parse(mock.ids).includes(id)))
        const asset=q && (role==='question'||reviewed) && pictures(q,role)[Number(index)]
        if(!asset)return reply(404,{error:'الصورة غير متاحة'})
        const file=imageById.get(asset).path
        res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'private,no-store'})
        return res.end(readFileSync(new URL('./bank/'+file,import.meta.url)))
      }
    }
    if(req.method==='POST' && path==='/api/mock/new' && [9,10,11,12].includes(body.grade)){
      const previous=mockView(getMock.get(student))
      if(previous && !previous.done) return reply(409,{error:'أكمل الاختبار الحالي أولاً'})
      const pick=bank.prepare(`SELECT id,estimated_minutes FROM questions WHERE lo_id=? ORDER BY (kind=?) DESC,random() LIMIT 1`)
      const rows=cards.filter(c=>c.grade===body.grade).map(c=>pick.get(c.id,c.slot<=16?'MCQ':'FRQ'))
      const deadline=Date.now()+60000*rows.reduce((n,r)=>n+r.estimated_minutes,0)
      db.prepare('INSERT INTO physics_mocks VALUES(?,?,?,?,?,?,0)').run(randomUUID(),student,body.grade,JSON.stringify(rows.map(r=>r.id)),'{}',deadline)
      return reply(201,mockView(getMock.get(student)))
    }
    if(req.method==='POST' && ['/api/mock/answer','/api/mock/finish'].includes(path)){
      const row=getMock.get(student)
      if(!row || row.id!==body.mock)return reply(409,{error:'تحقق من جلسة الاختبار'})
      if(!mockView(row).done){
        if(path.endsWith('finish'))db.prepare('UPDATE physics_mocks SET done=1 WHERE id=?').run(row.id)
        else {
          if(!JSON.parse(row.ids).includes(body.id)||!validAnswer(question(body.id),body.response))return reply(400,{error:'إجابة غير صالحة'})
          const a=JSON.parse(row.answers);a[body.id]=body.response
          db.prepare('UPDATE physics_mocks SET answers=? WHERE id=?').run(JSON.stringify(a),row.id)
        }
      }
      return reply(200,mockView(getMock.get(student)))
    }
    if(path==='/api/record' && req.method==='POST'){
      const q=typeof body.id==='string' && question(body.id)
      if(!q || !validAnswer(q,body.response) || (body.check && !body.response.trim()))return reply(400,{error:'أدخل إجابتك أولاً'})
      write.run(student,q.id,body.response,body.check?1:0)
      return reply(200,body.check?solution(q,body.response):{saved:true})
    }
    return reply(404,{error:'غير متاح'})
  }
}
function validAnswer(q,value){return typeof value==='string' && value.length<=2500 && (q.kind==='FRQ' || q.options.some(o=>o.key===value))}
