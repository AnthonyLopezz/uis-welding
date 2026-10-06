// Prueba mínima de la lógica pura: node --test (Node ≥ 22.18 ejecuta TypeScript sin compilar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReview, isCorrect, progressReducer, studyStreak, topicPercent, weakTopics } from '../src/services/learning.ts';
import { toTopicContent } from '../src/services/normalize.ts';
import { emptyProgress } from '../src/types/progress.ts';
import type { Question } from '../src/types/question.ts';
import type { RawDocument, Topic } from '../src/types/content.ts';

const q = (id: string, topicId = 't1'): Question => ({
  id, topicId, sectionId: 's', type: 'multiple-choice', question: '?', options: ['A', 'B'], correctAnswer: 'A', explanation: '', difficulty: 'easy',
});
const now = new Date('2026-10-06T12:00:00');

test('evalúa opción múltiple y relacionar', () => {
  assert.equal(isCorrect(q('a'), 'A'), true);
  assert.equal(isCorrect(q('a'), 'B'), false);
  const m: Question = { ...q('m'), type: 'matching', pairs: [{ left: 'x', right: '1' }, { left: 'y', right: '2' }] } as Question;
  assert.equal(isCorrect(m, ['1', '2']), true);
  assert.equal(isCorrect(m, ['2', '1']), false);
});

test('progreso por pasos, completado y repaso de errores', () => {
  let s = progressReducer(emptyProgress(), { type: 'visitStep', topicId: 't1', stepId: 'p1', totalSteps: 4, now });
  s = progressReducer(s, { type: 'visitStep', topicId: 't1', stepId: 'p1', totalSteps: 4, now });
  assert.equal(topicPercent(s, 't1'), 25);

  s = progressReducer(s, { type: 'answer', question: q('bad'), correct: false, now });
  s = progressReducer(s, { type: 'answer', question: q('good'), correct: true, now });
  const review = buildReview([q('good'), q('bad'), q('other', 't2')], s, now);
  assert.equal(review[0].id, 'bad', 'el error reciente va primero');
  assert.ok(!review.some((x) => x.id === 'other'), 'no entra un tema no iniciado');
  assert.equal(weakTopics(s, ['t1', 't2'], now)[0]?.topicId, 't1');

  // dos aciertos seguidos dominan la pregunta y sale del repaso pendiente
  s = progressReducer(s, { type: 'answer', question: q('bad'), correct: true, now });
  s = progressReducer(s, { type: 'answer', question: q('bad'), correct: true, now });
  assert.equal(weakTopics(s, ['t1'], now).length, 0);

  s = progressReducer(s, { type: 'completeTopic', topicId: 't1', now });
  assert.equal(topicPercent(s, 't1'), 100);
});

test('racha de días consecutivos', () => {
  assert.equal(studyStreak(['2026-10-04', '2026-10-05', '2026-10-06'], now), 3);
  assert.equal(studyStreak(['2026-10-04', '2026-10-05'], now), 2, 'si hoy aún no se estudia, cuenta hasta ayer');
  assert.equal(studyStreak(['2026-10-01'], now), 0);
});

test('normaliza secciones en lecciones/pasos y nunca muestra null', () => {
  const topic = { id: 'doc' } as Topic;
  const raw: RawDocument = {
    slug: 'doc',
    sections: [
      { id: 'L1', title: 'Lección', level: 1, page: 1, content: [], parent_id: null },
      { id: 'S1', title: null, level: 2, page: 2, parent_id: 'L1', content: [{ type: 'paragraph', text: '  hola   mundo ', page: 2 }] },
      { id: 'S2', title: 'Vacía', level: 2, page: 3, parent_id: 'L1', content: [{ type: 'paragraph', text: null, page: 3 }] },
    ],
    images: [],
    tables: [],
  };
  const c = toTopicContent(topic, raw, '/');
  assert.equal(c.lessons.length, 1);
  assert.deepEqual(c.steps.map((s) => s.id), ['S1'], 'los pasos sin contenido se omiten');
  assert.equal(c.steps[0].title, 'Lección', 'sin título usa el de la lección');
  assert.deepEqual(c.steps[0].blocks, [{ kind: 'text', variant: 'paragraph', text: 'hola mundo' }]);
});

test('todos los documentos reales se normalizan sin huecos y sus imágenes existen', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const index = JSON.parse(readFileSync('output/index.json', 'utf8'));
  for (const entry of index) {
    const raw = JSON.parse(readFileSync(`output/documents/${entry.slug}/content.json`, 'utf8'));
    const c = toTopicContent({ id: entry.slug } as Topic, raw, '/');
    assert.ok(c.steps.length > 0, `${entry.slug} sin pasos`);
    for (const l of c.lessons) assert.ok(l.steps.length > 0, `${entry.slug}: lección vacía ${l.id}`);
    for (const s of c.steps) {
      assert.ok(s.blocks.length > 0, `${entry.slug}: paso vacío ${s.id}`);
      assert.doesNotMatch(JSON.stringify(s), /undefined|"null"|NaN/, `${entry.slug}: valor vacío en ${s.id}`);
    }
    for (const img of c.images) {
      const file = img.src.replace('/images/', 'output/documents/').replace(`${entry.slug}/`, `${entry.slug}/images/`);
      assert.ok(existsSync(file), `${entry.slug}: falta imagen ${file}`);
    }
  }
});
