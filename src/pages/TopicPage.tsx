import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, ClipboardCheck } from 'lucide-react';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { getCategoryById, getTopicById, getTopics } from '../services/contentRepository.ts';
import { getQuestionsByTopic } from '../services/questionRepository.ts';
import { answerStats, topicPercent } from '../services/learning.ts';
import { AsyncView, EmptyState } from '../components/States.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { StepContent } from '../components/StepContent.tsx';
import { CourseRoute } from '../components/Cards.tsx';
import type { Lesson } from '../types/content.ts';

export default function TopicPage() {
  const { id = '' } = useParams();
  const { state } = useProgress();
  const data = useAsync(async () => {
    const topic = await getTopicById(id);
    if (!topic) return undefined;
    const [category, questions, allTopics] = await Promise.all([getCategoryById(topic.categoryId), getQuestionsByTopic(id), getTopics()]);
    return { topic, category, questions, allTopics };
  }, [id]);
  const topic = data.status === 'success' ? data.data?.topic : undefined;
  useDocumentMeta(topic?.title, topic?.description);

  return (
    <AsyncView state={data} notFound="El tema">
      {({ topic, category, questions, allTopics }) => {
        const pct = topicPercent(state, topic.id);
        const stats = answerStats(state, topic.id);
        const lastStep = state.topics[topic.id]?.lastStepId;
        const isFirst = topic.order === 0;
        const lessonBlock = (lesson: Lesson, i: number, open: boolean) => (
          <details key={lesson.id} className="lesson card" open={open}>
            <summary>
              <span className="lesson__num">{i + 1}</span>
              <span className="lesson__title">{lesson.title}</span>
              <span className="muted">{lesson.steps.length} {lesson.steps.length === 1 ? 'paso' : 'pasos'}</span>
            </summary>
            <div className="stack-lg">
              {lesson.steps.map((s) => <StepContent key={s.id} step={s} headingLevel={3} />)}
            </div>
          </details>
        );
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

            <section className="card intro" aria-labelledby="intro-title">
              <h2 id="intro-title">Introducción</h2>
              {isFirst ? (
                <p>
                  Este es el <strong>punto de partida del curso de Soldadura</strong>. Empiezas con lo básico: <strong>qué es la soldadura</strong> según la AWS, su <strong>historia</strong> y <strong>dónde se utiliza</strong>.
                  Después avanzas por la ruta del curso, tema por tema.
                </p>
              ) : (
                <p><strong>¿De qué trata?</strong> {topic.description}</p>
              )}
              {topic.lessons.length > 0 && (
                <>
                  <p className="intro__label">En este tema verás:</p>
                  <ol className="intro__list">
                    {topic.lessons.map((l) => (
                      <li key={l.id}>
                        <Link to={`/estudiar/${topic.id}?paso=${l.steps[0].id}`}>{l.title}</Link>
                        <span className="muted"> · {l.steps.length} {l.steps.length === 1 ? 'paso' : 'pasos'}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {isFirst && (
                <>
                  <p className="intro__label">Ruta del curso</p>
                  <CourseRoute topics={allTopics} currentId={topic.id} />
                </>
              )}
            </section>

            <section aria-labelledby="contenido">
              <h2 id="contenido">Contenido</h2>
              <p className="muted">Abre cada lección para leerla, o usa el modo estudio para avanzar paso a paso con preguntas.</p>
              {topic.lessons.length
                ? topic.lessons.map((l, i) => lessonBlock(l, i, i === 0))
                : <EmptyState title="Este documento no tiene contenido estructurado" />}
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
