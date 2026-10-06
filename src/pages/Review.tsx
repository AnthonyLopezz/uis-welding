import { useState } from 'react';
import { Link } from 'react-router';
import { RotateCcw } from 'lucide-react';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { getTopics } from '../services/contentRepository.ts';
import { getAllQuestions } from '../services/questionRepository.ts';
import { buildReview, needsReview } from '../services/learning.ts';
import { AsyncView, EmptyState } from '../components/States.tsx';
import { PageHeader } from '../components/Layout.tsx';
import { QuizRunner, type QuizResult } from '../components/QuizRunner.tsx';
import { QuizResults } from '../components/QuizResults.tsx';
import type { Question } from '../types/question.ts';

export default function Review() {
  useDocumentMeta('Repaso');
  const { state } = useProgress();
  const data = useAsync(async () => ({ questions: await getAllQuestions(), topics: await getTopics() }), []);
  const [session, setSession] = useState<Question[] | null>(null);
  const [results, setResults] = useState<QuizResult[] | null>(null);

  return (
    <AsyncView state={data}>
      {({ questions, topics }) => {
        const title = (id: string) => topics.find((t) => t.id === id)?.title ?? '';
        if (results) return <QuizResults results={results} topicTitle={title} onRestart={() => { setResults(null); setSession(null); }} />;
        if (session) return <QuizRunner questions={session} onFinish={setResults} />;

        const pending = questions.filter((q) => needsReview(state, q.id)).length;
        const queue = buildReview(questions, state, new Date());
        return (
          <div className="stack-lg">
            <PageHeader title="Repaso">
              <p className="muted">Se priorizan tus errores recientes, los temas con baja precisión y los que no estudias hace tiempo.</p>
            </PageHeader>
            {queue.length ? (
              <section className="card stack">
                <p className="big">
                  {pending
                    ? <>Tienes <strong>{pending}</strong> {pending === 1 ? 'concepto' : 'conceptos'} para reforzar.</>
                    : <>No tienes errores pendientes. Puedes repasar <strong>{queue.length}</strong> preguntas que aún no dominas.</>}
                </p>
                <p className="muted">Sesión de {queue.length} preguntas · unos {Math.ceil(queue.length * 0.75)} min</p>
                <button className="btn btn--primary" onClick={() => setSession(queue)}>
                  <RotateCcw size={18} aria-hidden /> Comenzar repaso
                </button>
              </section>
            ) : (
              <EmptyState
                title="Aún no hay nada que repasar"
                message="Estudia un tema y responde sus preguntas; las que falles aparecerán aquí."
                action={<Link className="btn btn--primary" to="/explorar">Elegir un tema</Link>}
              />
            )}
          </div>
        );
      }}
    </AsyncView>
  );
}
