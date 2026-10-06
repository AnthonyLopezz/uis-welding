// Valida que cada pregunta sea rastreable hasta el contenido real de output/ y que esté bien formada.
// Corre en `npm run check` (y antes de cada build). Sale con código 1 si encuentra errores.
import { readdirSync, readFileSync } from 'node:fs';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'];
const TYPES = ['multiple-choice', 'true-false', 'image', 'matching'];
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const errors = [];
const ids = new Set();
let total = 0;

for (const file of readdirSync('src/data/questions')) {
  const slug = file.replace(/\.json$/, '');
  const doc = read(`output/documents/${slug}/content.json`);
  const sections = new Map(doc.sections.map((s) => [s.id, s]));
  const images = new Set(doc.images.map((i) => i.id));
  const tables = new Set(doc.tables.map((t) => t.id));

  for (const q of read(`src/data/questions/${file}`)) {
    total++;
    const err = (msg) => errors.push(`${file} ${q.id ?? '(sin id)'}: ${msg}`);
    if (ids.has(q.id)) err('id duplicado');
    ids.add(q.id);
    if (q.topicId !== slug) err(`topicId "${q.topicId}" no coincide con el archivo`);
    if (!TYPES.includes(q.type)) err(`tipo inválido "${q.type}"`);
    if (!DIFFICULTIES.includes(q.difficulty)) err(`dificultad inválida "${q.difficulty}"`);
    if (!q.question?.trim() || !q.explanation?.trim()) err('falta enunciado o justificación');

    const section = sections.get(q.sectionId);
    if (!section) err(`sectionId "${q.sectionId}" no existe en el documento`);
    else if (!section.content.length) err(`sectionId "${q.sectionId}" no tiene contenido (no es un paso de estudio)`);
    else if (q.sourcePage !== undefined && q.sourcePage !== section.page) err(`sourcePage ${q.sourcePage} ≠ página de la sección ${section.page}`);
    if (q.imageId && !images.has(q.imageId)) err(`imageId "${q.imageId}" no existe`);
    if (q.type === 'image' && !q.imageId) err('pregunta de imagen sin imageId');
    if (q.tableId && !tables.has(q.tableId)) err(`tableId "${q.tableId}" no existe`);

    if (q.type === 'matching') {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) err('matching necesita al menos 2 pares');
      else if (new Set(q.pairs.map((p) => p.right)).size !== q.pairs.length) err('matching con respuestas repetidas');
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2) err('faltan opciones');
      else if (!q.options.includes(q.correctAnswer)) err('correctAnswer no está entre las opciones');
      else if (new Set(q.options).size !== q.options.length) err('opciones repetidas');
    }
  }
}

if (errors.length) {
  console.error(`validate-questions: ${errors.length} errores\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`validate-questions: ${total} preguntas válidas y rastreables`);
