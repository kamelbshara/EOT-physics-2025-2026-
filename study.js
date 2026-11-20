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
 sessionStorage.setItem('physics-profile',JSON.stringify(profile))
 key='physics-practice-'+profile.startedAt
 try{cache=JSON.parse(localStorage.getItem(key)||'{}')}catch{cache={}}
 await schedule()
 for(const r of await api('progress'))cache[r.question]={response:r.response,checked:Boolean(r.checked),lo:r.lo}
 persist();mock=await api('mock');await syncMock();mock=await api('mock');dashboard()
 await openLinkedCard()
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
$('loginForm').onsubmit=guard(async e=>{e.preventDefault();await api('profile',{name:$('name').value,school:$('school').value});$('login').close();await init()})
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
 $('gradeTabs').replaceChildren(...[9,10,11,12].map(n=>{const b=button(t('Grade ','الصف ')+n,()=>{grade=n;dashboard()});b.setAttribute('aria-pressed',n===grade);return b}))
 $('outcomesLink').hash='grade-'+grade
 const group=cards.filter(c=>c.grade===grade);$('gradeTitle').textContent=t('Grade '+grade+' Advanced · '+group.length+' outcomes','الصف '+grade+' المتقدم · '+group.length+' مؤشراً')
 $('cards').replaceChildren(...group.map(c=>{
   const b=button('',()=>openCard(c))
   b.className='kpi';const done=Object.values(cache).filter(v=>v.lo===c.id&&v.checked).length
   const bar=element('progress');bar.max=c.total;bar.value=done;bar.setAttribute('aria-label',t('Practice progress','تقدم التدريب'))
   b.append(element('small',t('Outcome '+c.slot,'مؤشر '+c.slot)+' · '+(c.examType==='MCQ'?t('Multiple choice','اختيار من متعدد'):t('Written response','مقالي'))+' · '+c.total),element('h3',c[lang()]),bar,element('small',t(done+' of '+c.total+' reviewed','تمت مراجعة '+done+' من '+c.total)));return b
 }))
 $('resumeMock').hidden=!mock;$('resumeMock').textContent=mock?.done?t('Review latest mock','مراجعة آخر اختبار'):t('Resume Grade ','متابعة اختبار الصف ')+mock?.grade
}
function openMock(){inMock=true;items=mock.questions;current=null;index=0;lesson()}
$('resumeMock').onclick=()=>openMock()
$('mockStart').onclick=guard(async()=>{if(!mock||mock.done)mock=await api('mock/new',{grade});openMock()})
$('back').onclick=()=>{history.replaceState(null,'',location.pathname+location.search);dashboard()}
function lesson(){
 const q=items[index],draft=cache[q.id],answer=inMock?mock.answers[q.id]:draft?.response
 $('notice').textContent='';$('dashboard').hidden=true;$('lesson').hidden=false
 $('unit').textContent=inMock?t('Mock exam · Grade ','اختبار تجريبي · الصف ')+mock.grade:current.id+t(' · Student book pp. ',' · صفحات الكتاب ')+current.bookPages.replaceAll(';',t(', ','، '))
 const auto=inMock&&mock.done?items.filter(i=>i.kind==='MCQ'):[]
 $('title').textContent=inMock?(mock.done?t('Mock review · ','مراجعة الاختبار · ')+auto.filter(i=>mock.answers[i.id]===i.review.correct).length+'/'+auto.length+t(' multiple choice',' اختيار من متعدد'):t('Mock exam','اختبار الهيكل')):current[lang()]
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
 $('hintText').hidden=true;$('result').hidden=true;$('walkthrough').hidden=inMock;$('manual').hidden=inMock&&!mock.done;$('hint').hidden=inMock&&!mock.done
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
 states.forEach((code,i)=>{
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
$('hint').onclick=()=>{const p=$('hintText');p.textContent=t(englishHint(items[index].lo), support(items[index].lo).hint);p.hidden=!p.hidden}
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
