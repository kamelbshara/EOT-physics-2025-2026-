import { lang, t } from './language.js'
let loading
function loadMath(){
 loading??=import('./vendor/mathlive/mathlive.min.mjs').then(({MathfieldElement})=>{
  MathfieldElement.fontsDirectory=new URL('./vendor/mathlive/fonts/',import.meta.url).href
  MathfieldElement.soundsDirectory=null
 })
 return loading
}
export function parseDraft(value){
 try{const parsed=JSON.parse(value);if(parsed?.format==='math-v1' && Array.isArray(parsed.parts))return parsed}catch{}
 return {format:'math-v1',parts:[],text:value||'',latex:''}
}
export function hasResponse(value){
 const d=parseDraft(value)
 return Boolean(d.text?.trim()||d.latex?.trim()||d.parts.some(p=>p?.value?.trim()))
}
function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n}
export function writtenEditor(parent,question,value,readOnly,save){
 const draft=parseDraft(value),fields=question.fields||[]
 const changed=()=>save(JSON.stringify(draft))
 let active
 const toolbar=node('div');toolbar.className='math-tools'
 const makeField=(initial,label,update)=>{
  const field=node('math-field');field.setAttribute('aria-label',label);field.dir='ltr'
  // Initial text is upgraded by MathLive when its lazy module loads.
  field.textContent=initial||'';if(readOnly)field.setAttribute('read-only','')
  field.addEventListener('focus',()=>{active=field})
  field.addEventListener('input',()=>update(field.value))
  active??=field;return field
 }
 for(const [title,template] of [['a/b','\\frac{#@}{#?}'],['x²','{#@}^{2}'],['xⁿ','{#@}^{#?}'],['√','\\sqrt{#@}'],['π','\\pi'],['×10ⁿ','\\times10^{#?}']]){
  const b=node('button',title);b.type='button';b.onpointerdown=e=>e.preventDefault()
  b.onclick=async()=>{await loadMath();if(!active)return;const panel=active.closest('details');if(panel)panel.open=true;active.focus();active.insert(template,{selectionMode:'placeholder'})};toolbar.append(b)
 }
 if(!readOnly)parent.append(toolbar)
 fields.forEach((f,i)=>{
  const item=draft.parts[i]||{value:'',unit:f.unit||''}
  const line=node('div');line.className='answer-line';const label=node('label',f[lang()]);const id='answer-part-'+i;label.htmlFor=id
  const update=v=>{item.value=v;draft.parts[i]=item;changed()}
  let field
  if(f.cloze){field=node('input');field.value=item.value;field.dir='auto';field.disabled=readOnly;field.oninput=()=>update(field.value)}
  else field=makeField(item.value,f[lang()],update)
  field.id=id;line.append(label,field)
  if(f.unit){
   const unit=node('select');unit.setAttribute('aria-label',t('Answer unit','وحدة الإجابة'));unit.disabled=readOnly
   for(const u of f.units){const o=node('option',u);o.value=u;unit.append(o)}
   unit.value=item.unit;unit.onchange=()=>{item.unit=unit.value;draft.parts[i]=item;changed()};line.append(unit)
  }
  parent.append(line)
 })
 const extra=node('details');extra.open=!fields.length||Boolean(draft.text||draft.latex)
 extra.append(node('summary',t('Your answer · text or maths','إجابتك · نص أو رموز رياضية')))
 const note=node('textarea');note.placeholder=t('Type a short answer','اكتب جوابًا قصيرًا');note.setAttribute('aria-label',note.placeholder);note.value=draft.text;note.disabled=readOnly;note.dir='auto'
 note.oninput=()=>{draft.text=note.value;changed()}
 extra.append(note,makeField(draft.latex,t('Mathematical answer','الإجابة الرياضية'),v=>{draft.latex=v;changed()}));parent.append(extra)
 void loadMath().then(()=>{for(const field of parent.querySelectorAll('math-field'))field.mathVirtualKeyboardPolicy='manual'}).catch(()=>{for(const field of parent.querySelectorAll('math-field')){const input=node('input');input.placeholder='LaTeX';input.value=field.textContent;input.disabled=readOnly;input.oninput=()=>{field.value=input.value;field.dispatchEvent(new Event('input'))};field.replaceWith(input)}})
}
