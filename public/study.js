import {figures,measurements,writePhysicsText} from './question-paper.js'
import { makeLawCard, makeExample } from './notebook.js'
import { writtenEditor, hasResponse, parseDraft } from './math-input.js'
import {bookUrl} from './textbook/grade-10.js'
import { laws, relevantLaws } from './laws.js'
import { lang, t, changeLanguage, applyLanguage, errorText } from './language.js'
import { englishHint, englishGuides } from './english-support.js'
import { apiOrigin } from './api-config.js'
import { installContentShield } from './content-shield.js'
import { setupFloatingCalculator } from './floating-calculator.js'
import { questionWatermark, watermarkCss } from './watermark.js'
import { support, guides } from './guides.js'
import { renderHub, splitTitle } from './student-hub.js'
import { openNotebook, openNotebookList, openAsk } from './notebook-ui.js'

const $=id=>document.getElementById(id)
function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node}
function button(text,fn){const b=element('button',text);b.onclick=guard(fn);return b}
function guard(fn){return async (...args)=>{try{await fn(...args)}catch(e){($('login').open?$('loginError'):$('notice')).textContent=errorText(e.message)}}}
async function api(path,body){
 const res=await fetch(apiOrigin+'/api/'+path,{credentials:'include',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})
 if(!res.ok)throw Error((await res.json()).error||t('Connection failed.','تعذّر الاتصال'))
 return res.json()
}
let activeTab='practice'
let cards=[],profile,grade=9,current,items=[],index=0,mock=null,inMock=false,cache={},key,queue=Promise.resolve(),replies={},opened=0
const style=element('style',watermarkCss);document.head.append(style)
// dark mode: follows the device unless the student chooses; the page itself stays white in the notebook
function applyTheme(theme){document.documentElement.dataset.theme=theme;$('themeToggle').textContent=theme==='dark'?'☀':'☾'}
let theme='light';try{theme=localStorage.getItem('physics-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch{}
applyTheme(theme)
$('themeToggle').onclick=()=>{theme=theme==='dark'?'light':'dark';applyTheme(theme);try{localStorage.setItem('physics-theme',theme)}catch{}}
setupFloatingCalculator(document, './')
function persist(){try{localStorage.setItem(key,JSON.stringify(cache))}catch{$('notice').textContent=t('Device storage is unavailable. Check your storage settings.','تعذّر الحفظ على الجهاز. تحقق من مساحة التخزين.')}}
async function sync(){
 for(const [id,draft] of Object.entries(cache)){
  if(!draft.pending)continue
  const result=await api('record',{id,response:draft.response,check:draft.checked})
  if(cache[id]===draft){draft.pending=false;if(draft.checked)replies[id]=result;persist()}
 }
}
function mockDrafts(){try{return JSON.parse(localStorage.getItem(key+'-mock')||'{}')}catch{return {}}}
async function syncMock(){
 const saved=mockDrafts()
 if(!mock || !saved[mock.id] || mock.done)return
 for(const [id,response] of Object.entries(saved[mock.id])){
  const latest=await api('mock/answer',{mock:mock.id,id,response})
  const drafts=mockDrafts()
  if(drafts[mock.id]?.[id]===response){delete drafts[mock.id][id];localStorage.setItem(key+'-mock',JSON.stringify(drafts))}
  if(latest.done){mock=latest;if(inMock)openMock();return}
 }
}
function schedule(){queue=queue.catch(()=>{}).then(sync);return queue}
function remember(id,response,checked=false){cache[id]={response,checked,pending:true};persist();delete replies[id]}
async function init(){
 const catalog=await api('catalog');cards=catalog.cards;profile=catalog.profile
 if(!profile?.school){$('name').value=profile?.name||$('name').value; if(!$('login').open)$('login').showModal();return}
 $('accountButton').hidden=false
 sessionStorage.setItem('physics-profile',JSON.stringify(profile))
 key='physics-practice-'+profile.startedAt
 try{cache=JSON.parse(localStorage.getItem(key)||'{}')}catch{cache={}}
 // the server is the record: keep only answers not sent yet (a reset on another device clears the rest)
 cache=Object.fromEntries(Object.entries(cache).filter(([,d])=>d?.pending))
 await schedule()
 for(const r of await api('progress'))cache[r.question]={response:r.response,checked:Boolean(r.checked),lo:r.lo}
 persist();mock=await api('mock');await syncMock();mock=await api('mock');dashboard()
 await openLinkedCard()
}
// Reset: every question appears unsolved again so the student can redo them; mastery, streak, points and badges stay
async function resetPractice(){
 if(!confirm(t('Start the questions again? Your answers will be cleared so every question looks unsolved. Your mastery, streak, points and badges stay.','هل تريد البدء من جديد؟ ستُمسح إجاباتك وتظهر كل الأسئلة غير محلولة لتحلها من الأول. يبقى تقدمك في الإتقان والسلسلة والنقاط والأوسمة.')))return
 await schedule()
 await api('reset',{})
 cache={};replies={};persist()
 dashboard()
}
async function openLinkedCard(){
 if(!profile?.school)return
 const linked=cards.find(c=>location.hash==='#'+c.id)
 if(linked){
  grade=linked.grade
  if(activeTab!=='practice')showTab('practice')
  await openCard(linked)
 }
}
window.addEventListener('hashchange',guard(openLinkedCard))
let loginMode='new'
function setLoginMode(mode){
 loginMode=mode
 $('tabNew').setAttribute('aria-selected',mode==='new');$('tabAccount').setAttribute('aria-selected',mode==='account')
 $('newFields').hidden=mode!=='new';$('accountFields').hidden=mode!=='account';$('loginError').textContent=''
}
$('tabNew').onclick=()=>setLoginMode('new');$('tabAccount').onclick=()=>setLoginMode('account')
$('loginForm').onsubmit=guard(async e=>{
 e.preventDefault()
 if(loginMode==='account'){
  await api('login',{code:$('studentCode').value.trim(),name:$('loginName').value.trim()})
 }else{
  const fresh=!profile?.code
  const saved=await api('profile',{name:$('name').value,school:$('school').value,classCode:$('classCode').value.trim()})
  if(fresh&&saved.code){$('login').close();showAccount(saved,true)}
 }
 if($('login').open)$('login').close()
 await init()
})
function showAccount(p,justCreated=false){
 $('accountCode').textContent=p.code||'—'
 $('accountMeta').textContent=(justCreated?t('Write this code down: you need it with your name to sign in on another device. ','احفظ هذا الرمز: تحتاجه مع اسمك للدخول من جهاز آخر. '):'')+(p.name||'')+(p.classCode?t(' · Class ',' · الصف ')+p.classCode:'')
 $('accountDialog').showModal()
}
$('accountButton').onclick=()=>profile&&showAccount(profile)
$('accountClose').onclick=()=>$('accountDialog').close()
$('logoutButton').onclick=guard(async()=>{await api('logout',{});sessionStorage.removeItem('physics-profile');location.reload()})
$('login').addEventListener('cancel',e=>e.preventDefault())
let exampleRequest=0
let fromExample=false
let practiceScroll=0
let practiceLanguage='en'
let exampleLawReturn=false
function showTab(tab){
 if(activeTab==='practice'&&tab!=='practice'){
  practiceScroll=window.scrollY
  practiceLanguage=lang()
 }
 activeTab=tab
 $('lawsPage').hidden=tab!=='laws'
 $('examplesPage').hidden=tab!=='examples'
 $('dashboard').hidden=tab!=='practice'||Boolean(items.length)
 $('lesson').hidden=tab!=='practice'||!items.length
 $('examplesTab').setAttribute('aria-pressed',tab==='examples')
 $('lawsTab').setAttribute('aria-pressed',tab==='laws')
 $('toExamples').hidden=!fromExample
 if(tab==='laws')renderLaws()
 else if(tab==='examples'){
  if(!exampleLawReturn || !$('exampleContent').firstElementChild)void guard(renderExamples)()
  exampleLawReturn=false
 }else if(practiceLanguage!==lang()){
  if(items.length)lesson()
  else dashboard()
 }
 window.scrollTo(0,tab==='practice'?practiceScroll:0)
}
function renderLaws(){
 const gradeNumber=Number($('lawGrade').value)
 const source=$('lawSource')
 if(gradeNumber===10){
  const link=element('a',t('Open student book','افتح كتاب الطالب'))
  link.href=bookUrl
  link.target='_blank'
  link.rel='noopener noreferrer'
  source.replaceChildren(t('Equations are reproduced from UAE Inspire Science Physics, 2024–25 student edition. Page numbers refer to the printed book. ','القوانين مصوّرة من كتاب الطالب الإماراتي Inspire Science Physics، طبعة 2024–2025. يشير رقم الصفحة إلى الصفحة المطبوعة. '),link)
 }else source.textContent=t('The notation for this grade is awaiting comparison with the school edition.','رموز هذا الصف بانتظار المطابقة مع النسخة المدرسية.')
 $('lawCards').replaceChildren(...laws.filter(row=>row[0]===gradeNumber).map(makeLawCard))
}
function openLaw(gradeNumber,id){
 fromExample=true
 $('lawGrade').value=String(gradeNumber);showTab('laws')
 const section=$('law-'+id)
 section?.focus({preventScroll:true});section?.scrollIntoView({block:'center'})
}
const openQuestion=guard(async(card,id)=>{
 const mark=++opened
 const list=await api('card/'+card.id)
 if(mark!==opened || activeTab!=='examples')return
 const n=list.findIndex(q=>q.id===id)
 if(n<0)throw Error('Question unavailable.')
 grade=card.grade;current=card;items=list;index=n;inMock=false
 showTab('practice');lesson()
 document.getElementById('stem').scrollIntoView({block:'center'})
})
function openExamples(){
 if(inMock&&!mock?.done)return
 const currentId=items[index]?.lo
 const group=cards.filter(c=>c.grade===(inMock?mock.grade:grade))
 $('exampleSlot').replaceChildren(...group.map(c=>{
  const o=element('option',c.id);o.value=c.id;return o
 }))
 if(currentId)$('exampleSlot').value=currentId
 $('examplePicker').hidden=Boolean(currentId)
 showTab('examples')
}
async function renderExamples(){
 const req=++exampleRequest
 const card=cards.find(c=>c.id===$('exampleSlot').value)
 if(!card)return
 const container=$('exampleContent')
 container.replaceChildren()
 const article=await makeExample({card,activeId:items[index]?.id,openLaw,openQuestion,api,figures})
 if(req===exampleRequest && activeTab==='examples')container.replaceChildren(article)
}
$('practiceTab').onclick=$('guideReturn').onclick=()=>showTab('practice')
$('toExamples').onclick=()=>{exampleLawReturn=true;showTab('examples')}
$('examplesTab').onclick=()=>activeTab==='examples'?showTab('practice'):openExamples()
$('exampleSlot').onchange=guard(renderExamples)
$('lawsTab').onclick=()=>{
 if(activeTab==='laws'){showTab('practice');return}
 fromExample=activeTab==='examples';$('lawGrade').value=String(inMock?mock.grade:grade);showTab('laws')
}
$('lawGrade').onchange=renderLaws
async function openCard(card){
 const mark=++opened
 const list=await api('card/'+card.id)
 if(mark!==opened)return
 history.replaceState(null,'','#'+card.id)
 current=card;items=list;inMock=false
 index=Math.max(0,items.findIndex(q=>!cache[q.id]?.checked))
 lesson()
}
function dashboard(){
 items=[];$('studyTabs').hidden=false;$('panelManual').disabled=$('examplesTab').disabled=false;opened++;inMock=false;$('lesson').hidden=true;$('dashboard').hidden=false;$('notice').textContent=''
 document.body.dataset.grade=grade
 $('gradeTabs').replaceChildren(...[9,10,11,12].map(n=>{const b=button(t(n+' Advanced',n+' متقدم'),()=>{grade=n;dashboard()});b.setAttribute('aria-pressed',n===grade);return b}))
 $('outcomesLink').hash='grade-'+grade
 const group=cards.filter(c=>c.grade===grade)
 const total=group.reduce((n,c)=>n+c.total,0),reviewed=Object.values(cache).filter(v=>v.checked&&group.some(c=>c.id===v.lo)).length
 $('heroStats')?.replaceChildren(...[[group.length,t('outcomes','مؤشراً')],[total,t('questions','سؤالاً')],[Math.round(100*reviewed/(total||1))+'%',t('reviewed','تمت مراجعته')]].map(([v,l])=>{const d=element('span');d.append(element('b',String(v)),element('small',l));return d}))
 $('gradeTitle').textContent=t('Grade '+grade+' Advanced · '+group.length+' outcomes','الصف '+grade+' المتقدم · '+group.length+' مؤشراً')
 $('cards').replaceChildren(...group.map(c=>{
   const b=button('',()=>openCard(c))
   b.className='kpi';const done=Object.values(cache).filter(v=>v.lo===c.id&&v.checked).length
   const bar=element('progress');bar.max=c.total;bar.value=done;bar.setAttribute('aria-label',t('Practice progress','تقدم التدريب'))
   const mcq=c.examType==='MCQ';b.dataset.type=mcq?'mcq':'written';b.dataset.state=done>=c.total?'done':done?'progress':'new';b.style.setProperty('--pct',Math.round(100*done/c.total)+'%')
   const head=element('small');head.className='kpi-head'
   const no=element('span',String(c.slot));no.className='kpi-no';no.setAttribute('aria-label',t('Outcome '+c.slot,'مؤشر '+c.slot))
   const kind=element('span',mcq?t('Multiple choice','اختيار من متعدد'):t('Written response','مقالي'));kind.className='kpi-type'
   const count=element('span',c.total+t(' Qs',' سؤال'));count.className='kpi-count'
   head.append(no,kind,count)
   const foot=element('small',t(done+' of '+c.total+' reviewed','تمت مراجعة '+done+' من '+c.total));foot.className='kpi-foot'
   b.append(head,element('h3',c[lang()]),bar,foot);return b
 }))
 void renderHub($('hub'),{api,grade,cards,onPracticeList:(list,title)=>openList(list,title),reset:guard(resetPractice),onMock:m=>{mock=m;openMock()},openCard:c=>{grade=c.grade;void guard(openCard)(c)},openNotebookList:guard(()=>openNotebookList({api})),openAsk:guard(()=>openAsk({api}))})
 $('resumeMock').hidden=!mock;$('resumeMock').textContent=mock?.done?t('Review latest mock','مراجعة آخر اختبار'):mock?.title?t('Resume · ','متابعة · ')+splitTitle(mock.title):t('Resume Grade ','متابعة اختبار الصف ')+mock?.grade
}
function openMock(){inMock=true;items=mock.questions;current=null;index=0;lesson()}
// A practice list that spans several outcomes, such as the mistakes queue
function openList(list,title){
 inMock=false;items=list;index=0
 current={id:t('Review','مراجعة'),grade,bookPages:t('mixed outcomes','مؤشرات متنوعة'),en:title,ar:title}
 $('studyTabs').hidden=false;lesson()
}
$('notebookBtn').onclick=guard(()=>openNotebook({api,question:items[index]}))
$('askBtn').onclick=guard(()=>openAsk({api,question:items[index]}))
$('resumeMock').onclick=()=>openMock()
$('mockStart').onclick=guard(async()=>{if(!mock||mock.done)mock=await api('mock/new',{grade});openMock()})
$('back').onclick=()=>{history.replaceState(null,'',location.pathname+location.search);dashboard()}
function lesson(){
 const q=items[index],draft=cache[q.id],answer=inMock?mock.answers[q.id]:draft?.response
 $('notice').textContent='';$('dashboard').hidden=true;$('lesson').hidden=false
 document.body.dataset.grade=inMock?mock.grade:current.grade
 $('unit').textContent=inMock?t('Mock exam · Grade ','اختبار تجريبي · الصف ')+mock.grade:current.id+t(' · Student book pp. ',' · صفحات الكتاب ')+current.bookPages.replaceAll(';',t(', ','، '))
 const points=inMock&&mock.done?items.reduce((sum,i)=>sum+(i.kind==='MCQ'?(mock.answers[i.id]===i.review.correct?1:0):(i.review?.grade?.total?i.review.grade.score/i.review.grade.total:0)),0):0
 $('title').textContent=inMock?(mock.done?t('Mock review · ','مراجعة الاختبار · ')+(Math.round(points*10)/10)+'/'+items.length+(mock.title?' · '+splitTitle(mock.title):t(' · multiple choice and written marked automatically',' · الاختيار من متعدد والمقالي مصحّحان تلقائيًا')):(splitTitle(mock.title)||t('Mock exam','اختبار الهيكل'))):current[lang()]
 $('nav').replaceChildren(...items.map((v,n)=>{const b=button(n+1,()=>{index=n;lesson()});b.setAttribute('aria-pressed',n===index);b.classList.toggle('chip-done',inMock?!!mock.answers[v.id]:!!cache[v.id]?.checked);return b}))
 $('meta').textContent=(q.kind==='MCQ'?t('Multiple choice','اختيار من متعدد'):t('Written response','إجابة مكتوبة'))+' · '+(index+1)+' / '+items.length
 $('wm').innerHTML=questionWatermark()
 const alternate=t('ar','en')
 writePhysicsText($('stem'),(q.stimulus||q)[lang()])
 $('altLang').textContent=t('العربية','English')
 $('english').lang=alternate
 $('english').dir=t('rtl','ltr')
 writePhysicsText($('english'),q[alternate],alternate)
 const visuals=figures(q,'question',q.images)
 if(q.stimulus)visuals.push(measurements(q.stimulus))
 $('images').replaceChildren(...visuals)
 $('questionLayout').classList.toggle('illustrated',visuals.length>0)
 const inputs=$('inputs');inputs.replaceChildren()
 $('panelManual').disabled=$('examplesTab').disabled=inMock&&!mock.done
 const readonly=inMock&&mock.done
 function edit(value){
  clearAnswerMarks()
  $('result').hidden=true
  if(inMock){
   const drafts=mockDrafts()
   drafts[mock.id]??={}
   drafts[mock.id][q.id]=value
   localStorage.setItem(key+'-mock',JSON.stringify(drafts))
   localStorage.setItem(key+'-mock-answers',JSON.stringify({id:mock.id,answers:{...mock.answers,[q.id]:value}}))
   mock.answers[q.id]=value
   queue=queue.catch(()=>{}).then(syncMock)
  }else{remember(q.id,value);cache[q.id].lo=q.lo;persist();schedule()}
  queue.catch(()=>{$('notice').textContent=inMock?t('Your mock answer could not be saved. Try again.','تعذّر حفظ إجابة الاختبار. أعد المحاولة.'):t('Saved on this device. Progress will sync when you reconnect.','حُفظ على الجهاز. ستتم المزامنة عند عودة الاتصال.')})
 }
 if(q.kind==='MCQ')for(const opt of q.options){
  const label=element('label'),radio=element('input');radio.type='radio';radio.name='answer';radio.value=opt.key;radio.checked=answer===opt.key;radio.disabled=readonly;radio.onchange=()=>edit(opt.key)
  const desc=element('span');writePhysicsText(desc,opt.key+' · '+opt[lang()]);desc.title=opt[t('ar','en')];label.append(radio,desc);inputs.append(label)
 }else writtenEditor(inputs,q,answer,readonly,edit)
 hintLevel=0;$('askBtn').hidden=inMock&&!mock.done
 $('hintText').hidden=true;$('result').hidden=true;$('walkthrough').hidden=inMock;$('manual').hidden=(inMock&&!mock.done)||!q.calc;$('hint').hidden=inMock&&!mock.done
 $('check').hidden=readonly;$('check').textContent=inMock?t('Finish mock','إنهاء الاختبار'):q.kind==='FRQ'?t('Check response','افحص الإجابة'):t('Check answer','تحقق من الإجابة')
 $('next').disabled=index===items.length-1
 if(readonly)showReview(q,q.review,answer)
 else if(!inMock&&draft?.checked){if(replies[q.id])showReview(q,replies[q.id],answer);else void guard(async()=>{const r=await api('record',{id:q.id,response:answer,check:true});if(items[index]===q&&!inMock&&cache[q.id]===draft){replies[q.id]=r;showReview(q,r,answer)}})()}
 tick()
}
function clearAnswerMarks(){
 for(const mark of $('inputs').querySelectorAll('.answer-mark'))mark.remove()
 for(const row of $('inputs').querySelectorAll('[data-verdict]'))delete row.dataset.verdict
}
function markAnswer(row,verdict,label){
 if(!row)return
 row.dataset.verdict=verdict
 const mark=element('small',label)
 mark.className='answer-mark'
 row.append(mark)
}
function showReview(q,r,answer,studyOnly=false){
 const out=$('result')
 clearAnswerMarks()
 const answered=!studyOnly && hasResponse(answer)
 const selected=q.options.find(o=>o.key===answer)
 const key=q.options.find(o=>o.key===r.correct)
 const draft=parseDraft(answer)
 const exact=r.coach?.exact && !draft.parts.some(part=>part?.value?.trim())
 const states=answered && !exact ? r.coach?.parts||[] : []
 const g=answered && q.kind==='FRQ' ? r.grade : null
 const partLabels={
  correct:t('Correct','صحيح'),incorrect:t('Incorrect','خطأ'),
  empty:t('Unanswered','دون إجابة'),review:t('Review','للمراجعة')
 }
 function partVerdict(code,i){
  if(code==='correct' || code==='empty')return code
  if(code==='expression' || (code==='term' && !draft.parts[i]?.value))return 'review'
  return 'incorrect'
 }
 let verdict='review',title=t('Compare your response with the model','قارن إجابتك بالحل النموذجي')
 if(studyOnly)title=t('Solution walkthrough','شرح الحل خطوة بخطوة')
 else if(!answered)title=t('Unanswered','دون إجابة')
 else if(q.kind==='MCQ'){
  verdict=selected?.key===r.correct?'correct':'incorrect'
  title=verdict==='correct'?t('Correct answer','إجابة صحيحة'):t('Incorrect answer','إجابة خاطئة')
  for(const radio of $('inputs').querySelectorAll('input[type=radio]')){
   if(radio.value===r.correct)markAnswer(radio.parentElement,'correct',t('Correct answer','الإجابة الصحيحة'))
   else if(radio.value===answer)markAnswer(radio.parentElement,'incorrect',t('Incorrect choice','اختيار خاطئ'))
  }
 }else if(g && g.total && !exact){
  verdict=g.verdict==='correct'?'correct':g.verdict==='partial'?'partial':'incorrect'
  title=(verdict==='correct'?t('Correct answer','إجابة صحيحة'):verdict==='partial'?t('Partly correct','إجابة صحيحة جزئيًا'):t('Not correct yet','الإجابة غير صحيحة بعد'))+' · '+g.score+'/'+g.total
 }else if(exact || (states.length && states.every(code=>code==='correct'))){
  verdict='correct'
  title=exact?t('Your answer matches the model','إجابتك تطابق الحل النموذجي'):t('All short answers are correct','كل الإجابات القصيرة صحيحة')
 }else if(states.some((code,i)=>partVerdict(code,i)==='incorrect')){
  verdict='incorrect'
  title=states.length===1?t('Incorrect short answer','إجابة قصيرة خاطئة'):t('Check the highlighted answers','راجع الإجابات المحددة')
 }else if(states.includes('empty'))title=t('Response incomplete','الإجابة غير مكتملة')
 out.dataset.verdict=verdict
 out.hidden=false
 out.replaceChildren(element('h3',title))
 if(r.teacher){const tb=element('section');tb.className='teacher-grade';tb.append(element('strong',t('Teacher’s mark: ','تصحيح المعلم: ')+r.teacher.score+'/'+r.teacher.total));if(r.teacher.note)tb.append(element('p',r.teacher.note));out.append(tb)}
 if(g && g.total && !exact)out.append(gradeReport(g,q))
 const step=(heading,body)=>{
  const block=element('section');block.className='coach-step'
  const p=element('p');writePhysicsText(p,body)
  block.append(element('h4',heading),p);out.append(block)
 }
 const sentences=r[lang()].split(/(?<=[.!?؟؛])\s+|\n+|(?=\([b-d]\)\s)/i).map(v=>v.trim()).filter(Boolean)
 const explanatory=sentences.filter(v=>/because|since |therefore|conserv|proportional|correspond|depends|slope|area|direction|constant|produces|indicates|لأن|بسبب|بما أن|ميل|مساحة|يتناسب|ثبات|حفظ|اتجاه|يدل|يعني/i.test(v))
 if(answered){
  if(verdict==='incorrect' && selected && key)step(t('Correct choice','الاختيار الصحيح'),key.key+' · '+key[lang()])
  if(verdict==='incorrect' && t(r.adviceEn,r.advice)){
   step(t('What to check','ما الذي تراجعه؟'),t(r.adviceEn,r.advice))
  }
  const explanation=q.kind==='MCQ' ? r[lang()] : explanatory[0] || sentences[0]
  step(t('Answer explained','تفسير الإجابة'),explanation)
 }
 const messages={
  correct:t('Correct.','صحيح.'), empty:t('Still blank.','الحقل فارغ.'),
  expression:t('Use a numerical expression and select its unit separately.','اكتب تعبيرًا عدديًا وحدّد الوحدة من القائمة.'),
  unit:t('Check the unit.','راجع الوحدة.'),sign:t('The magnitude matches. Check the direction and sign.','المقدار صحيح. راجع الاتجاه والإشارة.'),
  scale:t('Check the power of ten and unit conversion.','راجع أسّ العشرة وتحويل الوحدة.'),
  retry:t('Recheck the relation and substitution.','راجع العلاقة والتعويض.'),
  term:t('Compare your term with the definition. Other wording can be reviewed against the model.','قارن مصطلحك بالتعريف. راجع الصياغات البديلة مع الحل النموذجي.')
 }
 const lines=$('inputs').querySelectorAll('.answer-line')
 if(g?.total){
  // boxes follow the automatic grade, so an answer written in the full-answer box also marks them
  const numbers=g.items.filter(item=>item.type==='number')
  lines.forEach((line,i)=>{
   const item=numbers.length===lines.length?numbers[i]:null
   if(item)markAnswer(line,item.ok?'correct':'incorrect',item.ok?partLabels.correct:partLabels.incorrect)
   else if(states[i] && states[i]!=='empty')markAnswer(line,partVerdict(states[i],i),partLabels[partVerdict(states[i],i)])
  })
 }else states.forEach((code,i)=>{
  const state=partVerdict(code,i)
  markAnswer(lines[i],state,partLabels[state])
  step(q.fields[i]?.[lang()]||t('Answer ','الإجابة ')+(i+1),messages[code])
 })
 step(t('1 · Identify the idea','١ · حدّد الفكرة'),t(englishHint(q.lo),support(q.lo).hint))
 for(const law of relevantLaws(q.lo)){
  step(t('Principle · ','المبدأ · ')+t(law[2],law[3]),t(law[5],law[6]))
 }
 if(!answered && sentences.length>1 && explanatory.length){
  const reasoning=explanatory.find(v=>v!==sentences.at(-1)) || explanatory[0]
  step(t('Apply it to this question','تطبيق الفكرة على السؤال'),reasoning)
 }
 if(!answered && r.advice)step(t('Check your reasoning','راجع الفكرة'),t(r.adviceEn||englishHint(q.lo),r.advice))
 const ideal=element('section');ideal.className='ideal';ideal.hidden=true
 ideal.append(element('h3',t('Worked solution','الحل النموذجي')))
 if(q.kind==='MCQ'){
  const correct=element('strong')
  writePhysicsText(correct,q.options.find(o=>o.key===r.correct)?.[lang()]||'')
  ideal.append(correct)
 }
 const list=element('ol')
 for(const line of sentences){
  const item=element('li')
  writePhysicsText(item,line)
  list.append(item)
 }
 ideal.append(list,...figures(q,'solution',r.images,r.figureNotes))
 const toggle=button('',()=>{ideal.hidden=!ideal.hidden;labelToggle()})
 function labelToggle(){toggle.textContent=ideal.hidden?t('Show full worked solution','إظهار الحل النموذجي الكامل'):t('Hide worked solution','إخفاء الحل النموذجي');toggle.setAttribute('aria-expanded',!ideal.hidden)}
 labelToggle();out.append(toggle,ideal)

}
// Automatic marking report for a written response: score, one line per rubric item and a side-by-side comparison.
function gradeReport(g,q){
 const box=element('section');box.className='grade-report'
 const meter=element('div');meter.className='grade-meter';meter.style.setProperty('--score',Math.round(100*g.score/g.total)+'%')
 meter.append(element('b',Math.round(100*g.score/g.total)+'%'),element('span',t(g.score+' of '+g.total+' marking points',g.score+' من '+g.total+' نقاط تصحيح')))
 const list=element('ul');list.className='grade-items'
 const numberMsg={correct:t('Correct','صحيح'),sign:t('Right size, wrong sign or direction','المقدار صحيح والإشارة أو الاتجاه خطأ'),scale:t('Check the power of ten or the unit conversion','راجع أسّ العشرة أو تحويل الوحدة'),unit:t('The number fits but the unit is of the wrong kind','الرقم مناسب لكن نوع الوحدة خطأ'),missing:t('This result is missing or incorrect','هذه النتيجة غير موجودة أو غير صحيحة')}
 const ideaMsg={correct:t('Included','مذكورة'),opposite:t('Your answer states the opposite idea','إجابتك تذكر الفكرة المعاكسة'),missing:t('This key idea is missing','هذه الفكرة الأساسية غير مذكورة')}
 let n=0,k=0
 for(const item of g.items){
  const li=element('li');li.dataset.ok=item.ok?'yes':item.code==='missing'?'no':'warn'
  const label=item.type==='number'?t('Result ','النتيجة ')+(++n)+(item.unit?' ('+item.unit+')':''):t('Key idea ','فكرة أساسية ')+(++k)
  const head=element('strong',(item.ok?'✓ ':'✗ ')+label)
  const msg=element('span',item.type==='number'?numberMsg[item.code]+(item.unitMissing?t(' · add the unit',' · اكتب الوحدة'):''):ideaMsg[item.code])
  li.append(head,msg)
  const hint=item[lang()]
  if(!item.ok && hint && hint!=='_____'){const p=element('small');writePhysicsText(p,t('From the model: ','من الحل النموذجي: ')+hint);li.append(p)}
  list.append(li)
 }
 box.append(meter,list)
 // guiding questions instead of the answer (no external service)
 const prompts=[]
 for(const item of g.items){
  if(item.ok)continue
  if(item.type==='number')prompts.push({sign:t('Which direction did you take as positive? Check the sign of this result.','ما الاتجاه الذي اعتبرته موجبًا؟ راجع إشارة هذه النتيجة.'),scale:t('Did you convert every quantity to SI units before substituting?','هل حوّلت كل الكميات إلى وحدات SI قبل التعويض؟'),unit:t('What kind of quantity is asked for? Its unit should match.','ما نوع الكمية المطلوبة؟ يجب أن تتوافق وحدتها.'),missing:t('Which law links the given data to the result'+(item.unit?' in '+item.unit:'')+'? Write it, then substitute.','ما القانون الذي يربط المعطيات بالنتيجة'+(item.unit?' بوحدة '+item.unit:'')+'؟ اكتبه ثم عوّض.')}[item.code])
  else prompts.push(item.code==='opposite'?t('Your answer says the opposite of what happens. Which way does it really go, and why?','إجابتك تذكر عكس ما يحدث. ما الصحيح؟ ولماذا؟'):t('Which physics idea explains this step? Name it in your answer.','ما المفهوم الفيزيائي الذي يفسّر هذه الخطوة؟ اذكره في إجابتك.'))
 }
 if(g.reasoning?.asks&&!g.reasoning.gives)prompts.push(t('The question asks you to explain. Link the result to its cause with “because” or “so”.','السؤال يطلب تفسيرًا. اربط النتيجة بسببها باستخدام «لأن» أو «إذن».'))
 if(g.reasoning?.unitsMissing)prompts.push(t('Write the unit after every numerical result.','اكتب الوحدة بعد كل نتيجة عددية.'))
 if(prompts.length){const s=element('section');s.className='socratic';s.append(element('strong',t('Questions to guide you','أسئلة توجّهك')));const ol=element('ul');for(const p of [...new Set(prompts)])ol.append(element('li',p));s.append(ol);box.append(s)}
 if(g.drawing){box.append(element('p',t('Drawings are not marked automatically. Draw yours in the solution notebook and send it to your teacher.','الرسم لا يُصحَّح تلقائيًا؛ ارسمه في دفتر الحل وأرسله للمعلم.')));const nb=button(t('✎ Draw in the notebook','✎ ارسم في الدفتر'),()=>openNotebook({api,question:q}));nb.className='nb-open';box.append(nb)}
 if(g.compare){
  const panel=element('div');panel.className='compare';panel.hidden=true
  const column=(heading,segs,dir)=>{const col=element('div');col.dir=dir;col.append(element('h4',heading));const p=element('p');for(const seg of segs){if(seg.m){const m=element('mark',seg.t);m.dataset.m=seg.m;p.append(m)}else p.append(document.createTextNode(seg.t))}col.append(p);return col}
  panel.append(column(t('Your answer','إجابتك'),g.compare.student,'auto'),column(t('Worked solution','الحل النموذجي'),g.compare[lang()],t('ltr','rtl')))
  const legend=element('small',t('Green: matched · Amber: in the model but missing from your answer','الأخضر: متطابق · الكهرماني: موجود في الحل وغير موجود في إجابتك'));legend.className='compare-legend';panel.append(legend)
  const toggle=button(t('Compare my answer with the model','قارن إجابتي بالحل النموذجي'),()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',!panel.hidden)})
  toggle.className='compare-toggle';toggle.setAttribute('aria-expanded','false')
  box.append(toggle,panel)
 }
 return box
}
$('walkthrough').onclick=guard(async()=>{
 const q=items[index]
 const review=await api('walkthrough',{id:q.id})
 if(!inMock && items[index]===q){
  showReview(q,review,null,true)
  $('result').scrollIntoView({block:'nearest'})
 }
})
$('check').onclick=guard(async()=>{
 const q=items[index]
 if(inMock){
  if(!confirm(t('Finish the mock and review your answers?','إنهاء الاختبار وعرض التصحيح؟')))return
  await queue.catch(()=>{});await syncMock();mock=await api('mock/finish',{mock:mock.id});openMock();return
 }
 const answer=cache[q.id]?.response
 if(!answer?.trim() || (q.kind==='FRQ' && !hasResponse(answer)))throw Error('أدخل إجابتك أولاً')
 remember(q.id,answer,true);cache[q.id].lo=q.lo;persist();await schedule()
 if(items[index]===q&&!inMock&&replies[q.id])showReview(q,replies[q.id],answer)
})
$('next').onclick=()=>{if(index+1<items.length){index++;lesson()}}
// Hint ladder without any external service: the idea, then the law, then clues from the marking rubric.
let hintLevel=0
$('hint').onclick=guard(async()=>{
 const q=items[index],p=$('hintText')
 hintLevel=Math.min(hintLevel+1,q.kind==='FRQ'?3:2)
 const blocks=[[t('Hint 1 · The idea','تلميح 1 · الفكرة'),t(englishHint(q.lo),support(q.lo).hint)]]
 if(hintLevel>=2)for(const law of relevantLaws(q.lo).slice(0,2))blocks.push([t('Hint 2 · The law','تلميح 2 · القانون')+' · '+t(law[2],law[3]),t(law[5],law[6])])
 if(hintLevel>=3){
  const h=await api('hints',{id:q.id})
  const units=h.clues.filter(c=>c.type==='number').map(c=>c.unit||t('no unit','بلا وحدة'))
  const lines=[]
  if(units.length)lines.push(t('Your answer needs '+units.length+' numerical result'+(units.length>1?'s':'')+' in: ','إجابتك تحتاج '+units.length+' نتيجة عددية بالوحدات: ')+units.join('، '))
  for(const c of h.clues.filter(c=>c.type==='idea'&&c[lang()]))lines.push(t('Complete the idea: ','أكمل الفكرة: ')+c[lang()])
  if(h.drawing)lines.push(t('This question needs a diagram: draw it in the solution notebook.','هذا السؤال يحتاج رسمًا: ارسمه في دفتر الحل.'))
  blocks.push([t('Hint 3 · What the answer must contain','تلميح 3 · ما يجب أن تحتويه الإجابة'),lines.join('\n')||t('Compare your steps with the law above.','قارن خطواتك بالقانون أعلاه.')])
 }
 p.replaceChildren(...blocks.map(([h,b])=>{const d=element('div');d.className='hint-step';const body=element('p');writePhysicsText(body,b);d.append(element('strong',h),body);return d}))
 if(hintLevel<(q.kind==='FRQ'?3:2)){const more=button(t('Next hint','التلميح التالي'),()=>$('hint').click());more.className='hint-more';p.append(more)}
 p.hidden=false
})
function showManual(id){
 const [title,steps]=t(englishGuides[id],guides[id]);const example=guides[id][2];const img=element('img')
 img.src='./manual/'+id+'.png';img.alt=t('Calculator screen for the worked example','شاشة الحاسبة في المثال التدريبي')
 const ex=element('p',example);ex.dir='ltr'
 $('guideBody').replaceChildren(element('small',t('ClassWiz · Calculator guide','ClassWiz · دليل الحاسبة')),element('h2',title),element('p',steps),element('strong',t('Practice example','مثال مستقل للتدريب')),ex,img,button(t('Try the calculator','جرّب على الحاسبة'),()=>{$('guide').close();$('open-floating-calculator').click()}))
 const choose=element('select')
 choose.setAttribute('aria-label',t('Calculator technique','مهارة استخدام الحاسبة'))
 for(const [code,guide] of Object.entries(t(englishGuides,guides))){
  const option=element('option',guide[0]);option.value=code;choose.append(option)
 }
 choose.value=id;choose.onchange=()=>showManual(choose.value);choose.id='manualTechnique'
 $('guideBody').prepend(choose)
 if(!$('guide').open)$('guide').showModal()
}
$('panelManual').onclick=$('manual').onclick=()=>{
 const lo=activeTab==='examples'?$('exampleSlot').value:items[index]?.lo
 showManual(lo?support(lo).guide:'concept')
}
$('closeGuide').onclick=()=>$('guide').close()
function tick(){
 $('clock').textContent=''
 if(!inMock||mock.done)return
 const seconds=Math.max(0,Math.ceil((mock.deadline-Date.now())/1000))
 $('clock').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')
 if(!seconds)void guard(async()=>{mock=await api('mock');if(inMock&&mock.done){openMock();if(activeTab==='laws')showTab('laws')}})()
}
window.addEventListener('online',guard(async()=>{await schedule();await syncMock()}));setInterval(tick,1000)
installContentShield()
applyLanguage()
for(const toggle of document.querySelectorAll('[data-switch]')){
 toggle.onclick=()=>{
  const hintVisible=!$('hintText').hidden
  changeLanguage()
  if(activeTab==='laws')$('exampleContent').replaceChildren()
  $('notice').textContent='';$('loginError').textContent=''
  if(!$('lesson').hidden){lesson();if(hintVisible)$('hint').click()}
  else if(activeTab==='laws')renderLaws();else if(activeTab==='examples')void guard(renderExamples)();else if(profile?.school)dashboard()
  if($('guide').open)showManual($('manualTechnique').value)
 }
}
void guard(init)()
