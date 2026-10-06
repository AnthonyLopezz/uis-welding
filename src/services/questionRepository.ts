// Banco de preguntas escrito a partir del contenido de cada PDF (src/data/questions/<slug>.json).
// Vite separa cada archivo en su propio chunk: solo se descargan cuando se necesitan.
import type { Difficulty, Question } from '../types/question.ts';

const files = import.meta.glob<Question[]>('../data/questions/*.json', { import: 'default' });
const bySlug = Object.fromEntries(
  Object.entries(files).map(([path, load]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), load]),
);

export async function getQuestionsByTopic(topicId: string): Promise<Question[]> {
  return bySlug[topicId] ? bySlug[topicId]() : [];
}

export async function getAllQuestions(): Promise<Question[]> {
  return (await Promise.all(Object.values(bySlug).map((load) => load()))).flat();
}

export async function getQuestionById(id: string): Promise<Question | undefined> {
  return (await getAllQuestions()).find((q) => q.id === id);
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Fácil', medium: 'Media', hard: 'Difícil', expert: 'Para corchar' };

/** Orden progresivo: fácil → media → difícil → para corchar (estable dentro de cada nivel). */
export const byDifficulty = (qs: Question[]) =>
  [...qs].sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty));

export function buildExam(questions: Question[], topicIds: string[], difficulties: Difficulty[], count: number, progressive = true): Question[] {
  const pool = questions.filter((q) => topicIds.includes(q.topicId) && difficulties.includes(q.difficulty));
  const picked = shuffle(pool).slice(0, count);
  return progressive ? byDifficulty(picked) : picked;
}
