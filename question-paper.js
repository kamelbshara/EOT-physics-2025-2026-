import {lang,t} from './language.js'
import {apiOrigin} from './api-config.js'
import {questionWatermark} from './watermark.js'

function appendNotation(node,text){
 const parts=String(text).split(/(θ_c|λ_medium|x_red|x_blue|n_film|n_air)/u)
 for(const [i,part] of parts.entries()){
  if(i%2===0){node.append(part);continue}
  const [base,index]=part.split('_')
  const sub=document.createElement('sub')
  sub.textContent=index
  node.append(base,sub)
 }
}

export function writePhysicsText(node,text,language=lang()){
 node.replaceChildren()
 // Keep mixed numbers, units and equations in reading order inside Arabic prose.
 if(language==='ar' && /[\u0600-\u06FF]/u.test(text)){
  const runs=String(text).split(/([\p{Script=Latin}\p{Script=Greek}\p{N}\p{Sm}ℏ(][\p{Script=Latin}\p{Script=Greek}\p{N}\p{Sm}ℏ·×÷^_*\/.()%°:| −-]*)/gu)
  for(const [i,run] of runs.entries()){
   if(i%2===0){node.append(run);continue}
   const isolated=document.createElement('bdi')
   isolated.dir='ltr'
   appendNotation(isolated,run.trimEnd())
   node.append(isolated,run.slice(run.trimEnd().length))
  }
 }else appendNotation(node,text)
}

function el(tag,text){
 const n=document.createElement(tag)
 if(text!==undefined)writePhysicsText(n,text)
 return n
}

function enlarge(url,title,credit){
 const viewer=document.getElementById('figureViewer')
 const img=el('img')
 img.crossOrigin='use-credentials'
 img.src=url
 img.alt=title
 const copy=el('div')
 copy.className='figure-watermark'
 copy.innerHTML=questionWatermark()
 document.getElementById('figureTitle').textContent=title
 document.getElementById('enlargedFigure').replaceChildren(img,el('p',credit),copy)
 viewer.showModal()
}
document.getElementById('closeFigure').onclick=()=>document.getElementById('figureViewer').close()

export function figures(q,role,ids,notes=q.figureNotes){
 return ids.map((id,index)=>{
  const label=notes?.[id]
  const title=label?.[lang()] || (role==='question'?t('Question figure','رسم السؤال'):t('Solution figure','رسم الحل'))+' '+(index+1)
  const credit=label?t('Source: ','المصدر: ')+label.name+t(' · p. ',' · ص ')+label.page:''
  const frame=el('figure')
  frame.className='question-figure'
  const open=el('button')
  open.className='figure-open'
  open.type='button'
  open.setAttribute('aria-label',t('Enlarge figure: ','تكبير الرسم: ')+title)
  const img=el('img')
  img.crossOrigin='use-credentials'
  img.src=apiOrigin+'/api/figure/'+q.id+'/'+role+'/'+index
  img.alt=title
  const icon=el('span','⤢')
  icon.setAttribute('aria-hidden','true')
  open.append(img,icon)
  open.onclick=()=>enlarge(img.src,title,credit)
  const caption=el('figcaption',title)
  if(credit)caption.append(el('small',credit))
  frame.append(open,caption)
  return frame
 })
}

export function measurements(stimulus){
 const table=el('table')
 table.className='readings'
 table.append(el('caption',t('Measured values','القياسات')))
 const header=table.createTHead().insertRow()
 for(const col of stimulus.columns){
  const th=el('th',col[lang()]);th.scope='col';header.append(th)
 }
 const body=table.createTBody()
 for(const row of stimulus.rows){
  const tr=body.insertRow()
  for(const value of row){const td=tr.insertCell();td.dir='ltr';td.textContent=value}
 }
 return table
}
