import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { fieldsFor } from '../lib/coach.mjs'
import { conceptPractice } from '../public/worked/concept-practice.js'
import sourceFigures from '../public/worked/source-figures.js'

const db = new DatabaseSync(new URL('../bank/physics.sqlite', import.meta.url), { readOnly: true })
assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0)
const outcomes = db.prepare('SELECT * FROM learning_outcomes ORDER BY grade,exam_slot').all()
const bank = new Map(db.prepare('SELECT * FROM questions').all().map(row => [row.id, row]))
const normalizedOptions = db.prepare('SELECT option_key AS key,text_en AS en,text_ar AS ar FROM options WHERE question_id=? ORDER BY option_key')
assert.equal(outcomes.length, 80)
assert.equal(bank.size, 675)
for (const row of outcomes) {
  const outcome = JSON.parse(row.data_json)
  const expected = row.exam_slot <= 16 ? 'MCQ' : 'FRQ'
  const questions = [...bank.values()].filter(q => q.lo_id === row.id)
  assert.equal(outcome.type, expected, row.id)
  assert.ok(outcome.book_pages_reference, row.id)
  assert.ok(questions.length >= 5, row.id)
  assert.equal(outcome.question_count, questions.length, row.id)
  for (const question of questions) {
    const q = JSON.parse(question.data_json)
    assert.equal(q.lo_id, row.id, q.id)
    assert.equal(q.grade, row.grade, q.id)
    assert.equal(q.exam_slot, row.exam_slot, q.id)
    assert.equal(q.kind, expected, q.id)
    for (const field of ['id','grade','exam_slot','kind','answer','question_en','question_ar','solution_en','solution_ar']) {
      assert.ok(q[field], q.id+' '+field)
      assert.equal(q[field], question[field], q.id+' '+field)
    }
    assert.deepEqual(q.options, normalizedOptions.all(q.id).map(o=>({...o})), q.id)
    if (expected === 'MCQ') {
      assert.deepEqual(q.options.map(o=>o.key), ['A','B','C','D'], q.id)
      assert.ok(q.options.some(o=>o.key === q.answer), q.id)
      for (const lang of ['en','ar']) {
        assert.equal(new Set(q.options.map(o=>o[lang].trim())).size, 4, q.id)
      }
    } else {
      assert.equal(q.options.length, 0, q.id)
      assert.ok(fieldsFor(q).length, q.id)
    }
  }
  for (const [id] of conceptPractice[row.id] || []) assert.equal(bank.get(id)?.lo_id, row.id, id)
  for (const {id,asset} of sourceFigures[row.id] || []) {
    assert.equal(bank.get(id)?.lo_id, row.id, id)
    const q=JSON.parse(bank.get(id).data_json)
    assert.ok(q.images.some(i=>i.role==='question' && i.asset_id===asset), id)
  }
}
for (const row of db.prepare('SELECT * FROM previous_questions').all()) {
  assert.equal(JSON.parse(row.data_json).id, row.id)
  assert.ok(!bank.has(row.id) && bank.has(row.replacement), row.id)
}
console.log('Verified 675 bilingual questions, their answer inputs, and all 80 blueprint rows.')
