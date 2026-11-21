// Accounts, teacher dashboard, handwriting notebook, tests, mastery, mistakes, streaks and the teacher inbox.
// physics.mjs passes its question bank helpers in `ctx`; every route here returns a reply or undefined.
import { randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto'
import { grade, rubricFor, setRuntimeRubrics, fileRubric } from './grader.mjs'
import { unpack } from './coach.mjs'

const DAY = 86400000
const OFFSET = 4 * 3600000 // school days follow UAE time
const dayOf = t => Math.floor((t + OFFSET) / DAY)
const DAILY_GOAL = 10
const REVIEW_STEPS = [1, 3, 7, 14] // days between successful reviews of a past mistake
const sameName = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const text = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : ''

export function platformApi(db, ctx) {
  const { bank, cards, question, prompt, solution, validAnswer, mockView, getMock, createMock, isActive, profile } = ctx
  db.exec(`
    CREATE TABLE IF NOT EXISTS physics_classes(code TEXT PRIMARY KEY, name TEXT NOT NULL, grade INTEGER, leaderboard INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS physics_teacher_sessions(token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS physics_attempts(student TEXT NOT NULL, question TEXT NOT NULL, lo TEXT, score REAL NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS physics_attempts_student ON physics_attempts(student, at);
    CREATE TABLE IF NOT EXISTS physics_mistakes(student TEXT NOT NULL, question TEXT NOT NULL, box INTEGER NOT NULL, due INTEGER NOT NULL, PRIMARY KEY(student, question));
    CREATE TABLE IF NOT EXISTS physics_grade_overrides(student TEXT NOT NULL, question TEXT NOT NULL, score REAL NOT NULL, total REAL NOT NULL, note TEXT, updated INTEGER NOT NULL, PRIMARY KEY(student, question));
    CREATE TABLE IF NOT EXISTS physics_rubrics(question TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS physics_notebook(id TEXT PRIMARY KEY, student TEXT NOT NULL, question TEXT, title TEXT, background TEXT, strokes TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, submitted INTEGER);
    CREATE INDEX IF NOT EXISTS physics_notebook_student ON physics_notebook(student);
    CREATE TABLE IF NOT EXISTS physics_notebook_reviews(page TEXT PRIMARY KEY, annotations TEXT NOT NULL, score TEXT, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS physics_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, thread INTEGER, student TEXT NOT NULL, question TEXT, page TEXT, author TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS physics_tests(id TEXT PRIMARY KEY, title TEXT NOT NULL, grade INTEGER NOT NULL, ids TEXT NOT NULL, class_code TEXT, deadline INTEGER, created INTEGER NOT NULL);
  `)
  setRuntimeRubrics(Object.fromEntries(db.prepare('SELECT question, json FROM physics_rubrics').all().map(r => [r.question, JSON.parse(r.json)])))

  const cardById = new Map(cards.map(c => [c.id, c]))
  const studentRow = db.prepare('SELECT student, name, school, code, class_code AS classCode, started FROM physics_profiles WHERE student=?')

  // ------------------------------------------------------------ scoring helpers
  function scoreOf(q, response, result) {
    if (!q) return null
    if (q.kind === 'MCQ') return response === q.answer ? 1 : 0
    const g = result?.grade || (response ? grade(q, unpack(response)) : null)
    return g?.total ? g.score / g.total : null
  }
  const override = db.prepare('SELECT score, total, note, updated FROM physics_grade_overrides WHERE student=? AND question=?')
  function withTeacher(student, id, result) {
    const o = override.get(student, id)
    return o ? { ...result, teacher: o } : result
  }
  function logAttempt(student, q, response, result) {
    let score = scoreOf(q, response, result)
    const o = override.get(student, q.id)
    if (o) score = o.score / o.total
    if (score === null) return
    const now = Date.now()
    db.prepare('INSERT INTO physics_attempts VALUES(?,?,?,?,?)').run(student, q.id, q.lo_id, score, now)
    const m = db.prepare('SELECT box FROM physics_mistakes WHERE student=? AND question=?').get(student, q.id)
    if (score < 0.75) db.prepare('INSERT INTO physics_mistakes VALUES(?,?,0,?) ON CONFLICT(student,question) DO UPDATE SET box=0,due=excluded.due').run(student, q.id, now + DAY / 2)
    else if (m) {
      if (m.box + 1 > REVIEW_STEPS.length) db.prepare('DELETE FROM physics_mistakes WHERE student=? AND question=?').run(student, q.id)
      else db.prepare('UPDATE physics_mistakes SET box=?, due=? WHERE student=? AND question=?').run(m.box + 1, now + REVIEW_STEPS[m.box] * DAY, student, q.id)
    }
  }
  function mockScore(row, student) {
    const answers = JSON.parse(row.answers || '{}'), ids = JSON.parse(row.ids)
    let score = 0
    const perQuestion = ids.map(id => {
      const q = question(id); const r = answers[id]
      const o = override.get(student || row.student, id)
      const s = o ? o.score / o.total : r ? (scoreOf(q, r) ?? 0) : 0
      score += s
      return { id, lo: q?.lo_id, kind: q?.kind, score: s, answered: Boolean(r) }
    })
    return { score: Math.round(score * 10) / 10, total: ids.length, perQuestion }
  }
  function logMock(student, row) {
    // a finished mock counts once, whether the student finished it or the timer did
    if (db.prepare('UPDATE physics_mocks SET logged=1 WHERE id=? AND logged IS NULL').run(row.id).changes === 0) return
    const answers = JSON.parse(row.answers || '{}')
    for (const id of JSON.parse(row.ids)) if (answers[id]) logAttempt(student, question(id), answers[id])
  }

  // ------------------------------------------------------------ mastery, streak, badges
  function latestScores(student) {
    const rows = db.prepare('SELECT question, lo, score FROM physics_attempts WHERE student=? ORDER BY at').all(student)
    const latest = new Map()
    for (const r of rows) latest.set(r.question, r)
    return latest
  }
  function mastery(student) {
    const latest = latestScores(student)
    const perLo = {}
    for (const c of cards) perLo[c.id] = { sum: 0, done: 0, total: c.total }
    for (const r of latest.values()) if (perLo[r.lo]) { perLo[r.lo].sum += r.score; perLo[r.lo].done++ }
    const out = {}
    for (const [lo, v] of Object.entries(perLo)) {
      const score = Math.min(1, v.sum / Math.max(5, Math.min(v.total, 8))) // eight good answers (or all of a small card) count as mastery
      out[lo] = { score: Math.round(score * 100) / 100, done: v.done, total: v.total, level: v.done === 0 ? 'new' : score >= 0.75 ? 'mastered' : score >= 0.4 ? 'developing' : 'weak' }
    }
    return out
  }
  function streakOf(student) {
    const days = new Set(db.prepare('SELECT at FROM physics_attempts WHERE student=?').all(student).map(r => dayOf(r.at)))
    const today = dayOf(Date.now())
    let streak = 0
    for (let d = days.has(today) ? today : today - 1; days.has(d); d--) streak++
    const todayCount = db.prepare('SELECT count(*) n FROM physics_attempts WHERE student=? AND at>=?').get(student, today * DAY - OFFSET).n
    return { streak, today: todayCount, goal: DAILY_GOAL, days: days.size }
  }
  function badges(student, m, s) {
    const mastered = Object.values(m).filter(v => v.level === 'mastered').length
    const best = Math.max(0, ...db.prepare('SELECT * FROM physics_mocks WHERE student=? AND done=1').all(student).map(r => { const x = mockScore(r, student); return x.total ? x.score / x.total : 0 }))
    const submitted = db.prepare("SELECT count(*) n FROM physics_notebook WHERE student=? AND status!='draft'").get(student).n
    const attempts = db.prepare('SELECT count(*) n FROM physics_attempts WHERE student=?').get(student).n
    const list = [
      ['first', 'First answer checked', 'أول إجابة', attempts >= 1],
      ['hundred', '100 answers checked', '100 إجابة', attempts >= 100],
      ['streak3', '3-day streak', '3 أيام متتالية', s.streak >= 3],
      ['streak7', '7-day streak', '7 أيام متتالية', s.streak >= 7],
      ['streak14', '14-day streak', '14 يومًا متتاليًا', s.streak >= 14],
      ['master1', 'First mastered outcome', 'أول مؤشر متقن', mastered >= 1],
      ['master5', '5 mastered outcomes', '5 مؤشرات متقنة', mastered >= 5],
      ['master20', '20 mastered outcomes', '20 مؤشرًا متقنًا', mastered >= 20],
      ['mock80', 'Mock or test at 80%+', 'اختبار بنسبة 80% فأكثر', best >= 0.8],
      ['notebook', 'Notebook page sent to the teacher', 'صفحة دفتر أُرسلت للمعلم', submitted >= 1],
    ]
    for (const g of [9, 10, 11, 12]) list.push(['grade' + g, `All Grade ${g} outcomes mastered`, `إتقان كل مؤشرات الصف ${g}`, cards.filter(c => c.grade === g).every(c => m[c.id]?.level === 'mastered')])
    return list.map(([id, en, ar, earned]) => ({ id, en, ar, earned }))
  }
  function points(student) {
    let p = 0
    for (const r of latestScores(student).values()) p += r.score
    return Math.round(p)
  }
  function leaderboard(student) {
    const me = studentRow.get(student)
    const cls = me?.classCode && db.prepare('SELECT * FROM physics_classes WHERE code=?').get(me.classCode)
    if (!cls?.leaderboard) return null
    const rows = db.prepare('SELECT student, name FROM physics_profiles WHERE class_code=?').all(cls.code).map(r => ({ id: r.student, name: r.name, points: points(r.student) })).sort((a, b) => b.points - a.points)
    return { className: cls.name, top: rows.slice(0, 10).map((r, i) => ({ rank: i + 1, name: r.name, points: r.points, me: r.id === student })), rank: rows.findIndex(r => r.id === student) + 1, size: rows.length }
  }

  // ------------------------------------------------------------ tests
  const pickQuestions = (lo, kind, n) => bank.prepare('SELECT id FROM questions WHERE lo_id=? AND kind=? ORDER BY random() LIMIT ?').all(lo, kind, n).map(r => r.id)
  function generate({ grade: g, kpis, perKpi = 1, mode = 'blueprint' }, student) {
    let list = cards.filter(c => c.grade === g)
    if (Array.isArray(kpis) && kpis.length) list = list.filter(c => kpis.includes(c.id))
    if (mode === 'weak' && student) {
      const m = mastery(student)
      list = [...list].sort((a, b) => (m[a.id]?.score ?? 0) - (m[b.id]?.score ?? 0)).slice(0, 8)
      perKpi = Math.max(perKpi, 2)
    }
    const n = Math.min(3, Math.max(1, Number(perKpi) || 1))
    return list.flatMap(c => pickQuestions(c.id, c.examType, n))
  }
  function testsFor(student) {
    const me = studentRow.get(student)
    const rows = db.prepare('SELECT * FROM physics_tests WHERE class_code IS NULL OR class_code=? ORDER BY created DESC').all(me?.classCode || '')
    return rows.map(t => {
      const attempt = db.prepare('SELECT * FROM physics_mocks WHERE student=? AND test_id=? ORDER BY rowid DESC LIMIT 1').get(student, t.id)
      const done = attempt && (attempt.done || Date.now() >= attempt.deadline)
      return { id: t.id, title: t.title, grade: t.grade, count: JSON.parse(t.ids).length, deadline: t.deadline, status: !attempt ? 'new' : done ? 'done' : 'open', result: done ? mockScore(attempt, student) : null, closed: Boolean(t.deadline && Date.now() > t.deadline && !attempt) }
    })
  }

  // ------------------------------------------------------------ notebook
  const pageMeta = 'id, question, title, background, version, status, created, updated, submitted'
  function validStrokes(strokes) {
    if (!Array.isArray(strokes) || strokes.length > 6000) return false
    return strokes.every(s => s && typeof s === 'object' && typeof s.c === 'string' && s.c.length <= 9 && typeof s.w === 'number' && ['pen', 'hl', 'line', 'arrow', 'text'].includes(s.t || 'pen') && Array.isArray(s.p) && s.p.length <= 4000)
  }
  function pageView(row, viewer) {
    if (!row) return null
    const review = db.prepare('SELECT annotations, score, updated FROM physics_notebook_reviews WHERE page=?').get(row.id)
    const comments = db.prepare("SELECT id, author, body, created FROM physics_messages WHERE kind='note' AND page=? ORDER BY id").all(row.id)
    if (viewer === 'student') db.prepare("UPDATE physics_messages SET seen=1 WHERE kind='note' AND page=? AND author='teacher'").run(row.id)
    if (viewer === 'teacher') db.prepare("UPDATE physics_messages SET seen=1 WHERE kind='note' AND page=? AND author='student'").run(row.id)
    const q = row.question && question(row.question)
    return { id: row.id, question: row.question, questionText: q ? { en: q.question_en, ar: q.question_ar, options: (q.options || []).map(o => ({ key: o.key, en: o.en, ar: o.ar })), figures: (q.images || []).filter(i => i.role === 'question').length } : null, title: row.title, background: row.background, strokes: JSON.parse(row.strokes), version: row.version, status: row.status, updated: row.updated, submitted: row.submitted, review: review ? { annotations: JSON.parse(review.annotations), score: review.score, updated: review.updated } : null, comments }
  }

  // ------------------------------------------------------------ teacher auth
  const attemptsByKey = new Map()
  function limited(key) {
    const now = Date.now(); const a = attemptsByKey.get(key)
    if (a && a.until > now && a.count >= 6) return true
    if (!a || a.until <= now) attemptsByKey.set(key, { count: 1, until: now + 10 * 60000 }); else a.count++
    return false
  }
  function teacherOk(session) {
    if (!session?.teacher) return false
    const row = db.prepare('SELECT expires FROM physics_teacher_sessions WHERE token=?').get(createHash('sha256').update(session.teacher).digest('hex'))
    return Boolean(row && row.expires > Date.now())
  }
  function csv(res, name, rows) {
    const body = '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }).join(',')).join('\r\n')
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' })
    res.end(body)
    return true
  }
  function studentSummary(r) {
    const s = streakOf(r.student)
    const latest = [...latestScores(r.student).values()]
    const avg = latest.length ? latest.reduce((n, x) => n + x.score, 0) / latest.length : null
    const last = db.prepare('SELECT max(at) t FROM physics_attempts WHERE student=?').get(r.student).t
    return { id: r.student, name: r.name, school: r.school, code: r.code, classCode: r.classCode, answered: latest.length, average: avg === null ? null : Math.round(avg * 100), streak: s.streak, lastActive: last, points: points(r.student) }
  }
  function figureFor(res, q, role, index) {
    const asset = (q?.images || []).filter(i => i.role === role)[Number(index)]?.asset_id
    const file = asset && bank.prepare('SELECT path FROM images WHERE id=?').get(asset)?.path
    if (!file) return false
    res.writeHead(200, { 'Content-Type': file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private,no-store' })
    res.end(ctx.readBank(file))
    return true
  }

  // ------------------------------------------------------------ routes
  async function route(path, req, res, student, reply, body, session) {
    const GET = req.method === 'GET', POST = req.method === 'POST'

    // ---------- sign in from any device with the student code and PIN
    if (path === '/api/login' && POST) {
      const code = text(body.code, 12), name = text(body.name, 80)
      if (limited('login:' + code)) return reply(429, { error: 'محاولات كثيرة. انتظر عشر دقائق ثم أعد المحاولة.' })
      // a student signs in with their six-digit code and the name they registered with (spelling variants tolerated)
      const row = db.prepare('SELECT student, name FROM physics_profiles WHERE code=?').get(code)
      if (!row || sameName(row.name) !== sameName(name)) return reply(401, { error: 'رمز الطالب أو الاسم غير صحيح' })
      session.assignStudent(row.student)
      db.prepare('INSERT OR REPLACE INTO physics_visits VALUES(?,?)').run(row.student, Date.now() + DAY)
      return reply(200, profile.get(row.student))
    }
    if (path === '/api/logout' && POST) {
      db.prepare('DELETE FROM physics_visits WHERE student=?').run(student)
      session.assignStudent(randomUUID())
      return reply(200, { ok: true })
    }

    // ---------- teacher dashboard
    if (path.startsWith('/api/admin')) {
      if (path === '/api/admin/login' && POST) {
        const expected = process.env.PHYSICS_TEACHER_PASSWORD
        if (!expected) return reply(503, { error: 'Set PHYSICS_TEACHER_PASSWORD on the server to enable the teacher dashboard.' })
        if (limited('admin')) return reply(429, { error: 'محاولات كثيرة. انتظر عشر دقائق.' })
        const a = createHash('sha256').update(String(body.password || '')).digest(), b = createHash('sha256').update(expected).digest()
        if (!timingSafeEqual(a, b)) return reply(401, { error: 'كلمة المرور غير صحيحة' })
        const token = randomBytes(32).toString('hex')
        db.prepare('INSERT INTO physics_teacher_sessions VALUES(?,?)').run(createHash('sha256').update(token).digest('hex'), Date.now() + 12 * 3600000)
        session.setCookie('physics_teacher', token, 12 * 3600)
        return reply(200, { ok: true })
      }
      if (path === '/api/admin/logout' && POST) {
        if (session.teacher) db.prepare('DELETE FROM physics_teacher_sessions WHERE token=?').run(createHash('sha256').update(session.teacher).digest('hex'))
        session.setCookie('physics_teacher', '', 0)
        return reply(200, { ok: true })
      }
      if (!teacherOk(session)) return reply(401, { error: 'سجّل دخول المعلم أولاً' })
      return adminRoute(path, req, res, reply, body, GET, POST)
    }

    // ---------- everything below needs a signed-in student
    const studentPaths = /^\/api\/(notebook|tests|insights|ask|leaderboard|hints)(\/|$)/
    if (!studentPaths.test(path)) return undefined
    if (!isActive(student)) return reply(403, { error: 'انتهت جلسة التدريب. حدّث الصفحة وسجّل الدخول للمتابعة.' })

    if (path === '/api/insights' && GET) {
      const m = mastery(student), s = streakOf(student)
      const due = db.prepare('SELECT count(*) n FROM physics_mistakes WHERE student=? AND due<=?').get(student, Date.now()).n
      const queued = db.prepare('SELECT count(*) n FROM physics_mistakes WHERE student=?').get(student).n
      const unread = db.prepare("SELECT count(*) n FROM physics_messages WHERE student=? AND author='teacher' AND seen=0").get(student).n
      const reviewed = db.prepare("SELECT count(*) n FROM physics_notebook WHERE student=? AND status IN ('reviewed','revise')").get(student).n
      return reply(200, { mastery: m, ...s, badges: badges(student, m, s), mistakesDue: due, mistakesQueued: queued, unread, reviewed, leaderboard: leaderboard(student), tests: testsFor(student).filter(t => t.status !== 'done' && !t.closed).length })
    }
    if (path === '/api/insights/mistakes' && GET) {
      const rows = db.prepare('SELECT question FROM physics_mistakes WHERE student=? ORDER BY due<=? DESC, due LIMIT 20').all(student, Date.now())
      return reply(200, rows.map(r => question(r.question)).filter(Boolean).map(q => prompt(q)))
    }
    if (path === '/api/hints' && POST) {
      const q = typeof body.id === 'string' && question(body.id)
      if (!q || q.kind !== 'FRQ') return reply(200, { clues: [] })
      const r = rubricFor(q)
      return reply(200, { clues: [...r.numbers.map(n => ({ type: 'number', unit: n.unit, en: n.en, ar: n.ar })), ...r.ideas.map(i => ({ type: 'idea', en: i.lead ? null : i.en, ar: i.lead ? null : i.ar }))], drawing: r.drawing })
    }

    // tests: generated by the student or assigned by the teacher; both run as a timed mock
    if (path === '/api/tests' && GET) return reply(200, testsFor(student))
    if ((path === '/api/tests/new' || path === '/api/tests/start') && POST) {
      const open = mockView(getMock.get(student))
      if (open && !open.done) return reply(409, { error: 'أكمل الاختبار الحالي أولاً' })
      if (path === '/api/tests/new') {
        const g = Number(body.grade)
        if (![9, 10, 11, 12].includes(g)) return reply(400, { error: 'اختر الصف' })
        const ids = generate({ grade: g, kpis: body.kpis, perKpi: body.perKpi, mode: body.mode }, student)
        if (!ids.length) return reply(400, { error: 'اختر مؤشرًا واحدًا على الأقل' })
        const title = body.mode === 'weak' ? 'Weakness-focused test|اختبار نقاط الضعف' : 'Custom test|اختبار مخصص'
        return reply(201, createMock(student, g, ids, title))
      }
      const t = db.prepare('SELECT * FROM physics_tests WHERE id=?').get(text(body.id, 40))
      const visible = t && testsFor(student).find(x => x.id === t.id)
      if (!visible) return reply(404, { error: 'الاختبار غير متاح' })
      if (visible.status === 'done') return reply(409, { error: 'أنهيت هذا الاختبار' })
      if (visible.closed) return reply(409, { error: 'انتهى موعد هذا الاختبار' })
      if (visible.status === 'open') return reply(200, mockView(getMock.get(student)))
      return reply(201, createMock(student, t.grade, JSON.parse(t.ids), t.title, t.id))
    }

    // notebook
    if (path === '/api/notebook' && GET) {
      const rows = db.prepare(`SELECT ${pageMeta} FROM physics_notebook WHERE student=? ORDER BY updated DESC`).all(student)
      return reply(200, rows.map(r => ({ ...r, unread: db.prepare("SELECT count(*) n FROM physics_messages WHERE kind='note' AND page=? AND author='teacher' AND seen=0").get(r.id).n })))
    }
    if (path.startsWith('/api/notebook/page/') && GET) {
      const row = db.prepare('SELECT * FROM physics_notebook WHERE id=? AND student=?').get(path.slice(19), student)
      return row ? reply(200, pageView(row, 'student')) : reply(404, { error: 'الصفحة غير موجودة' })
    }
    if (path === '/api/notebook/save' && POST) {
      if (!validStrokes(body.strokes)) return reply(400, { error: 'بيانات الرسم غير صالحة' })
      const now = Date.now()
      const qid = typeof body.question === 'string' && question(body.question) ? body.question : null
      const background = /^(blank|lined|grid|axes)(\+question(?::(?:ar|en))?)?(\+figure:\d+)?$/.test(body.background || '') ? body.background : 'blank'
      let row = typeof body.id === 'string' && db.prepare('SELECT * FROM physics_notebook WHERE id=? AND student=?').get(body.id, student)
      if (!row) {
        const id = randomUUID()
        db.prepare('INSERT INTO physics_notebook VALUES(?,?,?,?,?,?,1,?,?,?,NULL)').run(id, student, qid, text(body.title, 80) || null, background, JSON.stringify(body.strokes), 'draft', now, now)
        return reply(201, { id, version: 1, updated: now })
      }
      if (Number(body.version) < row.version) return reply(409, { error: 'هذه الصفحة عُدّلت من جهاز آخر', page: pageView(row, 'student') })
      const status = row.status === 'reviewed' || row.status === 'revise' ? row.status : row.status
      db.prepare('UPDATE physics_notebook SET strokes=?, background=?, title=coalesce(?,title), version=version+1, updated=?, status=? WHERE id=?').run(JSON.stringify(body.strokes), background, text(body.title, 80) || null, now, status, row.id)
      return reply(200, { id: row.id, version: row.version + 1, updated: now })
    }
    if (path === '/api/notebook/submit' && POST) {
      const row = db.prepare('SELECT id FROM physics_notebook WHERE id=? AND student=?').get(text(body.id, 40), student)
      if (!row) return reply(404, { error: 'الصفحة غير موجودة' })
      db.prepare("UPDATE physics_notebook SET status='submitted', submitted=? WHERE id=?").run(Date.now(), row.id)
      return reply(200, pageView(db.prepare('SELECT * FROM physics_notebook WHERE id=?').get(row.id), 'student'))
    }
    if (path === '/api/notebook/delete' && POST) {
      db.prepare("DELETE FROM physics_notebook WHERE id=? AND student=? AND status='draft'").run(text(body.id, 40), student)
      return reply(200, { ok: true })
    }
    if (path === '/api/notebook/comment' && POST) {
      const row = db.prepare('SELECT id FROM physics_notebook WHERE id=? AND student=?').get(text(body.id, 40), student)
      const msg = text(body.body, 1500)
      if (!row || !msg) return reply(400, { error: 'اكتب ملاحظتك' })
      db.prepare("INSERT INTO physics_messages(kind,student,page,author,body,created) VALUES('note',?,?,'student',?,?)").run(student, row.id, msg, Date.now())
      return reply(200, pageView(db.prepare('SELECT * FROM physics_notebook WHERE id=?').get(row.id), 'student'))
    }

    // ask the teacher
    if (path === '/api/ask' && GET) {
      const roots = db.prepare("SELECT * FROM physics_messages WHERE kind='ask' AND thread IS NULL AND student=? ORDER BY id DESC").all(student)
      const out = roots.map(r => ({ ...r, replies: db.prepare("SELECT id, author, body, created FROM physics_messages WHERE kind='ask' AND thread=? ORDER BY id").all(r.id) }))
      db.prepare("UPDATE physics_messages SET seen=1 WHERE kind='ask' AND student=? AND author='teacher'").run(student)
      return reply(200, out)
    }
    if (path === '/api/ask' && POST) {
      const msg = text(body.body, 1500)
      if (!msg) return reply(400, { error: 'اكتب سؤالك' })
      const qid = typeof body.question === 'string' && question(body.question) ? body.question : null
      const page = typeof body.page === 'string' && db.prepare('SELECT id FROM physics_notebook WHERE id=? AND student=?').get(body.page, student) ? body.page : null
      const thread = Number.isInteger(body.thread) && db.prepare("SELECT id FROM physics_messages WHERE id=? AND student=? AND kind='ask' AND thread IS NULL").get(body.thread, student) ? body.thread : null
      db.prepare("INSERT INTO physics_messages(kind,thread,student,question,page,author,body,created) VALUES('ask',?,?,?,?,'student',?,?)").run(thread, student, qid, page, msg, Date.now())
      return reply(201, { ok: true })
    }
    if (path === '/api/leaderboard' && GET) return reply(200, leaderboard(student))
    return reply(404, { error: 'غير متاح' })
  }

  function adminRoute(path, req, res, reply, body, GET, POST) {
    if (path === '/api/admin/overview' && GET) {
      const since = Date.now() - DAY
      return reply(200, {
        students: db.prepare('SELECT count(*) n FROM physics_profiles').get().n,
        activeToday: db.prepare('SELECT count(DISTINCT student) n FROM physics_attempts WHERE at>=?').get(since).n,
        checksToday: db.prepare('SELECT count(*) n FROM physics_attempts WHERE at>=?').get(since).n,
        pendingNotebooks: db.prepare("SELECT count(*) n FROM physics_notebook WHERE status='submitted'").get().n,
        unreadQuestions: db.prepare("SELECT count(*) n FROM physics_messages WHERE author='student' AND seen=0").get().n,
        classes: db.prepare('SELECT count(*) n FROM physics_classes').get().n,
        tests: db.prepare('SELECT count(*) n FROM physics_tests').get().n,
        weakest: (() => {
          const rows = db.prepare('SELECT lo, avg(score) a, count(*) n FROM physics_attempts GROUP BY lo HAVING n>=3 ORDER BY a LIMIT 8').all()
          return rows.map(r => ({ lo: r.lo, average: Math.round(r.a * 100), attempts: r.n, en: cardById.get(r.lo)?.en, ar: cardById.get(r.lo)?.ar }))
        })(),
      })
    }
    if (path === '/api/admin/cards' && GET) return reply(200, cards)
    if (path === '/api/admin/students' && GET) {
      const cls = new URL(req.url, 'http://x').searchParams.get('class')
      const rows = cls ? db.prepare('SELECT student, name, school, code, class_code AS classCode FROM physics_profiles WHERE class_code=? ORDER BY name').all(cls) : db.prepare('SELECT student, name, school, code, class_code AS classCode FROM physics_profiles ORDER BY name').all()
      return reply(200, rows.map(studentSummary))
    }
    if (path.startsWith('/api/admin/student/') && GET) {
      const id = path.slice(19)
      const r = db.prepare('SELECT student, name, school, code, class_code AS classCode FROM physics_profiles WHERE student=?').get(id)
      if (!r) return reply(404, { error: 'الطالب غير موجود' })
      const m = mastery(id), s = streakOf(id)
      const mocks = db.prepare('SELECT * FROM physics_mocks WHERE student=? ORDER BY rowid DESC').all(id).map(row => ({ id: row.id, grade: row.grade, title: row.title, testId: row.test_id, done: Boolean(row.done || Date.now() >= row.deadline), ...mockScore(row, id) }))
      const written = db.prepare('SELECT question, response, checked FROM physics_progress WHERE student=?').all(id)
        .map(p => ({ p, q: question(p.question) })).filter(x => x.q?.kind === 'FRQ' && x.p.response)
        .map(({ p, q }) => { const g = grade(q, unpack(p.response)); return { question: q.id, lo: q.lo_id, en: q.question_en, ar: q.question_ar, response: unpack(p.response), auto: g.total ? { score: g.score, total: g.total, verdict: g.verdict } : null, teacher: override.get(id, q.id) || null, checked: Boolean(p.checked) } })
      const pages = db.prepare(`SELECT ${pageMeta} FROM physics_notebook WHERE student=? ORDER BY updated DESC`).all(id)
      return reply(200, { ...studentSummary(r), mastery: m, streakInfo: s, badges: badges(id, m, s), mocks, written, pages, mistakes: db.prepare('SELECT count(*) n FROM physics_mistakes WHERE student=?').get(id).n })
    }
    if (path === '/api/admin/student/class' && POST) {
      const code = text(body.classCode, 12).toUpperCase() || null
      if (code && !db.prepare('SELECT 1 FROM physics_classes WHERE code=?').get(code)) return reply(400, { error: 'رمز الصف غير صحيح' })
      db.prepare('UPDATE physics_profiles SET class_code=? WHERE student=?').run(code, text(body.student, 40))
      return reply(200, { ok: true })
    }
    if (path === '/api/admin/grade' && POST) {
      const st = text(body.student, 40), qid = text(body.question, 40)
      if (!question(qid)) return reply(404, { error: 'السؤال غير موجود' })
      if (body.score === null || body.score === '') {
        db.prepare('DELETE FROM physics_grade_overrides WHERE student=? AND question=?').run(st, qid)
        // the withdrawn mark must stop counting: record the automatic score again, or forget the question if never answered
        const saved = db.prepare('SELECT response FROM physics_progress WHERE student=? AND question=? AND checked=1').get(st, qid)
        const auto = saved?.response ? scoreOf(question(qid), saved.response) : null
        if (auto === null) db.prepare('DELETE FROM physics_attempts WHERE student=? AND question=?').run(st, qid)
        else db.prepare('INSERT INTO physics_attempts VALUES(?,?,?,?,?)').run(st, qid, question(qid).lo_id, auto, Date.now())
      }
      else {
        const score = Number(body.score), total = Number(body.total)
        if (!(total > 0) || !(score >= 0) || score > total) return reply(400, { error: 'تحقق من الدرجة' })
        db.prepare('INSERT INTO physics_grade_overrides VALUES(?,?,?,?,?,?) ON CONFLICT(student,question) DO UPDATE SET score=excluded.score,total=excluded.total,note=excluded.note,updated=excluded.updated').run(st, qid, score, total, text(body.note, 1000) || null, Date.now())
        db.prepare('INSERT INTO physics_attempts VALUES(?,?,?,?,?)').run(st, qid, question(qid).lo_id, score / total, Date.now())
      }
      return reply(200, { ok: true })
    }
    // classes
    if (path === '/api/admin/classes' && GET) return reply(200, db.prepare('SELECT c.*, (SELECT count(*) FROM physics_profiles p WHERE p.class_code=c.code) students FROM physics_classes c ORDER BY created DESC').all())
    if (path === '/api/admin/classes' && POST) {
      const name = text(body.name, 60)
      if (!name) return reply(400, { error: 'اكتب اسم الصف' })
      let code
      do code = 'PH' + Math.floor(1000 + Math.random() * 9000); while (db.prepare('SELECT 1 FROM physics_classes WHERE code=?').get(code))
      db.prepare('INSERT INTO physics_classes VALUES(?,?,?,0,?)').run(code, name, [9, 10, 11, 12].includes(Number(body.grade)) ? Number(body.grade) : null, Date.now())
      return reply(201, { code })
    }
    if (path === '/api/admin/classes/leaderboard' && POST) {
      db.prepare('UPDATE physics_classes SET leaderboard=? WHERE code=?').run(body.on ? 1 : 0, text(body.code, 12))
      return reply(200, { ok: true })
    }
    if (path === '/api/admin/classes/delete' && POST) {
      const code = text(body.code, 12)
      db.prepare('UPDATE physics_profiles SET class_code=NULL WHERE class_code=?').run(code)
      db.prepare('DELETE FROM physics_classes WHERE code=?').run(code)
      return reply(200, { ok: true })
    }
    // tests
    if (path === '/api/admin/questions' && GET) {
      const lo = new URL(req.url, 'http://x').searchParams.get('lo')
      const card = cardById.get(lo)
      if (!card) return reply(404, { error: 'المؤشر غير موجود' })
      return reply(200, bank.prepare('SELECT id, kind, question_en en, question_ar ar FROM questions WHERE lo_id=? ORDER BY id').all(lo).map(q => ({ ...q, blueprint: q.kind === card.examType })))
    }
    if (path === '/api/admin/tests' && GET) {
      return reply(200, db.prepare('SELECT * FROM physics_tests ORDER BY created DESC').all().map(t => ({ ...t, ids: JSON.parse(t.ids), attempts: db.prepare('SELECT count(*) n FROM physics_mocks WHERE test_id=?').get(t.id).n })))
    }
    if (path === '/api/admin/tests' && POST) {
      const g = Number(body.grade), title = text(body.title, 80)
      if (![9, 10, 11, 12].includes(g) || !title) return reply(400, { error: 'اكتب عنوان الاختبار واختر الصف' })
      const ids = body.mode === 'manual' ? (Array.isArray(body.ids) ? body.ids.filter(id => question(id)) : []) : generate({ grade: g, kpis: body.kpis, perKpi: body.perKpi })
      if (!ids.length) return reply(400, { error: 'اختر سؤالًا واحدًا على الأقل' })
      const classCode = text(body.classCode, 12) || null
      const deadline = body.deadline ? Date.parse(body.deadline) : null
      const id = randomUUID()
      db.prepare('INSERT INTO physics_tests VALUES(?,?,?,?,?,?,?)').run(id, title, g, JSON.stringify(ids), classCode, Number.isFinite(deadline) ? deadline : null, Date.now())
      return reply(201, { id, count: ids.length })
    }
    if (path.startsWith('/api/admin/tests/') && GET) {
      const t = db.prepare('SELECT * FROM physics_tests WHERE id=?').get(path.slice(17))
      if (!t) return reply(404, { error: 'الاختبار غير موجود' })
      const ids = JSON.parse(t.ids)
      const results = db.prepare('SELECT m.*, p.name, p.school FROM physics_mocks m JOIN physics_profiles p ON p.student=m.student WHERE m.test_id=? ORDER BY p.name').all(t.id)
        .map(row => ({ student: row.student, name: row.name, school: row.school, done: Boolean(row.done || Date.now() >= row.deadline), ...mockScore(row) }))
      const perQuestion = ids.map(id => { const q = question(id); const s = results.filter(r => r.done).map(r => r.perQuestion.find(x => x.id === id)?.score ?? 0); return { id, lo: q?.lo_id, kind: q?.kind, en: q?.question_en, average: s.length ? Math.round(100 * s.reduce((a, b) => a + b, 0) / s.length) : null } })
      return reply(200, { ...t, ids, results, perQuestion })
    }
    if (path === '/api/admin/tests/delete' && POST) {
      db.prepare('DELETE FROM physics_tests WHERE id=?').run(text(body.id, 40))
      return reply(200, { ok: true })
    }
    // notebooks
    if (path === '/api/admin/notebook' && GET) {
      const status = new URL(req.url, 'http://x').searchParams.get('status') || 'submitted'
      const rows = db.prepare(`SELECT n.id, n.question, n.title, n.status, n.updated, n.submitted, p.name, p.school, p.student FROM physics_notebook n JOIN physics_profiles p ON p.student=n.student WHERE (?='all' OR n.status=?) ORDER BY coalesce(n.submitted, n.updated) DESC LIMIT 300`).all(status, status)
      return reply(200, rows.map(r => ({ ...r, unread: db.prepare("SELECT count(*) n FROM physics_messages WHERE kind='note' AND page=? AND author='student' AND seen=0").get(r.id).n })))
    }
    if (path.startsWith('/api/admin/notebook/page/') && GET) {
      const row = db.prepare('SELECT n.*, p.name FROM physics_notebook n JOIN physics_profiles p ON p.student=n.student WHERE n.id=?').get(path.slice(25))
      return row ? reply(200, { ...pageView(row, 'teacher'), student: row.student, name: row.name }) : reply(404, { error: 'الصفحة غير موجودة' })
    }
    if (path === '/api/admin/notebook/review' && POST) {
      const row = db.prepare('SELECT * FROM physics_notebook WHERE id=?').get(text(body.id, 40))
      if (!row || !validStrokes(body.annotations)) return reply(400, { error: 'بيانات التصحيح غير صالحة' })
      db.prepare('INSERT INTO physics_notebook_reviews VALUES(?,?,?,?) ON CONFLICT(page) DO UPDATE SET annotations=excluded.annotations,score=excluded.score,updated=excluded.updated').run(row.id, JSON.stringify(body.annotations), text(body.score, 20) || null, Date.now())
      if (['reviewed', 'revise', 'submitted'].includes(body.status)) db.prepare('UPDATE physics_notebook SET status=? WHERE id=?').run(body.status, row.id)
      const note = text(body.comment, 1500)
      if (note) db.prepare("INSERT INTO physics_messages(kind,student,page,author,body,created) VALUES('note',?,?,'teacher',?,?)").run(row.student, row.id, note, Date.now())
      return reply(200, pageView(db.prepare('SELECT * FROM physics_notebook WHERE id=?').get(row.id), 'teacher'))
    }
    if (path.startsWith('/api/admin/figure/') && GET) {
      const [, , , , id, role, index] = path.split('/')
      return figureFor(res, question(id), role === 'solution' ? 'solution' : 'question', index) || reply(404, { error: 'الصورة غير متاحة' })
    }
    // inbox
    if (path === '/api/admin/inbox' && GET) {
      const roots = db.prepare("SELECT m.*, p.name, p.school FROM physics_messages m LEFT JOIN physics_profiles p ON p.student=m.student WHERE m.kind='ask' AND m.thread IS NULL ORDER BY m.id DESC LIMIT 200").all()
      const out = roots.map(r => { const q = r.question && question(r.question); return { ...r, questionText: q ? q.question_en : null, replies: db.prepare("SELECT id, author, body, created, seen FROM physics_messages WHERE kind='ask' AND thread=? ORDER BY id").all(r.id) } })
      db.prepare("UPDATE physics_messages SET seen=1 WHERE kind='ask' AND author='student'").run()
      return reply(200, out)
    }
    if (path === '/api/admin/inbox/reply' && POST) {
      const root = db.prepare("SELECT * FROM physics_messages WHERE id=? AND kind='ask' AND thread IS NULL").get(Number(body.id))
      const msg = text(body.body, 1500)
      if (!root || !msg) return reply(400, { error: 'اكتب الرد' })
      db.prepare("INSERT INTO physics_messages(kind,thread,student,author,body,created) VALUES('ask',?,?,'teacher',?,?)").run(root.id, root.student, msg, Date.now())
      return reply(201, { ok: true })
    }
    // rubrics
    if (path.startsWith('/api/admin/rubric/') && GET) {
      const q = question(path.slice(18))
      if (!q || q.kind !== 'FRQ') return reply(404, { error: 'اختر سؤالًا مقاليًا' })
      const saved = db.prepare('SELECT json FROM physics_rubrics WHERE question=?').get(q.id)
      return reply(200, { id: q.id, en: q.question_en, ar: q.question_ar, solution_en: q.solution_en, solution_ar: q.solution_ar, rubric: rubricFor(q), override: saved ? JSON.parse(saved.json) : fileRubric(q.id), source: saved ? 'teacher' : fileRubric(q.id) ? 'file' : 'automatic' })
    }
    if (path === '/api/admin/rubric' && POST) {
      const q = question(text(body.id, 40))
      if (!q) return reply(404, { error: 'السؤال غير موجود' })
      if (body.override === null) db.prepare('DELETE FROM physics_rubrics WHERE question=?').run(q.id)
      else {
        const o = body.override
        const ok = o && typeof o === 'object' && (!o.numbers || (Array.isArray(o.numbers) && o.numbers.every(n => Array.isArray(n) && Number.isFinite(Number(n[0]))))) && (!o.ideas || (Array.isArray(o.ideas) && o.ideas.every(i => i && (typeof i.key === 'string' || Array.isArray(i.en) || Array.isArray(i.ar)))))
        if (!ok) return reply(400, { error: 'صيغة قائمة التصحيح غير صحيحة' })
        db.prepare('INSERT INTO physics_rubrics VALUES(?,?,?) ON CONFLICT(question) DO UPDATE SET json=excluded.json, updated=excluded.updated').run(q.id, JSON.stringify(o), Date.now())
      }
      setRuntimeRubrics(Object.fromEntries(db.prepare('SELECT question, json FROM physics_rubrics').all().map(r => [r.question, JSON.parse(r.json)])))
      return reply(200, { rubric: rubricFor(q) })
    }
    // exports
    if (path === '/api/admin/export/students.csv' && GET) {
      const rows = db.prepare('SELECT student, name, school, code, class_code AS classCode FROM physics_profiles ORDER BY name').all().map(studentSummary)
      const m = Object.fromEntries(rows.map(r => [r.id, mastery(r.id)]))
      return csv(res, 'students.csv', [['Name', 'School', 'Student code', 'Class', 'Questions answered', 'Average %', 'Streak', 'Points', 'Mastered outcomes', 'Last active'],
        ...rows.map(r => [r.name, r.school, r.code, r.classCode, r.answered, r.average, r.streak, r.points, Object.values(m[r.id]).filter(v => v.level === 'mastered').length, r.lastActive ? new Date(r.lastActive).toISOString().slice(0, 16).replace('T', ' ') : ''])])
    }
    if (path.startsWith('/api/admin/export/test/') && GET) {
      const t = db.prepare('SELECT * FROM physics_tests WHERE id=?').get(path.slice(23).replace(/\.csv$/, ''))
      if (!t) return reply(404, { error: 'الاختبار غير موجود' })
      const ids = JSON.parse(t.ids)
      const results = db.prepare('SELECT m.*, p.name, p.school FROM physics_mocks m JOIN physics_profiles p ON p.student=m.student WHERE m.test_id=? ORDER BY p.name').all(t.id)
      return csv(res, 'test.csv', [['Name', 'School', 'Score', 'Out of', ...ids], ...results.map(row => { const s = mockScore(row); return [row.name, row.school, s.score, s.total, ...s.perQuestion.map(x => Math.round(x.score * 100) / 100)] })])
    }
    return reply(404, { error: 'غير متاح' })
  }

  route.logAttempt = logAttempt
  route.logMock = logMock
  route.withTeacher = withTeacher
  return route
}
