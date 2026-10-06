import { Link } from 'react-router';
import { ArrowRight, CheckCircle2, Flame, Target, TrendingDown } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { AsyncView } from '../components/States.tsx';
import { CategoryCard } from '../components/Cards.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { answerStats, overallPercent, studyStreak, topicPercent, weakTopics } from '../services/learning.ts';

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Dashboard() {
  useDocumentMeta();
  const catalog = useCatalog();
  const { state } = useProgress();
  const now = new Date();

  return (
    <AsyncView state={catalog}>
      {({ topics, categories, categoryName }) => {
        const ids = topics.map((t) => t.id);
        const completed = ids.filter((id) => topicPercent(state, id) === 100).length;
        const stats = answerStats(state);
        const current = topics.find((t) => t.id === state.lastTopicId);
        const next = current ?? topics.find((t) => topicPercent(state, t.id) < 100) ?? topics[0];
        const nextPct = topicPercent(state, next.id);
        const weak = weakTopics(state, ids, now).slice(0, 4);
        const streak = studyStreak(state.studyDays, now);

        return (
          <div className="stack-lg">
            <section className="hero" aria-labelledby="hero-title">
              <p className="eyebrow">{greeting(now)}</p>
              <h1 id="hero-title">{current ? 'Continúa aprendiendo' : 'Empieza a aprender'}</h1>
              <div className="hero__current">
                <p className="muted">{current ? 'Estás estudiando' : 'Te sugerimos empezar por'} · {categoryName(next.categoryId)}</p>
                <h2>{next.title}</h2>
                <ProgressBar value={nextPct} label={`Progreso en ${next.title}`} />
                <Link className="btn btn--primary" to={`/estudiar/${next.id}${state.topics[next.id]?.lastStepId ? `?paso=${state.topics[next.id].lastStepId}` : ''}`}>
                  {nextPct > 0 ? 'Continuar estudiando' : 'Comenzar estudio'} <ArrowRight size={18} aria-hidden />
                </Link>
              </div>
            </section>

            <section aria-labelledby="sum-title" className="card">
              <h2 id="sum-title">Tu progreso</h2>
              <ProgressBar value={overallPercent(state, ids)} label="Progreso general" size="lg" />
              <ul className="stats">
                <li><CheckCircle2 aria-hidden /><strong>{completed}</strong> temas completados</li>
                <li><Target aria-hidden /><strong>{topics.length - completed}</strong> temas pendientes</li>
                <li><CheckCircle2 aria-hidden /><strong>{stats.mastered}</strong> preguntas dominadas</li>
                <li><Flame aria-hidden /><strong>{streak}</strong> {streak === 1 ? 'día' : 'días'} de racha</li>
              </ul>
            </section>

            <section aria-labelledby="cat-title">
              <div className="section-head">
                <h2 id="cat-title">Categorías</h2>
                <Link to="/explorar">Ver todos los temas</Link>
              </div>
              <div className="grid grid--2">{categories.map((c) => <CategoryCard key={c.id} category={c} />)}</div>
            </section>

            <section aria-labelledby="weak-title" className="card">
              <h2 id="weak-title"><TrendingDown size={22} aria-hidden /> Temas que necesitas reforzar</h2>
              {weak.length ? (
                <>
                  <ul className="link-list">
                    {weak.map((w) => (
                      <li key={w.topicId}>
                        <Link to={`/tema/${w.topicId}`}>{topics.find((t) => t.id === w.topicId)?.title}</Link>
                        <span className="muted">{w.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <Link className="btn btn--ghost" to="/repaso">Comenzar repaso</Link>
                </>
              ) : (
                <p className="muted">Por ahora no hay temas débiles. Responde preguntas mientras estudias y aquí verás qué conviene reforzar.</p>
              )}
            </section>
          </div>
        );
      }}
    </AsyncView>
  );
}
