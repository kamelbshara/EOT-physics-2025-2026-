// Teacher dashboard: overview, students, classes, tests, notebook review, student questions and marking rubrics.
import { apiOrigin } from './api-config.js'
import { createSketchpad } from './sketchpad.js'

const $ = id => document.getElementById(id)
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n }
function btn(label, onclick, cls = '') { const b = el('button', cls, label); b.type = 'button'; b.onclick = async e => { try { await onclick(e) } catch (err) { toast(err.message, true) } }; return b }
async function api(path, body) {
  const res = await fetch(apiOrigin + '/api/admin/' + path, { credentials: 'include', ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
  if (res.status === 401 && path !== 'login') { showLogin(); throw Error('سجّل الدخول مجددًا') }
  if (!res.ok) throw Error((await res.json().catch(() => ({}))).error || 'تعذّر الاتصال')
  return res.json()
}
function toast(msg, bad) { const n = el('div', 'toast' + (bad ? ' bad' : ''), msg); document.body.append(n); setTimeout(() => n.remove(), 3200) }
const date = ms => ms ? new Date(ms).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const pct = v => v === null || v === undefined ? '—' : v + '%'
const statusAr = { draft: 'مسودة', submitted: 'بانتظار المراجعة', reviewed: 'تمت المراجعة', revise: 'يحتاج تعديل' }
const levelAr = { new: 'لم يبدأ', weak: 'ضعيف', developing: 'متوسط', mastered: 'متقن' }
let cards = [], classes = []

// ------------------------------------------------------------ shell
const TABS = [['overview', 'نظرة عامة'], ['students', 'الطلاب'], ['classes', 'الصفوف'], ['tests', 'الاختبارات'], ['notebooks', 'الدفاتر'], ['inbox', 'أسئلة الطلاب'], ['rubrics', 'قوائم التصحيح']]
let tab = 'overview'
function showLogin() { $('shell').hidden = true; $('loginView').hidden = false }
async function start() {
  try { await api('overview') } catch { showLogin(); return }
  $('loginView').hidden = true; $('shell').hidden = false
  cards = await api('cards'); classes = await api('classes')
  renderTabs(); go(location.hash.slice(1) || 'overview')
}
function renderTabs(counts = {}) {
  $('tabs').replaceChildren(...TABS.map(([id, label]) => { const b = btn(label, () => go(id)); b.setAttribute('aria-pressed', id === tab); if (counts[id]) b.append(el('em', 'count', String(counts[id]))); return b }))
}
async function go(id, ...args) {
  tab = TABS.some(x => x[0] === id) ? id : 'overview'; location.hash = tab
  const o = await api('overview'); renderTabs({ notebooks: o.pendingNotebooks, inbox: o.unreadQuestions })
  const view = $('view'); view.replaceChildren(el('p', 'muted', 'جارٍ التحميل…'))
  await ({ overview, students, classesView, tests, notebooks, inbox, rubrics })[{ classes: 'classesView' }[tab] || tab](view, o, ...args)
}
$('adminLogin').onsubmit = async e => {
  e.preventDefault()
  try { await api('login', { password: $('adminPassword').value }); $('adminError').textContent = ''; start() } catch (err) { $('adminError').textContent = err.message }
}
$('adminLogout').onclick = async () => { await api('logout', {}); showLogin() }

// ------------------------------------------------------------ overview
async function overview(view, o) {
  view.replaceChildren(el('h1', '', 'نظرة عامة'))
  const stats = el('div', 'stats')
  for (const [v, l] of [[o.students, 'طالب مسجّل'], [o.activeToday, 'نشط آخر 24 ساعة'], [o.checksToday, 'إجابة مصحّحة اليوم'], [o.pendingNotebooks, 'دفتر بانتظار المراجعة'], [o.unreadQuestions, 'سؤال جديد من الطلاب'], [o.classes, 'صف'], [o.tests, 'اختبار']]) { const s = el('div', 'stat'); s.append(el('b', '', String(v)), el('small', '', l)); stats.append(s) }
  view.append(stats, el('h2', '', 'أضعف المؤشرات (كل الطلاب)'))
  if (!o.weakest.length) view.append(el('p', 'muted', 'لا توجد بيانات كافية بعد.'))
  else view.append(table(['المؤشر', 'الوصف', 'متوسط الطلاب', 'عدد المحاولات'], o.weakest.map(w => [w.lo, w.ar || w.en, pct(w.average), w.attempts])))
  const exp = el('a', 'button-link', '⤓ تصدير بيانات الطلاب (Excel/CSV)'); exp.href = apiOrigin + '/api/admin/export/students.csv'; view.append(exp)
}
function table(head, rows, onRow) {
  const t = el('table'); const tr = el('tr'); for (const h of head) tr.append(el('th', '', h)); const thead = el('thead'); thead.append(tr); t.append(thead)
  const tb = el('tbody')
  rows.forEach((r, i) => { const row = el('tr'); for (const c of r) { const td = el('td'); c instanceof Node ? td.append(c) : td.textContent = c ?? '—'; row.append(td) } if (onRow) { row.tabIndex = 0; row.classList.add('clickable'); row.onclick = () => onRow(i); row.onkeydown = e => e.key === 'Enter' && onRow(i) } tb.append(row) })
  t.append(tb); const wrap = el('div', 'table-wrap'); wrap.append(t); return wrap
}

// ------------------------------------------------------------ students
async function students(view, o, focus) {
  view.replaceChildren(el('h1', '', 'الطلاب'))
  const filters = el('div', 'filters')
  const cls = el('select'); cls.append(new Option('كل الصفوف', '')); for (const c of classes) cls.append(new Option(c.name + ' · ' + c.code, c.code))
  const search = el('input'); search.placeholder = 'بحث بالاسم أو الرمز'
  filters.append(cls, search)
  const holder = el('div')
  view.append(filters, holder)
  let rows = []
  const draw = () => {
    const q = search.value.trim().toLowerCase()
    const list = rows.filter(r => !q || r.name.toLowerCase().includes(q) || (r.code || '').includes(q))
    holder.replaceChildren(table(['الاسم', 'المدرسة', 'رمز الطالب', 'الصف', 'أسئلة محلولة', 'المتوسط', 'أيام متتالية', 'آخر نشاط'], list.map(r => [r.name, r.school, r.code, r.classCode, r.answered, pct(r.average), r.streak, date(r.lastActive)]), i => studentDetail(view, list[i].id)))
  }
  const load = async () => { rows = await api('students' + (cls.value ? '?class=' + cls.value : '')); draw() }
  cls.onchange = load; search.oninput = draw
  await load()
  if (focus) studentDetail(view, focus)
}
async function studentDetail(view, id) {
  const s = await api('student/' + id)
  view.replaceChildren(btn('← كل الطلاب', () => go('students')), el('h1', '', s.name))
  const meta = el('div', 'meta')
  meta.append(el('span', '', 'المدرسة: ' + s.school), el('span', '', 'رمز الطالب: ' + (s.code || '—')), el('span', '', 'النقاط: ' + s.points), el('span', '', 'أيام متتالية: ' + s.streak), el('span', '', 'أخطاء قيد المراجعة: ' + s.mistakes))
  const manage = el('div', 'filters')
  const cls = el('select'); cls.append(new Option('بدون صف', '')); for (const c of classes) cls.append(new Option(c.name + ' · ' + c.code, c.code)); cls.value = s.classCode || ''
  cls.onchange = async () => { await api('student/class', { student: id, classCode: cls.value }); toast('تم تغيير الصف') }
  manage.append(el('label', '', 'الصف: '), cls)
  view.append(meta, manage)
  // mastery
  view.append(el('h2', '', 'خريطة الإتقان'))
  for (const g of [9, 10, 11, 12]) {
    const group = cards.filter(c => c.grade === g)
    if (!group.some(c => s.mastery[c.id]?.done)) continue
    const row = el('div', 'mastery'); row.append(el('strong', '', 'الصف ' + g))
    const grid = el('div', 'grid20')
    for (const c of group) { const m = s.mastery[c.id]; const cell = el('span', 'cell', String(c.slot)); cell.dataset.level = m.level; cell.title = (c.ar || c.en) + ' — ' + levelAr[m.level] + ' ' + Math.round(m.score * 100) + '%'; grid.append(cell) }
    row.append(grid); view.append(row)
  }
  view.append(el('div', 'legend', 'رمادي: لم يبدأ · أحمر: ضعيف · أصفر: متوسط · أخضر: متقن'))
  // tests
  view.append(el('h2', '', 'الاختبارات التجريبية والمعيّنة'))
  view.append(s.mocks.length ? table(['الاختبار', 'الصف', 'الدرجة', 'الحالة'], s.mocks.map(m => [m.title ? m.title.split('|').pop() : 'اختبار الهيكل', m.grade, m.score + '/' + m.total, m.done ? 'منتهٍ' : 'جارٍ'])) : el('p', 'muted', 'لا توجد اختبارات.'))
  // written answers with override
  view.append(el('h2', '', 'الإجابات المقالية (التصحيح التلقائي وتصحيح المعلم)'))
  if (!s.written.length) view.append(el('p', 'muted', 'لا توجد إجابات مقالية بعد.'))
  for (const w of s.written) {
    const card = el('article', 'written')
    card.append(el('small', '', w.question + ' · ' + w.lo), el('p', 'q', w.ar || w.en))
    const ans = el('pre', 'answer'); ans.textContent = [...(w.response.parts || []).map(p => p?.value ? p.value + ' ' + (p.unit || '') : ''), w.response.text, w.response.latex].filter(Boolean).join('\n') || '—'; ans.dir = 'auto'
    card.append(ans)
    const auto = el('p', 'auto', w.auto ? `التصحيح التلقائي: ${w.auto.score}/${w.auto.total}` : 'لا يوجد تصحيح تلقائي')
    const form = el('div', 'override')
    const score = el('input'); score.type = 'number'; score.min = 0; score.step = 0.5; score.placeholder = 'الدرجة'; score.value = w.teacher?.score ?? ''
    const total = el('input'); total.type = 'number'; total.min = 1; total.step = 0.5; total.placeholder = 'من'; total.value = w.teacher?.total ?? w.auto?.total ?? 1
    const note = el('input'); note.placeholder = 'ملاحظة للطالب (اختياري)'; note.value = w.teacher?.note || ''
    form.append(el('span', '', 'تصحيح المعلم:'), score, el('span', '', '/'), total, note,
      btn('حفظ', async () => { await api('grade', { student: id, question: w.question, score: score.value, total: total.value, note: note.value }); toast('حُفظ تصحيح المعلم') }, 'primary'),
      btn('اعتماد التلقائي', async () => { await api('grade', { student: id, question: w.question, score: null }); score.value = ''; note.value = ''; toast('أُلغي تصحيح المعلم') }))
    card.append(auto, form); view.append(card)
  }
  // notebook pages
  view.append(el('h2', '', 'صفحات الدفتر'))
  view.append(s.pages.length ? table(['السؤال', 'الحالة', 'آخر تعديل'], s.pages.map(p => [p.question || 'صفحة حرة', statusAr[p.status], date(p.updated)]), i => reviewPage(view, s.pages[i].id)) : el('p', 'muted', 'لا توجد صفحات.'))
  view.append(el('h2', '', 'الأوسمة'), el('p', '', s.badges.filter(b => b.earned).map(b => '🏅 ' + b.ar).join('  ') || '—'))
}

// ------------------------------------------------------------ classes
async function classesView(view) {
  classes = await api('classes')
  view.replaceChildren(el('h1', '', 'الصفوف'), el('p', 'muted', 'أنشئ صفًا وأعطِ الطلاب رمزه ليكتبوه عند التسجيل. يمكن تفعيل لوحة الترتيب لكل صف.'))
  const form = el('div', 'filters')
  const name = el('input'); name.placeholder = 'اسم الصف (مثال: 10 متقدم أ)'
  const grade = el('select'); grade.append(new Option('أي صف', '')); for (const g of [9, 10, 11, 12]) grade.append(new Option('الصف ' + g, g))
  form.append(name, grade, btn('إنشاء صف', async () => { const r = await api('classes', { name: name.value, grade: grade.value }); toast('رمز الصف: ' + r.code); classesView(view) }, 'primary'))
  view.append(form)
  view.append(table(['الصف', 'الرمز', 'المرحلة', 'الطلاب', 'لوحة الترتيب', ''], classes.map(c => {
    const toggle = el('input'); toggle.type = 'checkbox'; toggle.checked = Boolean(c.leaderboard); toggle.onchange = async () => { await api('classes/leaderboard', { code: c.code, on: toggle.checked }); toast(toggle.checked ? 'فُعّلت لوحة الترتيب' : 'أُوقفت لوحة الترتيب') }
    const code = el('b', 'code', c.code)
    return [c.name, code, c.grade ? 'الصف ' + c.grade : '—', c.students, toggle, btn('حذف', async () => { if (confirm('حذف الصف؟ يبقى الطلاب دون صف.')) { await api('classes/delete', { code: c.code }); classesView(view) } })]
  })))
}

// ------------------------------------------------------------ tests
async function tests(view) {
  const list = await api('tests')
  view.replaceChildren(el('h1', '', 'الاختبارات'), el('p', 'muted', 'أنشئ اختبارًا يغطي كل المؤشرات بنمط سؤال الهيكل نفسه، أو اختر الأسئلة بنفسك، وعيّنه لصف أو لكل الطلاب. يظهر للطالب في «اختباراتي» ويُحل بنظام الاختبار المؤقّت.'))
  const form = el('form', 'test-builder')
  const title = el('input'); title.placeholder = 'عنوان الاختبار'; title.required = true
  const grade = el('select'); for (const g of [9, 10, 11, 12]) grade.append(new Option('الصف ' + g, g))
  const cls = el('select'); cls.append(new Option('كل الطلاب', '')); for (const c of classes) cls.append(new Option(c.name + ' · ' + c.code, c.code))
  const deadline = el('input'); deadline.type = 'datetime-local'
  const mode = el('select'); mode.append(new Option('توليد تلقائي (سؤال لكل مؤشر بنمط الهيكل)', 'auto'), new Option('اختيار الأسئلة يدويًا', 'manual'))
  const per = el('select'); for (const n of [1, 2, 3]) per.append(new Option(n + ' لكل مؤشر', n))
  const kpis = el('fieldset', 'kpi-picks'); const picked = new Set(); const manual = el('div', 'manual'); manual.hidden = true
  const label = (text, input) => { const l = el('label'); l.append(el('span', '', text), input); return l }
  const fillKpis = () => {
    kpis.replaceChildren(el('legend', '', 'المؤشرات (اتركها كلها فارغة لتشمل كل المؤشرات)'))
    manual.replaceChildren(el('p', 'muted', 'اختر مؤشرًا لعرض أسئلته:'))
    const chooser = el('select'); chooser.append(new Option('— المؤشر —', ''))
    for (const c of cards.filter(c => c.grade === Number(grade.value))) {
      const l = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.value = c.id; l.append(cb, el('span', '', c.slot + ' · ' + (c.ar || c.en).slice(0, 70))); kpis.append(l)
      chooser.append(new Option(c.slot + ' · ' + (c.ar || c.en).slice(0, 60), c.id))
    }
    const qbox = el('div', 'qbox'); const count = el('p', 'muted', 'الأسئلة المختارة: 0')
    chooser.onchange = async () => {
      if (!chooser.value) return
      const qs = await api('questions?lo=' + chooser.value)
      qbox.replaceChildren(...qs.map(q => { const l = el('label', q.blueprint ? '' : 'off'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = picked.has(q.id); cb.onchange = () => { cb.checked ? picked.add(q.id) : picked.delete(q.id); count.textContent = 'الأسئلة المختارة: ' + picked.size }; l.append(cb, el('span', '', q.id + ' · ' + (q.kind === 'MCQ' ? 'اختيار' : 'مقالي') + ' · ' + (q.ar || q.en).slice(0, 140))); return l }))
    }
    manual.append(chooser, qbox, count)
  }
  fillKpis(); grade.onchange = () => { picked.clear(); fillKpis() }
  mode.onchange = () => { manual.hidden = mode.value !== 'manual'; kpis.hidden = mode.value === 'manual'; per.disabled = mode.value === 'manual' }
  form.append(label('العنوان', title), label('الصف الدراسي', grade), label('يُعيَّن لـ', cls), label('آخر موعد (اختياري)', deadline), label('طريقة الاختيار', mode), label('عدد الأسئلة', per), kpis, manual)
  form.append(btn('إنشاء الاختبار', async () => {
    const r = await api('tests', { title: title.value, grade: Number(grade.value), classCode: cls.value, deadline: deadline.value ? new Date(deadline.value).toISOString() : null, mode: mode.value, perKpi: Number(per.value), kpis: [...kpis.querySelectorAll('input:checked')].map(i => i.value), ids: [...picked] })
    toast('أُنشئ الاختبار (' + r.count + ' سؤالًا)'); tests(view)
  }, 'primary'))
  view.append(form, el('h2', '', 'الاختبارات الحالية'))
  view.append(list.length ? table(['العنوان', 'الصف', 'الأسئلة', 'مُعيَّن لـ', 'آخر موعد', 'المحاولات'], list.map(x => [x.title, x.grade, x.ids.length, x.class_code || 'الكل', x.deadline ? date(x.deadline) : '—', x.attempts]), i => testDetail(view, list[i].id)) : el('p', 'muted', 'لا توجد اختبارات بعد.'))
}
async function testDetail(view, id) {
  const x = await api('tests/' + id)
  view.replaceChildren(btn('← الاختبارات', () => go('tests')), el('h1', '', x.title))
  const exp = el('a', 'button-link', '⤓ تصدير النتائج (CSV)'); exp.href = apiOrigin + '/api/admin/export/test/' + id + '.csv'
  view.append(exp, btn('حذف الاختبار', async () => { if (confirm('حذف الاختبار؟')) { await api('tests/delete', { id }); go('tests') } }))
  view.append(el('h2', '', 'نتائج الطلاب'), x.results.length ? table(['الطالب', 'المدرسة', 'الدرجة', 'الحالة'], x.results.map(r => [r.name, r.school, r.score + '/' + r.total, r.done ? 'منتهٍ' : 'جارٍ']), i => go('students', x.results[i].student)) : el('p', 'muted', 'لم يبدأ أي طالب بعد.'))
  view.append(el('h2', '', 'متوسط كل سؤال'), table(['السؤال', 'المؤشر', 'النوع', 'المتوسط'], x.perQuestion.map(q => [q.id, q.lo, q.kind === 'MCQ' ? 'اختيار' : 'مقالي', pct(q.average)])))
}

// ------------------------------------------------------------ notebook review
async function notebooks(view) {
  view.replaceChildren(el('h1', '', 'دفاتر الطلاب'))
  const filter = el('select'); for (const [v, l] of [['submitted', 'بانتظار المراجعة'], ['revise', 'يحتاج تعديل'], ['reviewed', 'تمت المراجعة'], ['draft', 'مسودات'], ['all', 'الكل']]) filter.append(new Option(l, v))
  const holder = el('div')
  const load = async () => { const rows = await api('notebook?status=' + filter.value); holder.replaceChildren(rows.length ? table(['الطالب', 'المدرسة', 'السؤال', 'الحالة', 'أُرسل', 'ملاحظات جديدة'], rows.map(r => [r.name, r.school, r.question || 'صفحة حرة', statusAr[r.status], date(r.submitted || r.updated), r.unread || '']), i => reviewPage(view, rows[i].id)) : el('p', 'muted', 'لا توجد صفحات.')) }
  filter.onchange = load
  view.append(filter, holder); await load()
}
const QUICK = ['أحسنت ✓', 'راجع الإشارة', 'اكتب الوحدة', 'خطوة ناقصة', 'راجع التعويض', 'ارسم مخططًا', 'اكتب القانون أولًا']
async function reviewPage(view, id) {
  const p = await api('notebook/page/' + id)
  view.replaceChildren(btn('← الدفاتر', () => go('notebooks')), el('h1', '', 'مراجعة دفتر · ' + p.name))
  if (p.questionText) view.append(el('p', 'q', p.questionText.ar || p.questionText.en))
  const wrap = el('div', 'review')
  const surface = el('div', 'review-surface')
  const side = el('aside', 'review-side')
  wrap.append(surface, side); view.append(wrap)
  const teacher = { name: 'teacher', strokes: p.review?.annotations || [], editable: true, color: '#c0392b' }
  const figure = p.background?.includes('+figure') && p.question ? apiOrigin + '/api/admin/figure/' + p.question + '/question/0' : null
  // the question printed on the student's page is drawn here too, so the teacher can write over it
  const ql = (p.background?.match(/\+question:(ar|en)/) || [])[1] || 'ar'
  const printed = p.questionText ? { text: p.questionText[ql] || p.questionText.en, options: (p.questionText.options || []).map(o => o.key + ' · ' + (o[ql] || o.en)), dir: ql === 'ar' ? 'rtl' : 'ltr' } : null
  const pad = createSketchpad(surface, { layers: [{ name: 'student', strokes: p.strokes, editable: false }, teacher], background: p.background || 'blank', figureUrl: figure, question: printed })
  side.append(el('p', 'muted', 'اكتب بالقلم الأحمر فوق حل الطالب. خطوط الطالب لا تتغير.'), btn('▶ إعادة تشغيل حل الطالب', () => pad.replay(3)))
  const score = el('input'); score.placeholder = 'الدرجة (مثال 8/10)'; score.value = p.review?.score || ''
  const comment = el('textarea'); comment.placeholder = 'ملاحظة للطالب'
  const chips = el('div', 'chips'); for (const q of QUICK) chips.append(btn(q, () => { comment.value = (comment.value ? comment.value + ' · ' : '') + q }))
  const thread = el('ol', 'thread'); for (const c of p.comments) { const li = el('li'); li.dataset.author = c.author; li.append(el('b', '', c.author === 'teacher' ? 'المعلم' : p.name), el('p', '', c.body), el('small', '', date(c.created))); thread.append(li) }
  const save = status => async () => { await api('notebook/review', { id, annotations: teacher.strokes, status, score: score.value, comment: comment.value }); toast('حُفظ التصحيح'); reviewPage(view, id) }
  side.append(el('label', '', 'الدرجة'), score, el('label', '', 'ملاحظة'), chips, comment,
    btn('✓ تمت المراجعة', save('reviewed'), 'primary'), btn('↺ يحتاج تعديل', save('revise')), btn('حفظ دون تغيير الحالة', save(null)),
    el('h3', '', 'المحادثة'), thread, el('small', 'muted', 'الحالة الحالية: ' + statusAr[p.status]))
}

// ------------------------------------------------------------ inbox
async function inbox(view) {
  const threads = await api('inbox')
  view.replaceChildren(el('h1', '', 'أسئلة الطلاب'))
  if (!threads.length) view.append(el('p', 'muted', 'لا توجد أسئلة بعد.'))
  for (const r of threads) {
    const card = el('article', 'thread-card'); if (!r.replies.some(x => x.author === 'teacher')) card.dataset.open = 'yes'
    card.append(el('b', '', (r.name || 'طالب') + ' · ' + (r.school || '') + ' · ' + date(r.created)))
    if (r.question) card.append(el('small', '', 'السؤال ' + r.question + (r.questionText ? ': ' + r.questionText.slice(0, 120) : '')))
    card.append(el('p', 'msg', r.body))
    for (const x of r.replies) { const m = el('p', 'msg ' + x.author, (x.author === 'teacher' ? 'ردك: ' : 'الطالب: ') + x.body); card.append(m) }
    const ta = el('textarea'); ta.placeholder = 'اكتب ردك'
    card.append(ta, btn('إرسال الرد', async () => { await api('inbox/reply', { id: r.id, body: ta.value }); toast('أُرسل الرد'); inbox(view) }, 'primary'))
    view.append(card)
  }
}

// ------------------------------------------------------------ rubrics
async function rubrics(view) {
  view.replaceChildren(el('h1', '', 'قوائم التصحيح التلقائي'), el('p', 'muted', 'لكل سؤال مقالي قائمة نقاط: نتائج عددية بوحداتها وأفكار أساسية بمرادفاتها. عدّل القائمة إذا رأيت أن التصحيح التلقائي لا يناسب السؤال.'))
  const picker = el('div', 'filters')
  const lo = el('select'); lo.append(new Option('— اختر المؤشر —', '')); for (const c of cards) lo.append(new Option(c.id + ' · ' + (c.ar || c.en).slice(0, 60), c.id))
  const qs = el('select'); qs.append(new Option('— السؤال —', ''))
  const holder = el('div')
  lo.onchange = async () => { qs.replaceChildren(new Option('— السؤال —', '')); for (const q of (await api('questions?lo=' + lo.value)).filter(q => q.kind === 'FRQ')) qs.append(new Option(q.id + ' · ' + (q.ar || q.en).slice(0, 80), q.id)) }
  qs.onchange = () => qs.value && editRubric(holder, qs.value)
  picker.append(lo, qs); view.append(picker, holder)
}
async function editRubric(holder, id) {
  const r = await api('rubric/' + id)
  holder.replaceChildren(el('h2', '', id), el('p', 'q', r.ar), el('details', ''))
  holder.lastChild.append(el('summary', '', 'الحل النموذجي'), el('p', '', r.solution_ar), el('p', '', r.solution_en))
  holder.append(el('p', 'muted', 'المصدر الحالي: ' + ({ teacher: 'تعديل المعلم', file: 'قائمة مكتوبة يدويًا', automatic: 'مستخرجة تلقائيًا من الحل' })[r.source]))
  const numbers = (r.override?.numbers || r.rubric.numbers.map(n => [n.value, n.unit]))
  const ideas = (r.override?.ideas || r.rubric.ideas.map(i => i.key.startsWith('custom:') || i.key.startsWith('lead:') ? { en: [], ar: [] } : { key: i.key }))
  const numBox = el('div', 'rub'); const ideaBox = el('div', 'rub')
  const drawNums = () => { numBox.replaceChildren(el('h3', '', 'النتائج العددية'), ...numbers.map((n, i) => { const row = el('div', 'rub-row'); const v = el('input'); v.value = n[0]; v.oninput = () => n[0] = Number(v.value); const u = el('input'); u.value = n[1] || ''; u.placeholder = 'الوحدة (m/s, J, °…)'; u.dir = 'ltr'; u.oninput = () => n[1] = u.value || null; row.append(v, u, btn('×', () => { numbers.splice(i, 1); drawNums() })); return row }), btn('+ نتيجة', () => { numbers.push([0, null]); drawNums() })) }
  const drawIdeas = () => { ideaBox.replaceChildren(el('h3', '', 'الأفكار الأساسية (أي كلمة من القائمة تكفي)'), ...ideas.map((x, i) => { const row = el('div', 'rub-row'); if (x.key) row.append(el('span', 'tag', 'مفهوم جاهز: ' + x.key)); else { const en = el('input'); en.placeholder = 'English terms, comma separated'; en.dir = 'ltr'; en.value = (x.en || []).join(', '); en.oninput = () => x.en = en.value.split(',').map(s => s.trim()).filter(Boolean); const ar = el('input'); ar.placeholder = 'مرادفات عربية مفصولة بفواصل'; ar.value = (x.ar || []).join('، '); ar.oninput = () => x.ar = ar.value.split(/[,،]/).map(s => s.trim()).filter(Boolean); row.append(en, ar) } row.append(btn('×', () => { ideas.splice(i, 1); drawIdeas() })); return row }), btn('+ فكرة', () => { ideas.push({ en: [], ar: [] }); drawIdeas() })) }
  drawNums(); drawIdeas()
  holder.append(numBox, ideaBox,
    btn('حفظ القائمة', async () => { const res = await api('rubric', { id, override: { numbers, ideas: ideas.filter(x => x.key || x.en?.length || x.ar?.length) } }); toast('حُفظت القائمة · ' + (res.rubric.numbers.length + res.rubric.ideas.length) + ' نقاط'); editRubric(holder, id) }, 'primary'),
    btn('استرجاع القائمة الأصلية', async () => { await api('rubric', { id, override: null }); toast('استُرجعت القائمة الأصلية'); editRubric(holder, id) }))
}

start()
