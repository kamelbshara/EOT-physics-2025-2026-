// Student side of the solution notebook, the notebook list and "ask the teacher".
import { createSketchpad } from './sketchpad.js'
import { t, lang } from './language.js'
import { apiOrigin } from './api-config.js'

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n }
function btn(label, onclick, cls = '') { const b = el('button', cls, label); b.type = 'button'; b.onclick = onclick; return b }
const statusLabel = s => ({ draft: t('Draft', 'مسودة'), submitted: t('Sent to the teacher', 'أُرسل للمعلم'), reviewed: t('Reviewed', 'تمت المراجعة'), revise: t('Needs changes', 'يحتاج تعديل') })[s] || s
const when = ms => new Date(ms).toLocaleString(lang() === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

function dialogShell(id, cls) {
  let d = document.getElementById(id)
  if (!d) { d = el('dialog', cls); d.id = id; document.body.append(d) }
  d.replaceChildren()
  d.dir = lang() === 'ar' ? 'rtl' : 'ltr'
  return d
}

// ------------------------------------------------------------ notebook for one question (or a free page)
export async function openNotebook({ api, question = null, pageId = null }) {
  const d = dialogShell('notebookDialog', 'notebook-dialog')
  const all = await api('notebook')
  let pages = question ? all.filter(p => p.question === question.id) : pageId ? all.filter(p => p.id === pageId) : []
  let page = null, sketch = null, saveTimer = null, saving = Promise.resolve()
  const storeKey = () => 'physics-notebook-' + (page?.id || 'new-' + (question?.id || 'free'))

  const head = el('header', 'nb-head')
  const title = el('div', 'nb-title')
  title.append(el('small', '', t('Solution notebook', 'دفتر الحل')), el('strong', '', question ? (question[lang()] || '').slice(0, 140) : t('Free page', 'صفحة حرة')))
  const pageSelect = el('select', 'sk-select'); pageSelect.setAttribute('aria-label', t('Page', 'الصفحة'))
  const status = el('span', 'nb-status')
  const saved = el('span', 'nb-saved')
  const figureToggle = el('label', 'nb-figure')
  const figureBox = el('input'); figureBox.type = 'checkbox'
  figureToggle.append(figureBox, el('span', '', t('Question figure', 'صورة السؤال')))
  figureToggle.hidden = !question?.images?.length
  const actions = el('div', 'nb-actions')
  const submit = btn(t('Send to teacher', 'أرسل للمعلم'), () => submitPage(), 'primary')
  actions.append(
    btn('▶ ' + t('Replay', 'إعادة التشغيل'), () => sketch?.replay(3)),
    btn('⤓ PNG', () => { const a = el('a'); a.href = sketch.toPNG(); a.download = 'notebook.png'; a.click() }),
    submit,
    btn(t('Close', 'إغلاق'), () => close()))
  const pagesBox = el('div', 'nb-pages')
  pagesBox.append(pageSelect, btn('+ ' + t('New page', 'صفحة جديدة'), () => load(null)))
  head.append(title, pagesBox, figureToggle, status, saved, actions)
  const body = el('div', 'nb-body')
  const surface = el('div', 'nb-surface')
  const side = el('aside', 'nb-side')
  body.append(surface, side)
  d.append(head, body)
  if (!d.open) d.showModal()

  function fillPages() {
    pageSelect.replaceChildren(...pages.map((p, i) => { const o = el('option', '', t('Page ', 'صفحة ') + (i + 1) + ' · ' + statusLabel(p.status)); o.value = p.id; return o }))
    if (!pages.length) { const o = el('option', '', t('Page 1', 'صفحة 1')); o.value = ''; pageSelect.append(o) }
    pageSelect.value = page?.id || ''
  }
  pageSelect.onchange = () => pageSelect.value && load(pageSelect.value)

  function setSaved(text, state) { saved.textContent = text; saved.dataset.state = state }
  function renderSide() {
    side.replaceChildren()
    status.textContent = page ? statusLabel(page.status) : statusLabel('draft'); status.dataset.status = page?.status || 'draft'
    submit.disabled = !page || page.status === 'submitted'
    submit.textContent = page?.status === 'reviewed' || page?.status === 'revise' ? t('Send again', 'أرسل مجددًا') : t('Send to teacher', 'أرسل للمعلم')
    const review = page?.review
    const box = el('section', 'nb-feedback')
    box.append(el('h3', '', t('Teacher feedback', 'ملاحظات المعلم')))
    if (review?.score) box.append(el('p', 'nb-score', t('Score: ', 'الدرجة: ') + review.score))
    if (review?.annotations?.length) box.append(el('p', 'nb-hint', t('Red marks on the page are your teacher’s corrections.', 'العلامات الحمراء على الصفحة هي تصحيحات المعلم.')))
    const thread = el('ol', 'nb-thread')
    for (const c of page?.comments || []) { const li = el('li'); li.dataset.author = c.author; li.append(el('b', '', c.author === 'teacher' ? t('Teacher', 'المعلم') : t('You', 'أنت')), el('p', '', c.body), el('small', '', when(c.created))); thread.append(li) }
    if (!page?.comments?.length && !review) box.append(el('p', 'nb-hint', t('Write your solution, then send it to your teacher for review.', 'اكتب حلك ثم أرسله للمعلم ليراجعه.')))
    box.append(thread)
    if (page) {
      const form = el('form', 'nb-comment')
      const ta = el('textarea'); ta.placeholder = t('Write a note to your teacher', 'اكتب ملاحظة للمعلم'); ta.dir = 'auto'; ta.maxLength = 1500
      form.append(ta, btn(t('Send note', 'أرسل الملاحظة'), async () => { if (!ta.value.trim()) return; page = { ...page, ...(await api('notebook/comment', { id: page.id, body: ta.value })) }; renderSide() }))
      box.append(form)
    }
    side.append(box)
  }

  async function load(id) {
    clearTimeout(saveTimer); await saving
    sketch?.destroy()
    page = id ? await api('notebook/page/' + id) : null
    let strokes = page?.strokes || []
    try { const local = JSON.parse(localStorage.getItem(storeKey()) || 'null'); if (local && (!page || local.version >= page.version) && local.strokes.length >= strokes.length) strokes = local.strokes } catch {}
    const layers = [{ name: 'student', strokes, editable: true }, { name: 'teacher', strokes: page?.review?.annotations || [], editable: false }]
    const background = page?.background || (question?.images?.length ? 'blank+figure:0' : 'grid')
    figureBox.checked = background.includes('+figure')
    const figureUrl = question?.images?.length ? apiOrigin + '/api/figure/' + question.id + '/question/0' : null
    const make = bg => {
      sketch?.destroy()
      sketch = createSketchpad(surface, { layers, background: bg, figureUrl: bg.includes('+figure') ? figureUrl : null, onChange: () => schedule() })
      sketch.layers = layers
    }
    make(background)
    figureBox.onchange = () => { make(sketch.background.split('+')[0] + (figureBox.checked ? '+figure:0' : '')); schedule() }
    fillPages(); renderSide()
    setSaved(page ? t('Saved', 'محفوظ') : '', 'ok')
  }
  function schedule() {
    setSaved(t('Saving…', 'جارٍ الحفظ…'), 'busy')
    try { localStorage.setItem(storeKey(), JSON.stringify({ strokes: sketch.layers[0].strokes, version: (page?.version || 0) + 1 })) } catch {}
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { saving = saving.then(save).catch(() => setSaved(t('Offline · saved on this device', 'غير متصل · محفوظ على الجهاز'), 'warn')) }, 900)
  }
  async function save() {
    const strokes = sketch.layers[0].strokes
    const res = await api('notebook/save', { id: page?.id, question: question?.id, background: sketch.background, strokes, version: page?.version || 0 })
    const wasNew = !page
    page = { ...(page || { status: 'draft', comments: [], review: null }), id: res.id, version: res.version, background: sketch.background, strokes }
    try { localStorage.removeItem('physics-notebook-new-' + (question?.id || 'free')); localStorage.setItem(storeKey(), JSON.stringify({ strokes, version: res.version })) } catch {}
    if (wasNew) { pages = [...pages, { id: res.id, status: 'draft' }]; fillPages(); renderSide() }
    setSaved(t('Saved', 'محفوظ'), 'ok')
  }
  async function submitPage() {
    clearTimeout(saveTimer); await saving; await save()
    page = await api('notebook/submit', { id: page.id })
    pages = pages.map(p => p.id === page.id ? { ...p, status: page.status } : p)
    fillPages(); renderSide()
  }
  async function close() { clearTimeout(saveTimer); if (sketch && saved.dataset.state === 'busy') { await saving; try { await save() } catch {} } sketch?.destroy(); d.close() }
  d.addEventListener('cancel', e => { e.preventDefault(); close() }, { once: true })
  await load(pageId || pages.at(-1)?.id || null)
}

