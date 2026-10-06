import { useId, useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, Check, X } from 'lucide-react';
import type { Answer, ChoiceQuestion, MatchingQuestion, Question } from '../types/question.ts';
import { isCorrect } from '../services/learning.ts';
import { DIFFICULTY_LABEL, shuffle } from '../services/questionRepository.ts';
import { getTopicById } from '../services/contentRepository.ts';
import { useAsync } from '../hooks/useAsync.ts';
import { ImageFigure } from './ImageFigure.tsx';
import { SourceRef, StudyLink } from './SourceRef.tsx';

export interface AnsweredState { answer: Answer; correct: boolean }

interface Props {
  question: Question;
  answered?: AnsweredState;
  onSubmit: (answer: Answer, correct: boolean) => void;
  onContinue?: () => void;
  continueLabel?: string;
}

const LETTERS = 'ABCDEFGH';

function QuestionImage({ topicId, imageId }: { topicId: string; imageId: string }) {
  const state = useAsync(() => getTopicById(topicId), [topicId]);
  if (state.status !== 'success') return null;
  const image = state.data?.images.find((i) => i.id === imageId);
  return image ? <ImageFigure image={image} showGuide={false} /> : null;
}

export function AnswerOption({ name, letter, label, checked, disabled, state, onChange }: {
  name: string; letter: string; label: string; checked: boolean; disabled: boolean;
  state?: 'correct' | 'wrong'; onChange: () => void;
}) {
  return (
    <label className={`option ${checked ? 'option--checked' : ''} ${state ? `option--${state}` : ''}`}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} />
      <span className="option__letter" aria-hidden>{letter}</span>
      <span className="option__text">{label}</span>
      {state === 'correct' && <span className="option__mark"><Check size={18} aria-hidden /><span className="sr-only">(respuesta correcta)</span></span>}
      {state === 'wrong' && <span className="option__mark"><X size={18} aria-hidden /><span className="sr-only">(tu respuesta, incorrecta)</span></span>}
    </label>
  );
}

function ChoiceInput({ q, value, onChange, locked }: { q: ChoiceQuestion; value?: string; onChange: (v: string) => void; locked: boolean }) {
  const name = useId();
  const options = useMemo(() => (q.type === 'true-false' ? q.options : shuffle(q.options)), [q]);
  return (
    <div className={q.type === 'true-false' ? 'options options--row' : 'options'}>
      {options.map((opt, i) => (
        <AnswerOption
          key={opt}
          name={name}
          letter={q.type === 'true-false' ? (opt[0] ?? '') : LETTERS[i]}
          label={opt}
          checked={value === opt}
          disabled={locked}
          state={locked ? (opt === q.correctAnswer ? 'correct' : opt === value ? 'wrong' : undefined) : undefined}
          onChange={() => onChange(opt)}
        />
      ))}
    </div>
  );
}

function MatchingInput({ q, value, onChange, locked }: { q: MatchingQuestion; value: string[]; onChange: (v: string[]) => void; locked: boolean }) {
  const rights = useMemo(() => shuffle(q.pairs.map((p) => p.right)), [q]);
  const id = useId();
  return (
    <ul className="matching">
      {q.pairs.map((p, i) => {
        const ok = locked && value[i] === p.right;
        return (
          <li key={p.left} className={locked ? (ok ? 'matching--correct' : 'matching--wrong') : undefined}>
            <label htmlFor={`${id}-${i}`}>{p.left}</label>
            <select
              id={`${id}-${i}`}
              value={value[i] ?? ''}
              disabled={locked}
              onChange={(e) => { const next = [...value]; next[i] = e.target.value; onChange(next); }}
            >
              <option value="">Selecciona…</option>
              {rights.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {locked && !ok && <span className="matching__fix"><Check size={14} aria-hidden /> {p.right}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function FeedbackPanel({ question, correct, onContinue, continueLabel = 'Continuar' }: {
  question: Question; correct: boolean; onContinue?: () => void; continueLabel?: string;
}) {
  return (
    <div className={`feedback feedback--${correct ? 'ok' : 'ko'}`} role="status" aria-live="polite">
      <p className="feedback__title">
        {correct ? <><Check aria-hidden /> ¡Correcto!</> : <><X aria-hidden /> No exactamente.</>}
      </p>
      {question.type !== 'matching' && !correct && <p>La respuesta correcta es: <strong>{question.correctAnswer}</strong></p>}
      <p className="feedback__why"><strong>Justificación:</strong> {question.explanation}</p>
      <SourceRef question={question} />
      <div className="actions">
        {!correct && (
          <StudyLink className="btn btn--ghost" topicId={question.topicId} sectionId={question.sectionId}>
            <BookOpenCheck size={18} aria-hidden /> Volver a estudiar esta parte
          </StudyLink>
        )}
        {onContinue && (
          <button className="btn btn--primary" onClick={onContinue} autoFocus>
            {continueLabel} <ArrowRight size={18} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export function QuestionCard({ question: q, answered, onSubmit, onContinue, continueLabel }: Props) {
  const [choice, setChoice] = useState<string | undefined>(typeof answered?.answer === 'string' ? answered.answer : undefined);
  const [matches, setMatches] = useState<string[]>(Array.isArray(answered?.answer) ? answered.answer : []);
  const locked = !!answered;
  const ready = q.type === 'matching' ? q.pairs.every((_, i) => matches[i]) : !!choice;
  const titleId = useId();

  const submit = () => {
    const answer: Answer = q.type === 'matching' ? matches : choice!;
    onSubmit(answer, isCorrect(q, answer));
  };

  return (
    <form className="question card" aria-labelledby={titleId} onSubmit={(e) => { e.preventDefault(); if (ready && !locked) submit(); }}>
      <p className="question__meta">
        <span className={`badge badge--${q.difficulty}`}>{DIFFICULTY_LABEL[q.difficulty]}</span>
        {q.type === 'matching' && <span className="badge">Relacionar</span>}
        {q.type === 'true-false' && <span className="badge">Verdadero / falso</span>}
        {q.sourcePage && <span className="muted">Lámina {q.sourcePage}</span>}
      </p>
      {q.imageId && <QuestionImage topicId={q.topicId} imageId={q.imageId} />}
      <fieldset>
        <legend id={titleId} className="question__text">{q.question}</legend>
        {q.type === 'matching'
          ? <MatchingInput q={q} value={matches} onChange={setMatches} locked={locked} />
          : <ChoiceInput q={q} value={choice} onChange={setChoice} locked={locked} />}
      </fieldset>
      {answered
        ? <FeedbackPanel question={q} correct={answered.correct} onContinue={onContinue} continueLabel={continueLabel} />
        : <button type="submit" className="btn btn--primary btn--block" disabled={!ready}>Comprobar respuesta</button>}
    </form>
  );
}
