// End-to-end browser tests: node tests/e2e.mjs  (needs the `playwright` package and Chromium)
// Starts the Node server on a temporary database, then drives a student and a teacher through the main flows.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const PORT = 3900 + Math.floor(Math.random() * 90)
const BASE = `http://localhost:${PORT}`
const dir = mkdtempSync(join(tmpdir(), 'physics-e2e-'))
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(PORT), PHYSICS_DB: join(dir, 'p.sqlite'), PHYSICS_TEACHER_PASSWORD: 'e2e-teacher', PHYSICS_BACKUP_HOURS: '0' }, stdio: ['ignore', 'inherit', 'inherit'] })
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/')).ok) break } catch {} await new Promise(r => setTimeout(r, 200)) }

const browser = await chromium.launch()
const errors = []
let failed = 0
const watch = (page, who) => {
  page.on('pageerror', e => errors.push(`${who}: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error' && !/401 \(Unauthorized\)/.test(m.text())) errors.push(`${who}: ${m.text()}`) })
  page.on('dialog', d => d.accept())
}
async function step(name, fn) {
  try { await fn(); console.log('ok   ', name) } catch (e) { failed++; if (process.env.E2E_SHOTS) { await sp.screenshot({ path: process.env.E2E_SHOTS + '/fail-student.png' }).catch(() => {}); await tp.screenshot({ path: process.env.E2E_SHOTS + '/fail-teacher.png' }).catch(() => {}) } console.log('FAIL ', name, '\n     ', e.message.split('\n').slice(0, 3).join(' ')) }
}
const expect = (cond, msg) => { if (!cond) throw Error(msg) }

const teacherCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const tp = await teacherCtx.newPage(); watch(tp, 'teacher')
const studentCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const sp = await studentCtx.newPage(); watch(sp, 'student')
let classCode, studentCode

await step('teacher signs in and creates a class', async () => {
  await tp.goto(BASE + '/admin.html')
  await tp.fill('#adminPassword', 'e2e-teacher'); await tp.click('#adminLogin .primary')
  await tp.waitForSelector('#tabs button')
  await tp.click('#tabs button:nth-child(3)'); await tp.waitForSelector('.filters input')
  await tp.fill('.filters input', 'Grade 10 A'); await tp.click('.filters .primary')
  await tp.waitForSelector('.code'); classCode = (await tp.textContent('.code')).trim()
  expect(/^PH\d{4}$/.test(classCode), 'class code ' + classCode)
})
await step('student registers with class code and PIN', async () => {
  await sp.goto(BASE + '/')
  await sp.fill('#name', 'Test Student'); await sp.fill('#school', 'Test School'); await sp.fill('#classCode', classCode); await sp.fill('#pin', '2468')
  await sp.click('#loginForm .primary')
  await sp.waitForSelector('#accountDialog[open]')
  studentCode = (await sp.textContent('#accountCode')).trim()
  expect(/^\d{6}$/.test(studentCode), 'student code ' + studentCode)
  await sp.click('#accountClose')
  await sp.waitForSelector('.hub-map .hub-cell')
  expect(await sp.locator('#cards .kpi').count() === 20, '20 outcome cards')
})
await step('multiple choice is marked and queued as a mistake', async () => {
  await sp.click('#cards .kpi >> nth=0'); await sp.waitForSelector('#stem')
  await sp.locator('.paper label').nth(2).click(); await sp.click('#check')
  await sp.waitForSelector('#result:not([hidden])')
  expect(/Incorrect|خاطئة/.test(await sp.textContent('#result h3')), 'incorrect verdict')
})
await step('hint ladder opens two levels', async () => {
  await sp.click('#hint'); await sp.click('.hint-more')
  expect(await sp.locator('.hint-step').count() >= 2, 'two hint levels')
})
await step('notebook: draw, autosave and send to the teacher', async () => {
  await sp.click('#notebookBtn'); await sp.waitForSelector('.notebook-dialog[open] .sketch-canvas')
  const c = await sp.locator('.sketch-canvas').boundingBox()
  await sp.mouse.move(c.x + 60, c.y + 60); await sp.mouse.down()
  for (let i = 0; i < 15; i++) await sp.mouse.move(c.x + 60 + i * 10, c.y + 60 + i * 4)
  await sp.mouse.up()
  await sp.waitForFunction(() => /Saved|محفوظ/.test(document.querySelector('.nb-saved')?.textContent || ''), null, { timeout: 5000 })
  await sp.click('.nb-actions .primary')
  await sp.waitForFunction(() => /Sent|أُرسل/.test(document.querySelector('.nb-status')?.textContent || ''))
  await sp.click('.nb-actions button:last-child')
})
await step('student asks the teacher', async () => {
  await sp.click('#askBtn'); await sp.waitForSelector('#askDialog[open] textarea')
  await sp.fill('#askDialog textarea', 'Why is A correct?'); await sp.click('#askDialog .primary')
  await sp.waitForSelector('.ask-sent:not(:empty)'); await sp.keyboard.press('Escape')
})
await step('written answer is marked automatically', async () => {
  await sp.click('#back'); await sp.click('#gradeTabs button:nth-child(4)')
  await sp.click('#cards .kpi >> nth=17'); await sp.waitForSelector('.full-answer textarea')
  await sp.fill('.full-answer textarea', 'v = 2 m/s, KE before 16 J and after 8 J, so 8 J is converted. Perfectly inelastic; momentum conserved.')
  await sp.click('#check'); await sp.waitForSelector('.grade-report')
  await sp.click('.compare-toggle'); await sp.waitForSelector('.compare:not([hidden]) mark')
})
await step('teacher reviews the notebook page with red ink', async () => {
  await tp.click('#tabs button:nth-child(5)'); await tp.waitForSelector('tr.clickable'); await tp.click('tr.clickable')
  await tp.waitForSelector('.review .sketch-canvas')
  const c = await tp.locator('.review .sketch-canvas').boundingBox()
  await tp.mouse.move(c.x + 90, c.y + 90); await tp.mouse.down(); await tp.mouse.move(c.x + 160, c.y + 40, { steps: 6 }); await tp.mouse.up()
  await tp.fill('.review-side input', '9/10'); await tp.fill('.review-side textarea', 'Add the units')
  await tp.click('.review-side .primary'); await tp.waitForSelector('.thread li')
  expect(await tp.evaluate(() => document.documentElement.scrollWidth) <= 1280, 'no horizontal overflow')
})
await step('teacher replies and assigns a test', async () => {
  await tp.click('#tabs button:nth-child(6)'); await tp.waitForSelector('.thread-card textarea')
  await tp.fill('.thread-card textarea', 'Only temperature changes.'); await tp.click('.thread-card .primary')
  await tp.click('#tabs button:nth-child(4)'); await tp.waitForSelector('.test-builder')
  await tp.fill('.test-builder input', 'Unit test'); await tp.selectOption('.test-builder select >> nth=1', classCode)
  await tp.click('.test-builder .primary'); await tp.waitForSelector('tbody tr.clickable')
})
await step('student sees feedback and starts the assigned test', async () => {
  await sp.click('#back'); await sp.waitForSelector('.hub-action')
  await sp.locator('.hub-action', { hasText: /notebook|دفتري/ }).click(); await sp.waitForSelector('#notebookList[open] li button')
  await sp.click('#notebookList li button'); await sp.waitForSelector('.nb-score')
  expect((await sp.textContent('.nb-score')).includes('9/10'), 'teacher score visible')
  await sp.click('.nb-actions button:last-child')
  await sp.locator('.hub-action', { hasText: /tests|اختباراتي/ }).click(); await sp.waitForSelector('#myTests[open] .primary')
  await sp.click('#myTests .primary'); await sp.waitForSelector('#nav button')
  expect((await sp.textContent('#title')).includes('Unit test'), 'test title')
})
await step('the blueprint mock exam still starts and finishes', async () => {
  await sp.click('#check')   // finish the assigned test first
  await sp.waitForSelector('#title'); await sp.click('#back'); await sp.waitForSelector('#mockStart')
  await sp.click('#gradeTabs button:nth-child(1)'); await sp.click('#mockStart')
  await sp.waitForFunction(() => document.querySelectorAll('#nav button').length === 20)
  await sp.click('#check'); await sp.waitForFunction(() => /Mock review|مراجعة/.test(document.getElementById('title').textContent))
})
await step('student signs in on a phone with code and PIN', async () => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const p = await phone.newPage(); watch(p, 'phone')
  await p.goto(BASE + '/'); await p.click('#tabAccount')
  await p.fill('#studentCode', studentCode); await p.fill('#loginPin', '2468'); await p.click('#loginForm .primary')
  await p.waitForSelector('.hub-map')
  expect(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no horizontal scroll on phone')
  await phone.close()
})
await step('teacher exports students as CSV', async () => {
  const csv = await (await tp.request.get(BASE + '/api/admin/export/students.csv')).text()
  expect(csv.includes('Test Student'), 'student in CSV')
})
await step('no browser errors', async () => expect(!errors.length, errors.join(' | ')))

await browser.close()
server.kill()
rmSync(dir, { recursive: true, force: true })
console.log(failed ? `\n${failed} step(s) failed` : '\nAll end-to-end steps passed')
process.exit(failed ? 1 : 0)
