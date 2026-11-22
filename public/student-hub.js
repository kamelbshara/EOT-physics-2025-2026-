// Student home strip: streak and daily goal, badges, mastery map, mistakes, tests, notebook, messages and leaderboard.
import { t, lang } from './language.js'

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n }
function btn(label, onclick, cls = '') { const b = el('button', cls, label); b.type = 'button'; b.onclick = onclick; return b }
const levelName = l => ({ new: t('Not started', 'لم يبدأ'), weak: t('Needs work', 'يحتاج تدريب'), developing: t('Developing', 'قيد التحسن'), mastered: t('Mastered', 'متقن') })[l]
export const splitTitle = s => { if (!s) return null; const [en, ar] = s.split('|'); return t(en, ar || en) }

function dialog(id) {
  let d = document.getElementById(id)
  if (!d) { d = el('dialog', 'hub-dialog'); d.id = id; document.body.append(d) }
  d.replaceChildren(); d.dir = lang() === 'ar' ? 'rtl' : 'ltr'
  return d
}

export async function renderHub(host, ctx) {
  const { api, grade, cards } = ctx
  let info
  try { info = await api('insights') } catch { host.replaceChildren(); return }
  host.replaceChildren()

  // progress strip
  const strip = el('div', 'hub-strip')
  const streak = el('div', 'hub-stat hub-streak')
  streak.append(el('b', '', '🔥 ' + info.streak), el('small', '', t(info.streak === 1 ? 'day streak' : 'days in a row', 'أيام متتالية')))
  const goal = el('div', 'hub-stat hub-goal')
  const pct = Math.min(100, Math.round(100 * info.today / info.goal))
  goal.style.setProperty('--goal', pct + '%')
  goal.append(el('b', '', info.today + '/' + info.goal), el('small', '', pct >= 100 ? t('Daily goal reached!', 'أنجزت هدف اليوم!') : t('daily goal', 'هدف اليوم')))
  const earned = info.badges.filter(b => b.earned)
  const badges = btn('', () => showBadges(info.badges), 'hub-stat hub-badges')
  badges.append(el('b', '', '🏅 ' + earned.length), el('small', '', t('badges', 'أوسمة')))
  strip.append(streak, goal, badges)

  // actions
  const actions = el('div', 'hub-actions')
  const action = (icon, label, count, onclick, tone) => { const b = btn('', onclick, 'hub-action'); if (tone) b.dataset.tone = tone; b.append(el('span', 'hub-icon', icon), el('span', '', label)); if (count) b.append(el('em', 'hub-count', String(count))); return b }
  actions.append(
    action('↺', t('My mistakes', 'أخطائي'), info.mistakesDue, async () => {
      const list = await api('insights/mistakes')
      if (!list.length) return alert(t('No mistakes to review right now. Well done!', 'لا توجد أخطاء للمراجعة الآن. أحسنت!'))
      ctx.onPracticeList(list, t('My mistakes', 'أخطائي'))
    }, info.mistakesDue ? 'warn' : ''),
    action('⚡', t('Custom test', 'اختبار مخصص'), 0, () => testBuilder(ctx)),
    action('📋', t('My tests', 'اختباراتي'), info.tests, () => myTests(ctx), info.tests ? 'accent' : ''),
    action('✎', t('My notebook', 'دفتري'), info.reviewed, () => ctx.openNotebookList(), info.reviewed ? 'accent' : ''),
    action('✉', t('Ask the teacher', 'اسأل المعلم'), info.unread, () => ctx.openAsk(), info.unread ? 'accent' : ''),
    action('⟲', t('Reset', 'إعادة ضبط'), 0, () => ctx.reset()))

  // mastery map for the selected grade
  const map = el('section', 'hub-map')
  const head = el('div', 'hub-map-head')
  const group = cards.filter(c => c.grade === grade)
  const mastered = group.filter(c => info.mastery[c.id]?.level === 'mastered').length
  head.append(el('strong', '', t('Mastery map · Grade ', 'خريطة الإتقان · الصف ') + grade), el('small', '', mastered + '/' + group.length + t(' mastered', ' متقن')))
  const grid = el('div', 'hub-grid')
  for (const c of group) {
    const m = info.mastery[c.id] || { level: 'new', score: 0 }
    const cell = btn(String(c.slot), () => ctx.openCard(c), 'hub-cell')
    cell.dataset.level = m.level
    cell.title = (lang() === 'ar' ? c.ar : c.en) + ' — ' + levelName(m.level) + ' · ' + Math.round(m.score * 100) + '%'
    cell.style.setProperty('--m', Math.round(m.score * 100) + '%')
    grid.append(cell)
  }
  const legend = el('div', 'hub-legend')
  for (const l of ['new', 'weak', 'developing', 'mastered']) { const s = el('span'); s.dataset.level = l; s.textContent = levelName(l); legend.append(s) }
  map.append(head, grid, legend)

  host.append(strip, actions, map)
  if (info.leaderboard) host.append(leaderboard(info.leaderboard))
}

