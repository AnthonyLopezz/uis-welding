import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ListTree } from 'lucide-react';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { getTopicById } from '../services/contentRepository.ts';
import { byDifficulty, getQuestionsByTopic } from '../services/questionRepository.ts';
import { answerStats, topicPercent } from '../services/learning.ts';
import { AsyncView, EmptyState } from '../components/States.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { StepContent } from '../components/StepContent.tsx';
import { QuestionCard, type AnsweredState } from '../components/QuestionCard.tsx';
import type { TopicContent } from '../types/content.ts';
import type { Question } from '../types/question.ts';

function Outline({ topic, currentId, visited }: { topic: TopicContent; currentId: string; visited: string[] }) {
  const ref = useRef<HTMLOListElement>(null);
  // Mantiene visible el paso actual dentro del índice (solo desplaza el índice, no la página).
  useEffect(() => {
    const box = ref.current?.closest<HTMLElement>('.study__outline');
    const el = ref.current?.querySelector<HTMLElement>('.is-current');
    if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2;
  }, [currentId]);
  return (
    <ol className="outline" ref={ref}>
      {topic.lessons.map((l) => (
        <li key={l.id}>
          <p className="outline__lesson">{l.title}</p>
          <ol>
            {l.steps.map((s) => (
              <li key={s.id}>
                <Link to={`?paso=${s.id}`} replace aria-current={s.id === currentId ? 'step' : undefined}
                  className={`outline__step ${s.id === currentId ? 'is-current' : ''}`}>
                  {visited.includes(s.id) ? <Check size={14} aria-label="visto" /> : <span className="dot" aria-hidden />}
                  {s.title}
                </Link>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function StepCheck({ questions, onContinue }: { questions: Question[]; onContinue: () => void }) {
  const { recordAnswer } = useProgress();
  const [answers, setAnswers] = useState<Record<string, AnsweredState>>({});
  return (
    <section className="check" aria-labelledby="check-title">
      <h2 id="check-title">Comprueba lo que aprendiste</h2>
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          question={q}
          answered={answers[q.id]}
          onSubmit={(answer, correct) => {
            setAnswers((a) => ({ ...a, [q.id]: { answer, correct } }));
            recordAnswer(q, correct);
          }}
          onContinue={i === questions.length - 1 ? onContinue : undefined}
        />
      ))}
    </section>
  );
}

function Finished({ topic }: { topic: TopicContent }) {
  const { state } = useProgress();
  const stats = answerStats(state, topic.id);
  return (
    <section className="card finished stack" aria-labelledby="fin-title">
      <CheckCircle2 className="finished__icon" aria-hidden />
      <h1 id="fin-title">Tema completado</h1>
      <p>Terminaste <strong>{topic.title}</strong>.</p>
      {stats.answered > 0 && <p>Respondiste {stats.answered} preguntas con una precisión del {stats.accuracy}%.</p>}
      <div className="actions">
        <Link className="btn btn--primary" to={`/evaluacion?tema=${topic.id}`}>Evaluar este tema</Link>
        <Link className="btn btn--ghost" to="/repaso">Ir a repaso</Link>
        <Link className="btn btn--ghost" to="/progreso">Ver mi progreso</Link>
      </div>
    </section>
  );
}

export default function Study() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { state, visitStep, completeTopic } = useProgress();
  const [finished, setFinished] = useState(false);
  const data = useAsync(async () => {
    const topic = await getTopicById(id);
    return topic && { topic, questions: await getQuestionsByTopic(id) };
  }, [id]);

  const topic = data.status === 'success' ? data.data?.topic : undefined;
  const requested = params.get('paso') ?? state.topics[id]?.lastStepId;
  const index = Math.max(0, topic?.steps.findIndex((s) => s.id === requested) ?? 0);
  const step = topic?.steps[index];
  useDocumentMeta(topic && `Estudiar ${topic.title}`);

  useEffect(() => {
    if (topic && step) visitStep(topic.id, step.id, topic.steps.length);
  }, [topic, step, visitStep]);

  useEffect(() => { setFinished(false); window.scrollTo(0, 0); }, [step?.id]);

  // Atajos de teclado: ← / → para moverse entre pasos (no interfiere al escribir o elegir opciones).
  useEffect(() => {
    if (!topic || finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, select, textarea, dialog')) return;
      const i = e.key === 'ArrowRight' ? index + 1 : e.key === 'ArrowLeft' ? index - 1 : -1;
      if (i >= 0 && i < topic.steps.length) setParams({ paso: topic.steps[i].id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [topic, index, finished, setParams]);

  return (
    <AsyncView state={data} notFound="El tema">
      {({ topic, questions }) => {
        if (!step) return <EmptyState title="Este documento no tiene contenido para estudiar" />;
        if (finished) return <Finished topic={topic} />;
        const lesson = topic.lessons.find((l) => l.id === step.lessonId);
        const isLast = index === topic.steps.length - 1;
        const go = (i: number) => setParams({ paso: topic.steps[i].id });
        const next = () => {
          if (isLast) { completeTopic(topic.id); setFinished(true); } else go(index + 1);
        };
        const visited = state.topics[topic.id]?.visitedSteps ?? [];
        const stepQuestions = byDifficulty(questions.filter((q) => q.sectionId === step.id));

        return (
          <div className="study">
            <aside className="study__outline only-desktop" aria-label="Contenido del tema">
              <Link to={`/tema/${topic.id}`} className="back"><ArrowLeft size={18} aria-hidden /> {topic.title}</Link>
              <Outline topic={topic} currentId={step.id} visited={visited} />
            </aside>

            <div className="study__main">
              <div className="study__bar">
                <p className="eyebrow">
                  <Link to={`/tema/${topic.id}`}>{topic.title}</Link> · {lesson?.title}
                </p>
                <p className="muted">Paso {index + 1} de {topic.steps.length} · Lámina {step.page} <span className="only-desktop kbd-hint">· Usa ← → para avanzar</span></p>
                <ProgressBar value={((index + 1) / topic.steps.length) * 100} label="Posición en el tema" size="sm" showValue={false} />
                <p className="muted small">{topicPercent(state, topic.id)}% del tema visto</p>
                <details className="only-mobile outline-mobile">
                  <summary><ListTree size={18} aria-hidden /> Contenido del tema</summary>
                  <Outline topic={topic} currentId={step.id} visited={visited} />
                </details>
              </div>

              <StepContent step={step} />

              {stepQuestions.length > 0 && <StepCheck key={step.id} questions={stepQuestions} onContinue={next} />}

              <nav className="pager pager--sticky" aria-label="Navegación entre pasos">
                <button className="btn btn--ghost" onClick={() => go(index - 1)} disabled={index === 0}>
                  <ArrowLeft size={18} aria-hidden /> Anterior
                </button>
                <button className="btn btn--primary" onClick={next}>
                  {isLast ? 'Finalizar tema' : 'Siguiente'} <ArrowRight size={18} aria-hidden />
                </button>
              </nav>
            </div>
          </div>
        );
      }}
    </AsyncView>
  );
}
