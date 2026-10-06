export interface TopicProgress {
  visitedSteps: string[];
  totalSteps: number;
  lastStepId?: string;
  completed: boolean;
  lastStudied: string; // ISO
}

export interface AnswerRecord {
  topicId: string;
  correct: number;
  wrong: number;
  /** Aciertos consecutivos más recientes. */
  streak: number;
  lastAnsweredAt: string;
  lastWrongAt?: string;
}

/** 'system' se conserva solo por compatibilidad con progreso guardado: se muestra como claro. */
export type Theme = 'system' | 'light' | 'dark';

export interface ProgressState {
  version: 1;
  topics: Record<string, TopicProgress>;
  answers: Record<string, AnswerRecord>;
  lastTopicId?: string;
  /** Días (YYYY-MM-DD) con actividad, para la racha. */
  studyDays: string[];
  preferences: { theme: Theme };
}

export const emptyProgress = (): ProgressState => ({
  version: 1,
  topics: {},
  answers: {},
  studyDays: [],
  preferences: { theme: 'light' },
});
