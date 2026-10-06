import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Eye, Image as ImageIcon } from 'lucide-react';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { getTopics } from '../services/contentRepository.ts';
import { DIFFICULTIES, DIFFICULTY_LABEL, getAllQuestions } from '../services/questionRepository.ts';
import { AsyncView, EmptyState } from '../components/States.tsx';
import { PageHeader } from '../components/Layout.tsx';
import { SourceRef } from '../components/SourceRef.tsx';
import type { Difficulty, Question } from '../types/question.ts';

const LEVEL_HINT: Record<Difficulty, string> = {
  easy: 'Datos y definiciones que aparecen directamente en las láminas.',
  medium: 'Comprender y aplicar: por qué ocurre algo, qué elegir en una situación.',
  hard: 'Relacionar conceptos, leer diagramas y tablas, comparar procesos.',
  expert: 'Distinguir datos, cifras y conceptos muy parecidos entre sí.',
};

/** La respuesta solo se monta al abrir la tarjeta: primero se intenta responder mentalmente. */
function BankItem({ q, n }: { q: Question; n: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card bank-item">
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>
          <span className="bank-item__n">{n}.</span>
          <span className="bank-item__q">
            {q.question}
            {q.imageId && <span className="muted bank-item__img"> <ImageIcon size={14} aria-hidden /> con imagen</span>}
          </span>
          <span className="bank-item__toggle"><Eye size={16} aria-hidden /> {open ? 'Ocultar' : 'Ver respuesta'}</span>
        </summary>
        {open && (
          <div className="stack">
            {q.type === 'matching' ? (
              <ul className="content-list">{q.pairs.map((p) => <li key={p.left}><strong>{p.left}</strong> → {p.right}</li>)}</ul>
            ) : (
              <ol className="bank-options" type="A">
                {q.options.map((o) => (
                  <li key={o} className={o === q.correctAnswer ? 'is-correct' : undefined}>
                    {o}{o === q.correctAnswer && <strong> ✓ Respuesta correcta</strong>}
                  </li>
                ))}
              </ol>
            )}
            <p><strong>Justificación:</strong> {q.explanation}</p>
            <SourceRef question={q} />
            <Link className="btn btn--ghost btn--sm" to={`/pregunta/${q.id}`}>Practicar esta pregunta</Link>
          </div>
        )}
      </details>
    </li>
  );
}

export default function QuestionBank() {
  useDocumentMeta('Banco de preguntas');
  const [params, setParams] = useSearchParams();
  const topicId = params.get('tema') ?? '';
  const level = (params.get('nivel') ?? '') as Difficulty | '';
  const data = useAsync(async () => ({ topics: await getTopics(), questions: await getAllQuestions() }), []);
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Banco de preguntas">
        <p className="muted">Todas las preguntas, de las más fáciles a las de desafío. Intenta responder antes de abrir cada una: verás la respuesta, su justificación y dónde está la información en el material.</p>
      </PageHeader>
      <AsyncView state={data}>
        {({ topics, questions }) => {
          const pool = questions.filter((q) => !topicId || q.topicId === topicId);
          const levels = DIFFICULTIES.filter((d) => !level || d === level);
          let n = 0;
          return (
            <>
              <div className="filters filters--simple card">
                <div className="field">
                  <label htmlFor="b-topic">Tema</label>
                  <select id="b-topic" value={topicId} onChange={(e) => setFilter('tema', e.target.value)}>
                    <option value="">Todos los temas</option>
                    {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div className="chips-row" role="group" aria-label="Filtrar por dificultad">
                  <button className="chip" aria-pressed={!level} onClick={() => setFilter('nivel', '')}>Todas</button>
                  {DIFFICULTIES.map((d) => (
                    <button key={d} className="chip" aria-pressed={level === d} onClick={() => setFilter('nivel', d)}>
                      {DIFFICULTY_LABEL[d]} ({pool.filter((q) => q.difficulty === d).length})
                    </button>
                  ))}
                </div>
              </div>

              {pool.length === 0 && <EmptyState title="Este documento aún no tiene preguntas" />}
              {levels.map((d) => {
                const list = pool.filter((q) => q.difficulty === d);
                if (!list.length) return null;
                return (
                  <section key={d} aria-labelledby={`lvl-${d}`}>
                    <h2 id={`lvl-${d}`} className="group-title">
                      <span className={`badge badge--${d}`}>{DIFFICULTY_LABEL[d]}</span> {list.length} preguntas
                    </h2>
                    <p className="muted">{LEVEL_HINT[d]}</p>
                    <ol className="bank">
                      {list.map((q) => <BankItem key={q.id} q={q} n={++n} />)}
                    </ol>
                  </section>
                );
              })}
              <div className="actions">
                <Link className="btn btn--primary" to={`/evaluacion${topicId ? `?tema=${topicId}` : ''}`}>Ponerme a prueba</Link>
              </div>
            </>
          );
        }}
      </AsyncView>
    </div>
  );
}
