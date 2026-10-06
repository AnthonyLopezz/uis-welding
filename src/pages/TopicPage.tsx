import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, ClipboardCheck } from 'lucide-react';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { getCategoryById, getTopicById } from '../services/contentRepository.ts';
import { getQuestionsByTopic } from '../services/questionRepository.ts';
import { answerStats, topicPercent } from '../services/learning.ts';
import { AsyncView, EmptyState } from '../components/States.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { StepContent } from '../components/StepContent.tsx';

export default function TopicPage() {
  const { id = '' } = useParams();
  const { state } = useProgress();
  const data = useAsync(async () => {
    const topic = await getTopicById(id);
    if (!topic) return undefined;
    const [category, questions] = await Promise.all([getCategoryById(topic.categoryId), getQuestionsByTopic(id)]);
    return { topic, category, questions };
  }, [id]);
  const topic = data.status === 'success' ? data.data?.topic : undefined;
  useDocumentMeta(topic?.title, topic?.description);

  return (
    <AsyncView state={data} notFound="El tema">
      {({ topic, category, questions }) => {
        const pct = topicPercent(state, topic.id);
        const stats = answerStats(state, topic.id);
        const lastStep = state.topics[topic.id]?.lastStepId;
        return (
          <article className="stack-lg">
            <Link to={category ? `/categoria/${category.id}` : '/categorias'} className="back">
              <ArrowLeft size={18} aria-hidden /> {category?.name ?? 'Categorías'}
            </Link>

            <header className="topic-hero card">
              {topic.cover && <img className="topic-hero__cover" src={topic.cover} alt="" width={400} height={240} />}
              <div className="stack">
                <p className="eyebrow">{category?.name}{topic.classLabel && ` · ${topic.classLabel}`}</p>
                <h1>{topic.title}</h1>
                <p>{topic.description}</p>
                <p className="meta">
                  <span>{topic.pageCount} láminas</span>
                  <span>{topic.steps.length} pasos de estudio</span>
                  <span>{topic.images.length} imágenes</span>
                  <span>{questions.length} preguntas</span>
                  {topic.author && <span>Autor: {topic.author}</span>}
                </p>
                <ProgressBar value={pct} label={`Progreso en ${topic.title}`} />
                {stats.answered > 0 && <p className="muted">Precisión: {stats.accuracy}% en {stats.answered} respuestas</p>}
                <div className="actions">
                  <Link className="btn btn--primary" to={`/estudiar/${topic.id}${lastStep ? `?paso=${lastStep}` : ''}`}>
                    {pct > 0 ? 'Continuar estudio' : 'Comenzar estudio'} <ArrowRight size={18} aria-hidden />
                  </Link>
                </div>
              </div>
            </header>

            <section aria-labelledby="contenido">
              <h2 id="contenido">Contenido</h2>
              <p className="muted">Abre cada lección para leerla, o usa el modo estudio para avanzar paso a paso con preguntas.</p>
              {topic.lessons.length ? topic.lessons.map((lesson, i) => (
                <details key={lesson.id} className="lesson card" open={i === 0}>
                  <summary>
                    <span className="lesson__num">{i + 1}</span>
                    <span className="lesson__title">{lesson.title}</span>
                    <span className="muted">{lesson.steps.length} {lesson.steps.length === 1 ? 'paso' : 'pasos'}</span>
                  </summary>
                  <div className="stack-lg">
                    {lesson.steps.map((s) => <StepContent key={s.id} step={s} headingLevel={3} />)}
                  </div>
                </details>
              )) : <EmptyState title="Este documento no tiene contenido estructurado" />}
            </section>

            <section className="cta card" aria-labelledby="cta-title">
              <h2 id="cta-title">¿Listo para comprobar lo aprendido?</h2>
              {questions.length ? (
                <div className="actions" style={{ justifyContent: 'center' }}>
                  <Link className="btn btn--primary" to={`/evaluacion?tema=${topic.id}`}>
                    <ClipboardCheck size={18} aria-hidden /> Responder preguntas
                  </Link>
                  <Link className="btn btn--ghost" to={`/preguntas?tema=${topic.id}`}>Ver banco de preguntas con respuestas</Link>
                </div>
              ) : (
                <p className="muted">Este documento aún no tiene preguntas.</p>
              )}
            </section>
          </article>
        );
      }}
    </AsyncView>
  );
}
