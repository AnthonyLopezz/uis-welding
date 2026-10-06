import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { answerStats, overallPercent, studyStreak, topicPercent, weakTopics } from '../services/learning.ts';
import { AsyncView } from '../components/States.tsx';
import { PageHeader } from '../components/Layout.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—');

export default function Progress() {
  useDocumentMeta('Mi progreso');
  const catalog = useCatalog();
  const { state, reset } = useProgress();
  const stats = answerStats(state);

  return (
    <AsyncView state={catalog}>
      {({ topics, categories }) => {
        const ids = topics.map((t) => t.id);
        const weak = weakTopics(state, ids, new Date());
        return (
          <div className="stack-lg">
            <PageHeader title="Mi progreso" />

            <section className="card" aria-labelledby="p-general">
              <h2 id="p-general">Progreso general</h2>
              <ProgressBar value={overallPercent(state, ids)} label="Progreso general" size="lg" />
              <p className="muted">Racha de estudio: {studyStreak(state.studyDays, new Date())} días · {state.studyDays.length} días con actividad</p>
            </section>

            <div className="grid grid--2">
              <section className="card" aria-labelledby="p-cat">
                <h2 id="p-cat">Categorías</h2>
                <ul className="bars">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <Link to={`/categoria/${c.id}`}>{c.name}</Link>
                      <ProgressBar value={overallPercent(state, c.topicIds)} label={`Progreso en ${c.name}`} size="sm" />
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card" aria-labelledby="p-q">
                <h2 id="p-q">Preguntas</h2>
                <dl className="kv">
                  <div><dt>Respondidas</dt><dd>{stats.answered}</dd></div>
                  <div><dt>Correctas</dt><dd>{stats.correct}</dd></div>
                  <div><dt>Incorrectas</dt><dd>{stats.wrong}</dd></div>
                  <div><dt>Precisión</dt><dd>{stats.answered ? `${stats.accuracy}%` : '—'}</dd></div>
                  <div><dt>Dominadas</dt><dd>{stats.mastered}</dd></div>
                </dl>
              </section>
            </div>

            <section className="card" aria-labelledby="p-weak">
              <h2 id="p-weak">Temas por reforzar</h2>
              {weak.length ? (
                <ul className="link-list">
                  {weak.map((w) => (
                    <li key={w.topicId}><Link to={`/tema/${w.topicId}`}>{topics.find((t) => t.id === w.topicId)?.title}</Link> <span className="muted">{w.reason}</span></li>
                  ))}
                </ul>
              ) : <p className="muted">No hay temas débiles por ahora.</p>}
            </section>

            <section className="card" aria-labelledby="p-topics">
              <h2 id="p-topics">Detalle por tema</h2>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Detalle por tema">
                <table>
                  <thead>
                    <tr><th scope="col">Tema</th><th scope="col">Avance</th><th scope="col">Precisión</th><th scope="col">Último estudio</th></tr>
                  </thead>
                  <tbody>
                    {topics.map((t) => {
                      const s = answerStats(state, t.id);
                      return (
                        <tr key={t.id}>
                          <th scope="row"><Link to={`/tema/${t.id}`}>{t.title}</Link></th>
                          <td>{topicPercent(state, t.id)}%</td>
                          <td>{s.answered ? `${s.accuracy}% (${s.correct}/${s.answered})` : '—'}</td>
                          <td>{fmtDate(state.topics[t.id]?.lastStudied)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card" id="reiniciar" aria-labelledby="p-reset">
              <h2 id="p-reset">Reiniciar progreso</h2>
              <p className="muted">Tu progreso se guarda solo en este navegador. Reiniciarlo borra temas, respuestas y racha.</p>
              <button className="btn btn--danger"
                onClick={() => confirm('¿Seguro que quieres borrar todo tu progreso? No se puede deshacer.') && reset()}>
                <Trash2 size={18} aria-hidden /> Borrar mi progreso
              </button>
            </section>
          </div>
        );
      }}
    </AsyncView>
  );
}
