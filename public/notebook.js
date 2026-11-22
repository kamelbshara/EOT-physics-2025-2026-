import {writePhysicsText} from './question-paper.js'
import {lang,t} from './language.js'
import {laws,relevantLaws} from './laws.js'
import {equations,slitFigures} from './textbook/grade-10.js'
import {plateCaptions} from './plates.js'
import {englishHint} from './english-support.js'
import {support} from './guides.js'
import {conceptPractice} from './worked/concept-practice.js'
import sourceFigures from './worked/source-figures.js'

function el(tag,text){
 const node=document.createElement(tag)
 if(text!==undefined){
  writePhysicsText(node,text)
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

function bookFigure(asset,page,caption,notation){
 const figure=el('figure')
 figure.className=notation?'book-equation':'law-figure book-diagram'
 const img=el('img')
 img.src='./textbook/10/'+asset+'.png'
 img.alt=notation||''
 img.dir='ltr'
 const label=el('figcaption',caption+t(' · p. ',' · ص ')+page)
 figure.append(img,label)
 return figure
}

// each law on its own line; x_f / v_i are written with real subscripts as in the textbook
function formulaLines(text){
 const box=el('div')
 box.className='formula'
 for(const line of String(text).split(/\s+·\s+/)){
  const row=document.createElement('span')
  row.className='formula-line'
  for(const part of line.split(/(_[a-z0-9]+)/i)){
   if(/^_[a-z0-9]+$/i.test(part)){const sub=document.createElement('sub');sub.textContent=part.slice(1);row.append(sub)}
   else if(part)row.append(document.createTextNode(part))
  }
  box.append(row)
 }
 return box
}

export function makeLawCard(row){
 const id=laws.indexOf(row)
 const card=el('article')
 card.className='law-card'
 card.id='law-'+id
 card.tabIndex=-1
 card.append(el('h3',t(row[2],row[3])))
 if(Array.isArray(row[4])){
  const figure=slitFigures[row[4][0]]
  card.append(figure?bookFigure(figure[0],figure[1],t(figure[2],figure[3])):diagram(id))
  for(const asset of row[4]){
   const [page,notation,en,ar]=equations[asset]
   card.append(bookFigure(asset,page,t(en,ar),notation))
  }
 }else{
  if(plateCaptions[id])card.append(diagram(id))   // newer laws have no drawn plate yet
  card.append(formulaLines(row[4]))
 }
 card.append(el('p',t(row[5],row[6])))
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
   body.append(...images)
   if(!q.figureNotes)body.append(el('small',category+' · '+source.name+t(' · PDF page ',' · صفحة PDF ')+source.page))
   if(q.options.length){
    const choices=el('ul')
    for(const option of q.options)choices.append(el('li',option.key+' · '+option[lang()]))
    body.append(choices)
   }
   const steps=review[lang()].split(/(?<=[.!?؟])\s+|[؛;]\s*|\n+/u).map(s=>s.trim()).filter(Boolean)
   const answer=walkthrough(steps)
   answer.append(...figures(q,'solution',review.images,review.figureNotes))
   body.append(strategy(t(englishHint(card.id),support(card.id).hint)),answer)
  }catch{
   loaded=false
   body.replaceChildren(el('p',t('Close and reopen to retry loading this example.','أغلق المثال وأعد فتحه لتحاول التحميل مجددًا.')))
  }
 }
 return details
}

export async function makeExample({card,activeId,openLaw,openQuestion,api,figures}){
 const examples=(await gradeModules[card.grade]()).default
 const example=examples[card.id]
 const sheet=el('article')
 sheet.className='example-sheet'
 sheet.append(el('small',card.id+' · '+t('Original worked example','مثال تدريبي مؤلّف')),el('p',card[lang()]),
  el('small',t('Student book pages in the blueprint · ','صفحات الكتاب بحسب الهيكل · ')+card.bookPages.replaceAll(';',t(', ','، '))),
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
 const concepts=conceptPractice[card.id]
 if(concepts){
  const practice=el('section')
  practice.className='concepts'
  practice.append(el('h3',t('Practise a concept','تدرّب على مفهوم')))
  const buttons=el('div')
  buttons.className='tools'
  for(const [id,en,ar] of concepts){
   const button=el('button',t(en,ar))
   button.onclick=()=>openQuestion(card,id)
   buttons.append(button)
  }
  practice.append(buttons)
  sheet.append(practice)
 }
 const source=sourceFigures[card.id]?.find(item=>item.id!==activeId)
 if(source)sheet.append(sourceExample(card,source,api,figures))
 return sheet
}
