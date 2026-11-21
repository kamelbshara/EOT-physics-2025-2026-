let language = 'en'
try {if(localStorage.getItem('physics-language')==='ar') language='ar'} catch {}
export const lang = () => language
export const t = (en, ar) => language==='en' ? en : ar
export function changeLanguage() {
  language=t('ar','en')
  try {localStorage.setItem('physics-language',language)} catch {}
  applyLanguage()
}
export function applyLanguage() {
  document.documentElement.lang=language
  document.documentElement.dir=t('ltr','rtl')
  document.title=t('Haykal100 · Physics with Ahmad Gharaibeh','Haykal100 في الفيزياء مع استاذ احمد غرايبة')
  for(const el of document.querySelectorAll('[data-ar]')){
    el.dataset.en??=el.textContent
    el.textContent=t(el.dataset.en,el.dataset.ar)
  }
  for(const el of document.querySelectorAll('[data-switch]')){
    el.textContent=t('العربية','English')
    el.lang=t('ar','en')
  }
  const labels={studyTabs:t('Study bookmarks','علامات المراجعة'), examplesTab:t('Solution guide','دليل الحل'), lawsTab:t('Physics law sheet','ورقة قوانين الفيزياء'),gradeTabs:t('Grade','الصف'), 'calculator-close':t('Close','إغلاق'), 'calculator-dock-left':t('Dock left','تثبيت يسارًا'), 'calculator-dock-right':t('Dock right','تثبيت يمينًا')}
  for(const [id,label] of Object.entries(labels))document.getElementById(id).setAttribute('aria-label',label)
  const cover=document.querySelector('.shield-cover')
  if(cover){
    cover.querySelector('strong').textContent=t('Content protected','المحتوى محمي')
    cover.querySelector('span').textContent=t('Return to this page to continue studying.','عُد إلى هذه الصفحة لمتابعة الدراسة')
  }
}
const errors={
 'طلب غير صالح':'Invalid request.',
 'تحقق من اسم الطالب والمدرسة':'Enter your name and school (at least two characters each).',
 'انتهت جلسة التدريب. حدّث الصفحة وسجّل الدخول للمتابعة.':'Your session has expired. Refresh and check in to continue.',
 'الصورة غير متاحة':'Figure unavailable.', 'أكمل الاختبار الحالي أولاً':'Finish your current mock first.',
 'تحقق من جلسة الاختبار':'Reopen the current mock exam.', 'إجابة غير صالحة':'Invalid answer.',
 'أدخل إجابتك أولاً':'Enter your answer first.', 'غير متاح':'Unavailable.'
}
export const errorText = message => t(errors[message]||message,message)
