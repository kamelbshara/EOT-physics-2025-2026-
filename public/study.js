import { installContentShield } from './content-shield.js'
import { setupFloatingCalculator } from './floating-calculator.js'
import { questionWatermark, watermarkCss } from './watermark.js'
import { support, guides } from './guides.js'

const $=id=>document.getElementById(id)
function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node}
function button(text,fn){const b=element('button',text);b.onclick=guard(fn);return b}
function guard(fn){return async (...args)=>{try{await fn(...args)}catch(e){$('notice').textContent=e.message}}}
async function api(path,body){
 const res=await fetch('/api/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 if(!res.ok)throw Error((await res.json()).error||'تعذّر الاتصال')
 return res.json()
}
let cards=[],profile,grade=9,current,items=[],index=0,mock=null,inMock=false,cache={},key,queue=Promise.resolve(),replies={},opened=0
const style=element('style',watermarkCss);document.head.append(style)
setupFloatingCalculator(document)
function persist(){try{localStorage.setItem(key,JSON.stringify(cache))}catch{$('notice').textContent='تعذّر الحفظ على الجهاز. تحقق من مساحة التخزين.'}}
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
 if(!profile){$('login').showModal();return}
 sessionStorage.setItem('physics-profile',JSON.stringify(profile))
 key='physics-practice-'+profile.startedAt
 try{cache=JSON.parse(localStorage.getItem(key)||'{}')}catch{cache={}}
 for(const r of await api('progress'))if(!cache[r.question]?.pending)cache[r.question]={response:r.response,checked:Boolean(r.checked),lo:r.lo}
 persist();await schedule();mock=await api('mock');await syncMock();mock=await api('mock');dashboard()
}
$('loginForm').onsubmit=guard(async e=>{e.preventDefault();await api('profile',{name:$('name').value});$('login').close();await init()})
$('login').addEventListener('cancel',e=>e.preventDefault())
function dashboard(){
 opened++;inMock=false;$('lesson').hidden=true;$('dashboard').hidden=false;$('notice').textContent=''
 $('gradeTabs').replaceChildren(...[9,10,11,12].map(n=>{const b=button('الصف '+n,()=>{grade=n;dashboard()});b.setAttribute('aria-pressed',n===grade);return b}))
 const group=cards.filter(c=>c.grade===grade);$('gradeTitle').textContent='الصف '+grade+' المتقدم · '+group.length+' مؤشراً'
 $('cards').replaceChildren(...group.map(c=>{
   const b=button('',async()=>{const mark=++opened;const list=await api('card/'+c.id);if(mark!==opened)return;current=c;items=list;inMock=false;index=items.findIndex(q=>!cache[q.id]?.checked);index=Math.max(0,index);lesson()})
   b.className='kpi';const done=Object.values(cache).filter(v=>v.lo===c.id&&v.checked).length
   const bar=element('progress');bar.max=c.total;bar.value=done;bar.setAttribute('aria-label','تقدم التدريب')
   b.append(element('small','مؤشر '+c.slot+' · '+c.total+' أسئلة'),element('h3',c.ar),bar,element('small','تمت مراجعة '+done+' من '+c.total));return b
 }))
 $('resumeMock').hidden=!mock;$('resumeMock').textContent=mock?.done?'مراجعة آخر اختبار':'متابعة اختبار الصف '+mock?.grade
}
function openMock(){inMock=true;items=mock.questions;current=null;index=0;lesson()}
$('resumeMock').onclick=()=>openMock()
$('mockStart').onclick=guard(async()=>{if(!mock||mock.done)mock=await api('mock/new',{grade});openMock()})
$('back').onclick=()=>dashboard()
function figures(q,role,ids){
 return ids.map((id,i)=>{const img=element('img');img.src='/api/figure/'+q.id+'/'+role+'/'+i;img.alt=(role==='question'?'رسم السؤال ':'رسم الحل ')+(i+1);return img})
}
function lesson(){
 const q=items[index],draft=cache[q.id],answer=inMock?mock.answers[q.id]:draft?.response
 $('notice').textContent='';$('dashboard').hidden=true;$('lesson').hidden=false
 $('unit').textContent=inMock?'اختبار تجريبي · الصف '+mock.grade:current.id+' · الصف '+current.grade
 const auto=inMock&&mock.done?items.filter(i=>i.kind==='MCQ'):[]
 $('title').textContent=inMock?(mock.done?'مراجعة الاختبار · '+auto.filter(i=>mock.answers[i.id]===i.review.correct).length+'/'+auto.length+' اختيار من متعدد':'اختبار الهيكل'):current.ar
 $('nav').replaceChildren(...items.map((v,n)=>{const b=button(n+1,()=>{index=n;lesson()});b.setAttribute('aria-pressed',n===index);b.classList.toggle('chip-done',inMock?!!mock.answers[v.id]:!!cache[v.id]?.checked);return b}))
 $('meta').textContent=(q.kind==='MCQ'?'اختيار من متعدد':'إجابة مكتوبة')+' · '+(index+1)+' / '+items.length
 $('wm').innerHTML=questionWatermark();$('stem').textContent=q.ar;$('english').textContent=q.en;$('images').replaceChildren(...figures(q,'question',q.images))
 const inputs=$('inputs');inputs.replaceChildren()
 const readonly=inMock&&mock.done
 function edit(value){
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
  queue.catch(()=>{$('notice').textContent=inMock?'تعذّر حفظ إجابة الاختبار. أعد المحاولة.':'حُفظ على الجهاز. ستتم المزامنة عند عودة الاتصال.'})
 }
 if(q.kind==='MCQ')for(const opt of q.options){
  const label=element('label'),radio=element('input');radio.type='radio';radio.name='answer';radio.value=opt.key;radio.checked=answer===opt.key;radio.disabled=readonly;radio.onchange=()=>edit(opt.key)
  const desc=element('span',opt.key+' · '+opt.ar);desc.title=opt.en;label.append(radio,desc);inputs.append(label)
 }else{const a=element('textarea');a.value=answer||'';a.maxLength=2500;a.placeholder='اكتب خطوات الحل والوحدة أو فسّر إجابتك…';a.setAttribute('aria-label','إجابتك');a.disabled=readonly;a.oninput=()=>edit(a.value);inputs.append(a)}
 $('hintText').hidden=true;$('result').hidden=true;$('manual').hidden=inMock&&!mock.done;$('hint').hidden=inMock&&!mock.done
 $('check').hidden=readonly;$('check').textContent=inMock?'إنهاء الاختبار':q.kind==='FRQ'?'قارن بالحل النموذجي':'تحقق من الإجابة'
 $('next').disabled=index===items.length-1
 if(readonly)showReview(q,q.review,answer)
 else if(!inMock&&draft?.checked){if(replies[q.id])showReview(q,replies[q.id],answer);else void guard(async()=>{const r=await api('record',{id:q.id,response:answer,check:true});if(items[index]===q&&!inMock&&cache[q.id]===draft){replies[q.id]=r;showReview(q,r,answer)}})()}
 tick()
}
function showReview(q,r,answer){
 const out=$('result');out.hidden=false;const title=q.kind==='FRQ'?'مراجعة ذاتية · قارن خطواتك بالحل':answer===r.correct?'إجابة صحيحة':answer?'راجع اختيارك':'لم تُجب'
 out.replaceChildren(element('h3',title))
 if(q.kind==='MCQ'&&answer!==r.correct){
  const selected=q.options.find(o=>o.key===answer)
  if(selected)out.append(element('p','اخترت: '+selected.ar))
  out.append(element('p','الإجابة الصحيحة: '+q.options.find(o=>o.key===r.correct).ar))
  if(r.advice)out.append(element('p',r.advice))
 }
 out.append(element('p',r.ar),...figures(q,'solution',r.images))
 const details=element('details');details.append(element('summary','Worked solution'),element('p',r.en));details.dir='ltr';out.append(details)
}
$('check').onclick=guard(async()=>{
 const q=items[index]
 if(inMock){
  if(!confirm('إنهاء الاختبار وعرض التصحيح؟'))return
  await queue.catch(()=>{});await syncMock();mock=await api('mock/finish',{mock:mock.id});openMock();return
 }
 const answer=cache[q.id]?.response
 if(!answer?.trim())throw Error('أدخل إجابتك أولاً')
 remember(q.id,answer,true);cache[q.id].lo=q.lo;persist();await schedule()
 if(items[index]===q&&!inMock&&replies[q.id])showReview(q,replies[q.id],answer)
})
$('next').onclick=()=>{if(index+1<items.length){index++;lesson()}}
$('hint').onclick=()=>{const p=$('hintText');p.textContent=support(items[index].lo).hint;p.hidden=!p.hidden}
$('manual').onclick=()=>{
 const id=support(items[index].lo).guide;const [title,steps,example]=guides[id];const img=element('img')
 img.src='/manual/'+id+'.png';img.alt='شاشة الحاسبة في المثال التدريبي'
 const ex=element('p',example);ex.dir='ltr'
 $('guideBody').replaceChildren(element('small','ClassWiz · دليل الحاسبة'),element('h2',title),element('p',steps),element('strong','مثال مستقل للتدريب'),ex,img,button('جرّب على الحاسبة',()=>{$('guide').close();$('open-floating-calculator').click()}))
 $('guide').showModal()
}
$('closeGuide').onclick=()=>$('guide').close()
function tick(){
 $('clock').textContent=''
 if(!inMock||mock.done)return
 const seconds=Math.max(0,Math.ceil((mock.deadline-Date.now())/1000))
 $('clock').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')
 if(!seconds)void guard(async()=>{mock=await api('mock');if(inMock&&mock.done)openMock()})()
}
window.addEventListener('online',guard(async()=>{await schedule();await syncMock()}));setInterval(tick,1000)
installContentShield();void guard(init)()
