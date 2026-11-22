// teacher line of the watermark; put the teacher's phone number in teacherPhone (e.g. '0791234567') to show it beside the name
export const teacherPhone='';
export const watermarkText=['استاذ احمد غرايبة',teacherPhone].filter(Boolean).join(' · ');
const clean=v=>String(v??'').replace(/[<>&"'\u202A-\u202E\u2066-\u2069]/g,'').trim();
const stamp=iso=>{const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
// Deterrent against photos/screenshots of questions (teacher request 2026-11-14): a phone camera cannot be blocked by a web
// page, so every question carries the signed-in student's name, contact number and sign-in time; a leaked photo shows its source.
export const watermarkIdentity=session=>{if(!session?.name)return '';return [clean(session.name),stamp(session.startedAt)].filter(Boolean).join(' · ')};
const who=()=>{try{return watermarkIdentity(JSON.parse(globalThis.sessionStorage?.getItem('physics-profile')||'null'))}catch{return ''}};
const ltrNumbers=t=>t.replace(/\d[\d:\- ]*\d/g,m=>`<bdi dir="ltr">${m}</bdi>`);   // phone and date keep their order inside Arabic text
// rows alternate student identity / teacher line; the identity is isolated (LTR digits inside RTL text stay in order)
export const questionWatermark=()=>{const w=who();const rows=w?[w,watermarkText,w,watermarkText,w]:[watermarkText,watermarkText,watermarkText];return `<div class="question-watermark${w?' has-student':''}" aria-hidden="true">${rows.map(t=>`<span lang="ar" dir="rtl"><bdi>${ltrNumbers(t)}</bdi></span>`).join('')}</div>`};
export const watermarkCss=`
.watermarked-question,.worksheet-print-page,.card,.visual-gallery{position:relative;isolation:isolate}
.watermarked-question{min-height:200px}
.question-watermark{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;justify-content:space-around;align-items:center;pointer-events:none;user-select:none;overflow:hidden;opacity:.12;color:#243e37;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.question-watermark>span{display:block;flex-shrink:0;white-space:nowrap;font:600 clamp(14px,2.2vw,25px)/1.8 Arial,Tahoma,sans-serif;transform:rotate(-24deg);text-align:center}
.worksheet-print-page>.question-watermark{opacity:.13}
.worksheet-print-page>.question-watermark>span{font-size:23pt}
.card>.question-watermark>span{font-size:15px}
.question-watermark.has-student>span{font-size:clamp(12px,1.8vw,20px);line-height:1.5}
.question-watermark.has-student>span:nth-child(odd){font-weight:700}
@media(max-width:640px){.question-watermark.has-student>span{white-space:normal;max-width:85%;font-size:13px}}
@media print{.question-watermark{display:flex!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
`;
