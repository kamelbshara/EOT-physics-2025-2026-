import {lang,t} from './language.js'
import {laws,relevantLaws} from './laws.js'
import {plateCaptions} from './plates.js'
import {englishHint} from './english-support.js'
import {support} from './guides.js'
import sourceFigures from './worked/source-figures.js'

function el(tag,text){
 const node=document.createElement(tag)
 if(text!==undefined){
  // Keep mixed numbers, units and equations in reading order inside Arabic prose.
  if(lang()==='ar' && /[\u0600-\u06FF]/u.test(text)){
   const runs=text.split(/([\p{Script=Latin}\p{Script=Greek}\p{N}\p{Sm}ℏ(][\p{Script=Latin}\p{Script=Greek}\p{N}\p{Sm}ℏ·×÷^_*\/.()%°:| −-]*)/gu)
   for(const [i,run] of runs.entries()){
    if(i%2===0){node.append(run);continue}
    const isolated=document.createElement('bdi')
    isolated.dir='ltr'
    isolated.textContent=run.trimEnd()
    node.append(isolated,run.slice(isolated.textContent.length))
   }
  }else node.textContent=text
 }
 return node
}

function diagram(id){
 const figure=el('figure')
 figure.className='law-figure'
 const img=el('img')
 img.src='./plates/'+id+'.png'
 img.width=638
 img.height=319
 img.loading='lazy'
 img.alt=''
 figure.append(img,el('figcaption',t(...plateCaptions[id])))
 return figure
}

export function makeLawCard(row){
 const id=laws.indexOf(row)
 const card=el('article')
 card.className='law-card'
 card.id='law-'+id
 card.tabIndex=-1
 const equation=el('p',row[4])
 equation.className='formula'
 card.append(el('h3',t(row[2],row[3])),diagram(id),equation,el('p',t(row[5],row[6])))
 return card
}

const gradeModules={
 9:()=>import('./worked/grade-9.js'),10:()=>import('./worked/grade-10.js'),
 11:()=>import('./worked/grade-11.js'),12:()=>import('./worked/grade-12.js')
}
const exampleDiagrams={'G9A-Q12':29,'G9A-Q20':3,'G12A-Q13':28,'G12A-Q19':27}

function strategy(text){
 const box=el('section')
 box.className='example-plan'
 box.append(el('strong',t('Solution strategy','استراتيجية الحل')),el('p',text))
 return box
}

function walkthrough(lines){
 const details=el('details')
 details.className='example-steps'
 const list=el('ol')
 for(const line of lines)list.append(el('li',line))
 details.append(el('summary',t('Show the steps and why they work','اعرض خطوات الحل وسبب كل خطوة')),list)
 return details
}

function sourceExample(card,source,api,figures){
 const details=el('details')
 details.className='example-source'
 const body=el('div')
 details.append(el('summary',t('Another example with a source figure','مثال آخر برسم من المصدر')),body)
 let loaded=false
 details.ontoggle=async()=>{
  if(!details.open||loaded)return
  loaded=true
  try{
   const questions=await api('card/'+card.id)
   const q=questions.find(q=>q.id===source.id)
   const review=await api('walkthrough',{id:q.id})
   const category=source.source==='old9a'?t('Past exam figure','رسم من اختبار سابق'):t('Practice booklet figure','رسم من كتيّب تدريبي')
   body.replaceChildren(el('h3',q[lang()]))
   const images=figures(q,'question',q.images)
   body.append(...images,el('small',category+' · '+source.name+t(' · PDF page ',' · صفحة PDF ')+source.page))
   if(q.options.length){
    const choices=el('ul')
    for(const option of q.options)choices.append(el('li',option.key+' · '+option[lang()]))
    body.append(choices)
   }
   const steps=review[lang()].split(/(?<=[.!?؟])\s+|[؛;]\s*|\n+/u).map(s=>s.trim()).filter(Boolean)
   const answer=walkthrough(steps)
   answer.append(...figures(q,'solution',review.images))
   body.append(strategy(t(englishHint(card.id),support(card.id).hint)),answer)
  }catch{
   loaded=false
   body.replaceChildren(el('p',t('Close and reopen to retry loading this example.','أغلق المثال وأعد فتحه لتحاول التحميل مجددًا.')))
  }
 }
 return details
}

export async function makeExample({card,activeId,openLaw,api,figures}){
 const examples=(await gradeModules[card.grade]()).default
 const example=examples[card.id]
 const sheet=el('article')
 sheet.className='example-sheet'
 sheet.append(el('small',card.id+' · '+t('Original worked example','مثال تدريبي مؤلّف')),el('p',card[lang()]),
  el('strong',t('What to find','المطلوب')),el('h2',example.problem[lang()]))
 const id=exampleDiagrams[card.id]
 if(id!=null)sheet.append(diagram(id))
 sheet.append(strategy(example.strategy[lang()]),walkthrough(example.steps.map(s=>s[lang()])))
 const links=el('div')
 links.className='tools'
 for(const row of relevantLaws(card.id)){
  const link=el('button',t('Law sheet · ','ورقة القوانين · ')+t(row[2],row[3]))
  link.onclick=()=>openLaw(card.grade,laws.indexOf(row))
  links.append(link)
 }
 sheet.append(links)
 const source=sourceFigures[card.id]?.find(item=>item.id!==activeId)
 if(source)sheet.append(sourceExample(card,source,api,figures))
 return sheet
}