// ------------------------------------------------------------ all pages
export async function openNotebookList({ api }) {
  const d = dialogShell('notebookList', 'hub-dialog')
  const pages = await api('notebook')
  d.append(el('h2', '', t('My notebook', 'دفتري')))
  const list = el('ul', 'nb-list')
  if (!pages.length) list.append(el('li', 'nb-empty', t('No pages yet. Open a question and press “Solution notebook”.', 'لا توجد صفحات بعد. افتح سؤالًا واضغط «دفتر الحل».')))
  for (const p of pages) {
    const li = el('li'); li.dataset.status = p.status
    const open = btn((p.question || t('Free page', 'صفحة حرة')) + ' · ' + statusLabel(p.status) + (p.unread ? ' · ' + t('new note', 'ملاحظة جديدة') : ''), async () => {
      d.close()
      const full = await api('notebook/page/' + p.id)
      const q = full.questionText ? { id: full.question, en: full.questionText.en, ar: full.questionText.ar, images: Array.from({ length: full.questionText.figures }) } : null
      await openNotebook({ api, pageId: p.id, question: q })
    })
    li.append(open, el('small', '', when(p.updated))); list.append(li)
  }
  d.append(list, el('div', 'tools'))
  d.lastChild.append(btn('+ ' + t('Free page', 'صفحة حرة'), async () => { d.close(); await openNotebook({ api }) }), btn(t('Close', 'إغلاق'), () => d.close()))
  if (!d.open) d.showModal()
}