function leaderboard(lb) {
  const box = el('section', 'hub-board')
  box.append(el('strong', '', t('Class board · ', 'لوحة الصف · ') + lb.className), el('small', '', t('Your rank: ', 'ترتيبك: ') + lb.rank + '/' + lb.size))
  const ol = el('ol')
  for (const r of lb.top) { const li = el('li'); if (r.me) li.dataset.me = 'yes'; li.append(el('span', '', r.name), el('b', '', String(r.points))); ol.append(li) }
  box.append(ol)
  return box
}

function showBadges(list) {
  const d = dialog('badgesDialog')
  d.append(el('h2', '', t('Badges', 'الأوسمة')))
  const grid = el('div', 'badge-grid')
  for (const b of list) { const card = el('div', 'badge'); card.dataset.earned = b.earned ? 'yes' : 'no'; card.append(el('span', '', b.earned ? '🏅' : '🔒'), el('b', '', t(b.en, b.ar))); grid.append(card) }
  d.append(grid, btn(t('Close', 'إغلاق'), () => d.close()))
  if (!d.open) d.showModal()
}

function testBuilder(ctx) {
  const { api, cards } = ctx
  const d = dialog('testBuilder')
  d.append(el('h2', '', t('Custom test', 'اختبار مخصص')), el('p', '', t('One question of the exam’s own type for each outcome, in the timed mock format.', 'سؤال من نمط الهيكل نفسه لكل مؤشر، بنظام الاختبار التجريبي المؤقّت.')))
  const form = el('form', 'test-form')
  const gradeSel = el('select'); for (const g of [9, 10, 11, 12]) { const o = el('option', '', t('Grade ', 'الصف ') + g); o.value = g; gradeSel.append(o) }
  gradeSel.value = ctx.grade
  const mode = el('select'); for (const [v, en, ar] of [['all', 'Every outcome', 'كل المؤشرات'], ['weak', 'My weakest outcomes', 'نقاط ضعفي'], ['pick', 'Outcomes I choose', 'مؤشرات أختارها']]) { const o = el('option', '', t(en, ar)); o.value = v; mode.append(o) }
  const per = el('select'); for (const n of [1, 2, 3]) { const o = el('option', '', String(n)); o.value = n; per.append(o) }
  const picks = el('fieldset', 'test-picks'); picks.hidden = true
  const fillPicks = () => { picks.replaceChildren(el('legend', '', t('Outcomes', 'المؤشرات'))); for (const c of cards.filter(c => c.grade === Number(gradeSel.value))) { const l = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.value = c.id; l.append(cb, el('span', '', c.slot + ' · ' + (lang() === 'ar' ? c.ar : c.en).slice(0, 80))); picks.append(l) } }
  fillPicks()
  gradeSel.onchange = fillPicks
  mode.onchange = () => { picks.hidden = mode.value !== 'pick' }
  const row = (label, input) => { const l = el('label'); l.append(el('span', '', label), input); return l }
  const error = el('p', 'form-error')
  form.append(row(t('Grade', 'الصف'), gradeSel), row(t('Coverage', 'التغطية'), mode), row(t('Questions per outcome', 'عدد الأسئلة لكل مؤشر'), per), picks, error)
  const start = btn(t('Start the test', 'ابدأ الاختبار'), async () => {
    try {
      const kpis = mode.value === 'pick' ? [...picks.querySelectorAll('input:checked')].map(i => i.value) : 'all'
      const mock = await api('tests/new', { grade: Number(gradeSel.value), mode: mode.value === 'weak' ? 'weak' : 'blueprint', kpis, perKpi: Number(per.value) })
      d.close(); ctx.onMock(mock)
    } catch (e) { error.textContent = e.message }
  }, 'primary')
  d.append(form, el('div', 'tools'))
  d.lastChild.append(start, btn(t('Cancel', 'إلغاء'), () => d.close()))
  if (!d.open) d.showModal()
}

async function myTests(ctx) {
  const { api } = ctx
  const d = dialog('myTests')
  const tests = await api('tests')
  d.append(el('h2', '', t('Tests from my teacher', 'اختبارات المعلم')))
  const list = el('ul', 'test-list')
  if (!tests.length) list.append(el('li', 'nb-empty', t('No tests assigned yet.', 'لا توجد اختبارات معيّنة بعد.')))
  for (const x of tests) {
    const li = el('li'); li.dataset.status = x.status
    const info = el('div')
    info.append(el('b', '', x.title), el('small', '', t('Grade ', 'الصف ') + x.grade + ' · ' + x.count + t(' questions', ' سؤالًا') + (x.deadline ? ' · ' + t('due ', 'حتى ') + new Date(x.deadline).toLocaleDateString() : '')))
    li.append(info)
    if (x.status === 'done') li.append(el('strong', 'test-score', x.result.score + '/' + x.result.total))
    else if (x.closed) li.append(el('small', '', t('Closed', 'انتهى الموعد')))
    else li.append(btn(x.status === 'open' ? t('Continue', 'تابع') : t('Start', 'ابدأ'), async () => { try { const mock = await api('tests/start', { id: x.id }); d.close(); ctx.onMock(mock) } catch (e) { alert(e.message) } }, 'primary'))
    list.append(li)
  }
  d.append(list, btn(t('Close', 'إغلاق'), () => d.close()))
  if (!d.open) d.showModal()
}
