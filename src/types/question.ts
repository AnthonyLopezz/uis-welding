/** expert = «para corchar»: preguntas con trampa (datos intercambiados, conceptos parecidos). */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface QuestionBase {
  id: string;
  topicId: string;
  /** Sección (paso de estudio) del PDF de donde sale la pregunta. */
  sectionId: string;
  question: string;
  explanation: string;
  difficulty: Difficulty;
  sourcePage?: number;
  /** Imagen que acompaña la pregunta. */
  imageId?: string;
  /** Tabla de la que se tomó el dato (solo trazabilidad). */
  tableId?: string;
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'multiple-choice' | 'true-false' | 'image';
  options: string[];
  correctAnswer: string;
}

export interface MatchingQuestion extends QuestionBase {
  type: 'matching';
  pairs: { left: string; right: string }[];
}

export type Question = ChoiceQuestion | MatchingQuestion;

/** Opción elegida, o en "matching" la columna derecha elegida para cada fila. */
export type Answer = string | string[];
