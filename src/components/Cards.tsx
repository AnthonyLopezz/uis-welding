import { Link } from 'react-router';
import { ArrowRight, BookOpen, CheckCircle2, Layers } from 'lucide-react';
import type { Category, Topic } from '../types/content.ts';
import { ProgressBar } from './ProgressBar.tsx';
import { useProgress } from '../store/ProgressContext.tsx';
import { overallPercent, topicPercent } from '../services/learning.ts';

export function TopicCard({ topic, categoryName, extra }: { topic: Topic; categoryName?: string; extra?: string }) {
  const { state } = useProgress();
  const pct = topicPercent(state, topic.id);
  const status = pct === 100 ? 'Completado' : pct > 0 ? 'En progreso' : 'Sin iniciar';
  return (
    <article className="card topic-card">
      {topic.cover && (
        <img className="topic-card__cover" src={topic.cover} alt="" loading="lazy" decoding="async" width={320} height={160} />
      )}
      <div className="topic-card__body">
        <p className="eyebrow">{categoryName ?? `Tema ${topic.order + 1}`}</p>
        <h3 className="topic-card__title">
          <Link to={`/tema/${topic.id}`} className="stretched">{topic.title}</Link>
        </h3>
        <p className="topic-card__desc">{topic.description}</p>
        <p className="meta">
          <span>{topic.pageCount} láminas</span>
          {topic.imageCount > 0 && <span>{topic.imageCount} imágenes</span>}
          {extra && <span>{extra}</span>}
        </p>
        <ProgressBar value={pct} label={`Progreso en ${topic.title}`} size="sm" />
        <p className={`status status--${pct === 100 ? 'done' : pct > 0 ? 'progress' : 'new'}`}>
          {pct === 100 && <CheckCircle2 size={16} aria-hidden />} {status}
        </p>
      </div>
    </article>
  );
}

export function CategoryCard({ category }: { category: Category }) {
  const { state } = useProgress();
  const pct = overallPercent(state, category.topicIds);
  return (
    <article className="card category-card">
      <div className="category-card__icon" aria-hidden>{category.id === 'procesos' ? <Layers /> : <BookOpen />}</div>
      <h3>
        <Link to={`/categoria/${category.id}`} className="stretched">{category.name}</Link>
      </h3>
      <p className="muted">{category.description}</p>
      <p className="meta"><span>{category.topicIds.length} temas</span><span>{pct}% completado</span></p>
      <ProgressBar value={pct} label={`Progreso en ${category.name}`} size="sm" showValue={false} />
      <span className="card__cta">{pct > 0 ? 'Continuar' : 'Empezar'} <ArrowRight size={16} aria-hidden /></span>
    </article>
  );
}