// ------------------------------------------------------------ ask the teacher
export async function openAsk({ api, question = null }) {
  const d = dialogShell('askDialog', 'hub-dialog')
  const threads = await api('ask')
  d.append(el('h2', '', t('Ask your teacher', 'اسأل المعلم')))
  const form = el('form', 'ask-form')
  const ta = el('textarea'); ta.placeholder = question ? t('What is unclear in this question?', 'ما الذي لم يتضح لك في هذا السؤال؟') : t('Write your question', 'اكتب سؤالك'); ta.dir = 'auto'; ta.maxLength = 1500
  const sent = el('p', 'ask-sent')
  form.append(question ? el('small', '', t('About: ', 'بخصوص: ') + (question[lang()] || '').slice(0, 120)) : '', ta, sent)
  form.append(btn(t('Send', 'أرسل'), async () => { if (!ta.value.trim()) return; await api('ask', { body: ta.value, question: question?.id }); ta.value = ''; sent.textContent = t('Sent. Your teacher’s reply will appear here.', 'تم الإرسال. سيظهر رد المعلم هنا.'); setTimeout(() => { if (d.open) openAsk({ api, question }) }, 600) }, 'primary'))
  d.append(form)
  if (threads.length) {
    d.append(el('h3', '', t('My questions', 'أسئلتي')))
    const list = el('ol', 'nb-thread')
    for (const r of threads) {
      const li = el('li'); li.dataset.author = 'student'
      li.append(el('b', '', (r.question ? r.question + ' · ' : '') + when(r.created)), el('p', '', r.body))
      for (const x of r.replies) { const reply = el('div', 'ask-reply'); reply.dataset.author = x.author; reply.append(el('b', '', x.author === 'teacher' ? t('Teacher', 'المعلم') : t('You', 'أنت')), el('p', '', x.body)); li.append(reply) }
      if (!r.replies.some(x => x.author === 'teacher')) li.append(el('small', '', t('Waiting for a reply', 'بانتظار الرد')))
      list.append(li)
    }
    d.append(list)
  }
  d.append(btn(t('Close', 'إغلاق'), () => d.close()))
  if (!d.open) d.showModal()
}
