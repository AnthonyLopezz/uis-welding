import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Question } from '../types/question.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { QuestionCard, type AnsweredState } from './QuestionCard.tsx';
import { ProgressBar } from './ProgressBar.tsx';

export interface QuizResult { question: Question; correct: boolean }

export function QuizProgress({ index, total, answered }: { index: number; total: number; answered: number }) {
  return (
    <div className="quiz-progress">
      <p><strong>Pregunta {index + 1} / {total}</strong> <span className="muted">· {answered} respondidas</span></p>
      <ProgressBar value={(answered / total) * 100} label="Avance del cuestionario" size="sm" showValue={false} />
    </div>
  );
}

/** Secuencia de preguntas compartida por Repaso, Evaluación y práctica por tema. */
export function QuizRunner({ questions, onFinish }: { questions: Question[]; onFinish: (results: QuizResult[]) => void }) {
  const { recordAnswer } = useProgress();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnsweredState>>({});
  const q = questions[index];
  const isLast = index === questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  const finish = () => onFinish(questions.filter((x) => answers[x.id]).map((x) => ({ question: x, correct: answers[x.id].correct })));
  const next = () => (isLast ? finish() : setIndex(index + 1));

  return (
    <div className="quiz">
      <QuizProgress index={index} total={questions.length} answered={answeredCount} />
      <QuestionCard
        key={q.id}
        question={q}
        answered={answers[q.id]}
        onSubmit={(answer, correct) => {
          setAnswers((a) => ({ ...a, [q.id]: { answer, correct } }));
          recordAnswer(q, correct);
        }}
        onContinue={next}
        continueLabel={isLast ? 'Ver resultados' : 'Siguiente pregunta'}
      />
      <nav className="pager" aria-label="Navegación entre preguntas">
        <button className="btn btn--ghost" onClick={() => setIndex(index - 1)} disabled={index === 0}>
          <ArrowLeft size={18} aria-hidden /> Anterior
        </button>
        <button className="btn btn--ghost" onClick={next} disabled={!answers[q.id]}>
          {isLast ? 'Ver resultados' : 'Siguiente'} <ArrowRight size={18} aria-hidden />
        </button>
      </nav>
    </div>
  );
}
