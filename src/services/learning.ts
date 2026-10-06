// Reglas de aprendizaje: evaluación de respuestas, progreso, dominio, repaso y racha.
// Todo es puro (sin React ni almacenamiento) para poder probarlo en tests/learning.test.ts.
import type { Answer, Question } from '../types/question.ts';
import type { ProgressState, Theme } from '../types/progress.ts';

const DAY = 86_400_000;
export const MASTERY_STREAK = 2;

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function isCorrect(q: Question, answer: Answer): boolean {
  if (q.type === 'matching') return Array.isArray(answer) && q.pairs.every((p, i) => answer[i] === p.right);
  return answer === q.correctAnswer;
}

// ---------- Reducer ----------

export type ProgressAction =
  | { type: 'visitStep'; topicId: string; stepId: string; totalSteps: number; now: Date }
  | { type: 'completeTopic'; topicId: string; now: Date }
  | { type: 'answer'; question: Question; correct: boolean; now: Date }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'replace'; state: ProgressState };

function touchDay(state: ProgressState, now: Date): string[] {
  const d = dayKey(now);
  return state.studyDays.includes(d) ? state.studyDays : [...state.studyDays, d].slice(-120);
}

export function progressReducer(state: ProgressState, action: ProgressAction): ProgressState {
  switch (action.type) {
    case 'visitStep': {
      const prev = state.topics[action.topicId];
      const visited = prev?.visitedSteps.includes(action.stepId) ? prev.visitedSteps : [...(prev?.visitedSteps ?? []), action.stepId];
      return {
        ...state,
        lastTopicId: action.topicId,
        studyDays: touchDay(state, action.now),
        topics: {
          ...state.topics,
          [action.topicId]: {
            visitedSteps: visited,
            totalSteps: action.totalSteps,
            lastStepId: action.stepId,
            completed: prev?.completed ?? false,
            lastStudied: action.now.toISOString(),
          },
        },
      };
    }
    case 'completeTopic': {
      const prev = state.topics[action.topicId];
      if (!prev) return state;
      return {
        ...state,
        topics: { ...state.topics, [action.topicId]: { ...prev, completed: true, lastStudied: action.now.toISOString() } },
      };
    }
    case 'answer': {
      const { question: q, correct, now } = action;
      const prev = state.answers[q.id];
      return {
        ...state,
        studyDays: touchDay(state, now),
        answers: {
          ...state.answers,
          [q.id]: {
            topicId: q.topicId,
            correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
            wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
            streak: correct ? (prev?.streak ?? 0) + 1 : 0,
            lastAnsweredAt: now.toISOString(),
            lastWrongAt: correct ? prev?.lastWrongAt : now.toISOString(),
          },
        },
      };
    }
    case 'setTheme':
      return { ...state, preferences: { ...state.preferences, theme: action.theme } };
    case 'replace':
      return action.state;
  }
}

// ---------- Estadísticas derivadas (no se guardan, se calculan) ----------

export function topicPercent(state: ProgressState, topicId: string): number {
  const t = state.topics[topicId];
  if (!t) return 0;
  if (t.completed) return 100;
  return t.totalSteps ? Math.min(99, Math.round((t.visitedSteps.length / t.totalSteps) * 100)) : 0;
}

export interface AnswerStats { answered: number; correct: number; wrong: number; accuracy: number; mastered: number }

export function answerStats(state: ProgressState, topicId?: string): AnswerStats {
  const recs = Object.values(state.answers).filter((r) => !topicId || r.topicId === topicId);
  const correct = recs.reduce((n, r) => n + r.correct, 0);
  const wrong = recs.reduce((n, r) => n + r.wrong, 0);
  const answered = correct + wrong;
  return {
    answered, correct, wrong,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    mastered: recs.filter((r) => r.streak >= MASTERY_STREAK).length,
  };
}

export const overallPercent = (state: ProgressState, topicIds: string[]) =>
  topicIds.length ? Math.round(topicIds.reduce((n, id) => n + topicPercent(state, id), 0) / topicIds.length) : 0;

/** Pregunta fallada que aún no se ha dominado. */
export const needsReview = (state: ProgressState, questionId: string) => {
  const r = state.answers[questionId];
  return !!r && r.wrong > 0 && r.streak < MASTERY_STREAK;
};

const daysSince = (iso: string | undefined, now: Date) => (iso ? (now.getTime() - new Date(iso).getTime()) / DAY : Infinity);

/**
 * Prioridad de repaso: errores recientes > tema con baja precisión > tema no estudiado recientemente > no dominada.
 * ponytail: heurística lineal con pesos fijos; si hace falta repetición espaciada real, sustituir por SM-2 (intervalo + factor de facilidad por pregunta).
 */
export function reviewScore(q: Question, state: ProgressState, now: Date): number {
  const rec = state.answers[q.id];
  const topic = answerStats(state, q.topicId);
  const recentError = rec?.lastWrongAt ? 3 * Math.exp(-daysSince(rec.lastWrongAt, now) / 7) : 0;
  const lowAccuracy = topic.answered ? 2 * (1 - topic.accuracy / 100) : 0;
  const stale = Math.min(daysSince(state.topics[q.topicId]?.lastStudied, now), 30) * 0.05;
  const notMastered = (rec?.streak ?? 0) >= MASTERY_STREAK ? 0 : 1;
  return (needsReview(state, q.id) ? 5 : 0) + recentError + lowAccuracy + stale + notMastered;
}

/** Preguntas a repasar: primero las falladas; si no hay, las de temas ya iniciados que aún no se dominan. */
export function buildReview(questions: Question[], state: ProgressState, now: Date, size = 10): Question[] {
  const started = new Set([...Object.keys(state.topics), ...Object.values(state.answers).map((a) => a.topicId)]);
  return questions
    .filter((q) => needsReview(state, q.id) || (started.has(q.topicId) && (state.answers[q.id]?.streak ?? 0) < MASTERY_STREAK))
    .map((q) => ({ q, s: reviewScore(q, state, now) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, size)
    .map(({ q }) => q);
}

export interface WeakTopic { topicId: string; reason: string }

/** Temas que conviene reforzar, con el motivo legible. */
export function weakTopics(state: ProgressState, topicIds: string[], now: Date): WeakTopic[] {
  const out: WeakTopic[] = [];
  for (const id of topicIds) {
    const stats = answerStats(state, id);
    const pending = Object.entries(state.answers).filter(([qid, r]) => r.topicId === id && needsReview(state, qid)).length;
    const t = state.topics[id];
    if (pending) out.push({ topicId: id, reason: `${pending} ${pending === 1 ? 'pregunta' : 'preguntas'} por corregir` });
    else if (stats.answered >= 3 && stats.accuracy < 70) out.push({ topicId: id, reason: `Precisión del ${stats.accuracy} %` });
    else if (t && !t.completed && daysSince(t.lastStudied, now) > 7) out.push({ topicId: id, reason: 'Sin estudiar hace más de una semana' });
  }
  return out;
}

/** Días consecutivos con actividad terminando hoy (o ayer, si hoy aún no se estudia). */
export function studyStreak(days: string[], now: Date): number {
  const set = new Set(days);
  const d = new Date(now);
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
