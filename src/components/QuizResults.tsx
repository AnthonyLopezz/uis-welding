import { Link } from 'react-router';
import { Check, RotateCcw, X } from 'lucide-react';
import type { QuizResult } from './QuizRunner.tsx';
import { ProgressBar } from './ProgressBar.tsx';
import { SourceRef } from './SourceRef.tsx';
import { DIFFICULTY_LABEL } from '../services/questionRepository.ts';

function verdict(pct: number) {
  if (pct >= 85) return '✓ Dominaste la mayoría de los conceptos.';
  if (pct >= 60) return 'Vas bien, pero hay conceptos que conviene repasar.';
  return 'Necesitas reforzar estos contenidos antes de avanzar.';
}

/** Resultado compartido por Evaluación y Repaso. */
export function QuizResults({ results, topicTitle, onRestart }: {
  results: QuizResult[]; topicTitle: (id: string) => string; onRestart: () => void;
}) {
  const correct = results.filter((r) => r.correct).length;
  const pct = results.length ? Math.round((correct / results.length) * 100) : 0;
  const wrong = results.filter((r) => !r.correct);
  const weakTopics = [...new Set(wrong.map((r) => r.question.topicId))];

  return (
    <div className="stack-lg">
      <section className="card result" aria-labelledby="res-title">
        <h1 id="res-title">Resultado</h1>
        <p className="result__score"><strong>{correct} / {results.length}</strong> <span>{pct}%</span></p>
        <ProgressBar value={pct} label="Porcentaje de acierto" size="lg" showValue={false} />
        <p className="result__verdict">{verdict(pct)}</p>
        {weakTopics.length > 0 && (
          <>
            <h2>Debes reforzar:</h2>
            <ul className="link-list">
              {weakTopics.map((id) => <li key={id}><Link to={`/tema/${id}`}>{topicTitle(id)}</Link></li>)}
            </ul>
          </>
        )}
        <div className="actions">
          {wrong.length > 0 && <a className="btn btn--primary" href="#errores">Revisar errores</a>}
          <button className="btn btn--ghost" onClick={onRestart}><RotateCcw size={18} aria-hidden /> Nuevo intento</button>
          <Link className="btn btn--ghost" to="/">Volver al inicio</Link>
        </div>
      </section>

      {results.length > 0 && (
        <section aria-labelledby="errores">
          <h2 id="errores" tabIndex={-1}>Revisión de respuestas</h2>
          <ol className="review-list">
            {results.map(({ question: q, correct: ok }) => (
              <li key={q.id} className={`card review-item review-item--${ok ? 'ok' : 'ko'}`}>
                <p className="review-item__status">
                  {ok ? <><Check size={18} aria-hidden /> Correcta</> : <><X size={18} aria-hidden /> Incorrecta</>}
                  <span className={`badge badge--${q.difficulty}`}>{DIFFICULTY_LABEL[q.difficulty]}</span>
                  <span className="muted"> · {topicTitle(q.topicId)}</span>
                </p>
                <p><strong>{q.question}</strong></p>
                {q.type === 'matching'
                  ? <ul>{q.pairs.map((p) => <li key={p.left}>{p.left} → {p.right}</li>)}</ul>
                  : <p>Respuesta correcta: <strong>{q.correctAnswer}</strong></p>}
                <p><strong>Justificación:</strong> {q.explanation}</p>
                <SourceRef question={q} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
