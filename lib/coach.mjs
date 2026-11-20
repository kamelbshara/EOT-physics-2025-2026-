import { readFileSync } from 'node:fs'
const shortChecks=JSON.parse(readFileSync(new URL('../bank/short-checks.json',import.meta.url),'utf8'))
import { keyed } from '../bank/steps.mjs'
import { numericValue } from './math-equivalence.js'
const units=[
 {s:1,ms:0.001,min:60,h:3600},{g:1,kg:1000},{V:1,mV:0.001,kV:1000},
 {m:1,cm:1e-2,mm:1e-3,km:1e3,nm:1e-9,μm:1e-6}, {'m/s':1,'km/h':1/3.6,'cm/s':0.01},
 {'m/s²':1,'cm/s²':0.01}, {'°':Math.PI/180,rad:1},{Hz:1,kHz:1e3,MHz:1e6,THz:1e12},
 {J:1,kJ:1e3,eV:1.602176634e-19},{'J·s':1,'eV·s':1.602176634e-19},
 {'N·s':1,'kg·m/s':1},{N:1,kN:1000},{'N·m':1,'N·cm':0.01}
]
const scales=unit=>units.find(group=>Object.hasOwn(group,unit)) || {[unit]:1}
// For prose-only keys, offer a short cloze taken from the actual worked sentence
// in both languages. It checks the missing term, never the student's entire argument.
const concepts=[
 ['elastic','مرن','elastic collision','مرنة'],['stationary','ساكن','at rest','سكون'],['zero','صفر','0','صفرًا'],
 ['positive','موجب','موجبة'],['negative','سالب','سالبة'],['constant','ثابت','unchanged','ثابتة'],
 ['speed','السرعة','سرعة'],['energy','الطاقة','طاقة'],['work','الشغل','شغل'],['mass','الكتلة','كتلة'],
 ['power','القدرة','قدرة'],['time','الزمن','زمن'],['period','الزمن الدوري','الدور'],
 ['mass distribution','توزيع الكتلة','توزيع الكتل'],['radius','نصف القطر','نصف قطر'],['axis','المحور','محور'],
 ['image','الصورة','صورة'],['light','الضوء','ضوء'],['lens','العدسة','عدسة'],['mirror','المرآة','مرآة'],
 ['virtual','وهمية','virtual image','وهمي'],['real image','حقيقية','real','حقيقي'],['upright','معتدلة','erect','معتدل'],['inverted','مقلوبة','مقلوب'],
 ['momentum','الزخم','زخم'],['impulse','الدفع','دفع'],['velocity','السرعة المتجهة','سرعة متجهة'],['acceleration','التسارع','تسارع'],
 ['displacement','الإزاحة','إزاحة'],['distance','المسافة','مسافة'],['slope','الميل','ميل','gradient'],['area','المساحة','مساحة'],
 ['frequency','التردد','تردد'],['wavelength','الطول الموجي','طول موجي'],['intensity','الشدة','شدة'],['refraction','الانكسار','انكسار'],
 ['reflection','الانعكاس','انعكاس'],['diffraction','الحيود','حيود'],['interference','التداخل','تداخل'],['normal','العمود','العمود المقام'],
 ['torque','العزم','عزم','moment of force'],['inertia','القصور','قصور'],['kinetic energy','طاقة الحركة','الطاقة الحركية'],
 ['photon','الفوتون','فوتون'],['electron','الإلكترون','إلكترون'],['force','القوة','قوة'],['angle','الزاوية','زاوية']
]
const sentences=text=>text.split(/(?<=[.!?؟؛])\s+|\n+/).filter(line=>line.length<=310)
function excerpt(text,term,english){
 const pattern=english?new RegExp('\\b'+term+'\\b','i'):new RegExp(term)
 for(const line of sentences(text)){
  if(pattern.test(line))return line.replace(pattern,' _____ ')
 }
 return null
}
// A matched equality in both source solutions gives a numeric blank without inferring
// that this intermediate quantity is the complete answer to a multipart question.
function calculationGap(q){
 const pattern=/[=≈]\s*([+−-]?\d+(?:\.\d+)?)\s*(m\/s²|m\/s|kg·m²\/s|kg·m²|kg·m\/s|rad\/s²|rad\/s|N·m|N·s|eV|nm|mm|cm|km|rad|Hz|kg|m|s|J|N|°)(?![A-Za-z/²³·])/g
 function candidates(text){
  return sentences(text).flatMap(line=>[...line.matchAll(pattern)].map(m=>({
   value:Number(m[1].replace('−','-')),unit:m[2],
   label:line.slice(0,m.index)+m[0].replace(m[1],' _____ ')+line.slice(m.index+m[0].length)
  })))
 }
 const english=candidates(q.solution_en),arabic=candidates(q.solution_ar)
 for(const en of english.reverse()){
  const ar=arabic.find(x=>x.value===en.value && x.unit===en.unit)
  if(ar)return {en:en.label,ar:ar.label,value:en.value,unit:en.unit}
 }
 return null
}
function markingId(q){
 return q.kind===q.original_kind && !shortChecks[q.id] && !q.revised_content ? q.base_id : q.id
}
function gapFor(q){
 if(q.kind!=='FRQ'||keyed[markingId(q)])return null
 if(shortChecks[markingId(q)])return shortChecks[markingId(q)]
 const calculation=calculationGap(q)
 if(calculation)return calculation
 for(const [en,ar,...aliases] of concepts){
  const textEn=excerpt(q.solution_en,en,true),textAr=excerpt(q.solution_ar,ar,false)
  if(textEn && textAr)return {en:textEn,ar:textAr,terms:[en,ar,...aliases]}
 }
 return null
}
export function fieldsFor(q,allowGap=true){
 if(keyed[markingId(q)])return keyed[markingId(q)].map(([en,ar,,unit])=>({en,ar,unit,units:Object.keys(scales(unit))}))
 const gap=(allowGap || shortChecks[markingId(q)]) && gapFor(q)
 if(!gap)return []
 return [{en:gap.en,ar:gap.ar,cloze:!!gap.terms,unit:gap.unit,units:gap.unit?Object.keys(scales(gap.unit)):[]}]
}
export function unpack(value){
 try{const v=JSON.parse(value);if(v?.format==='math-v1' && Array.isArray(v.parts))return v}catch{}
 return {format:'math-v1',parts:[],text:String(value||''),latex:''}
}
const normalized=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[إأآ]/g,'ا').replace(/[\s.,،؛;:!?؟]+/g,' ').trim()
export function coach(q,response){
 const draft=unpack(response)
 const gap=gapFor(q)
 const numerical=keyed[markingId(q)] || (gap && !gap.terms && (draft.parts.length || draft.latex || draft.text) ? [[gap.en,gap.ar,gap.value,gap.unit]] : [])
 const parts=numerical.map(([, ,expected,unit,tolerance=0.005],i)=>{
  const item=draft.parts[i] || (numerical.length===1 ? {value:draft.latex||draft.text,unit} : null)
  if(!item?.value)return 'empty'
  const u=scales(unit)
  let expression=String(item.value).trim().replace(/\\(?:mathrm|text)\{([^{}]+)\}/g,' $1').replace(/\\[,;]/g,' ').trim()
  let inputUnit=item.unit
  for(const suffix of Object.keys(u).filter(Boolean).sort((a,b)=>b.length-a.length)){
   if(expression.endsWith(suffix)){
    inputUnit=suffix
    expression=expression.slice(0,-suffix.length).trim()
    break
   }
  }
  if (!Object.hasOwn(u,inputUnit))return 'unit'
  const value=numericValue(expression)*u[inputUnit]/u[unit]
  if(!Number.isFinite(value))return 'expression'
  const near=v=>Math.abs(v-expected)<=Math.abs(expected)*tolerance
  if(near(value))return 'correct'
  if(near(-value))return 'sign'
  if(value && expected && [2,3,6,9].some(n=>Math.abs(Math.abs(Math.log10(Math.abs(value/expected)))-n)<0.002))return 'scale'
  return 'retry'
 })
 if(gap?.terms && (draft.parts.length || draft.text || draft.latex)){
  const raw=normalized(draft.parts[0]?.value || draft.text || draft.latex).replace(/^the /,'').replace(/^ال/,'')
  parts.push(!raw?'empty':gap.terms.some(term=>normalized(term).replace(/^ال/,'')===raw)?'correct':'term')
 }
 const exact=[q.solution_en,q.solution_ar,q.answer==='See worked solution'?'':q.answer].some(v=>v&&normalized(v)===normalized(draft.text||draft.latex))
 return {parts,exact}
}
