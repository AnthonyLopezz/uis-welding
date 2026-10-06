import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { ClipboardCheck } from 'lucide-react';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { getCategories, getTopics } from '../services/contentRepository.ts';
import { buildExam, DIFFICULTIES, DIFFICULTY_LABEL, getAllQuestions } from '../services/questionRepository.ts';
import { AsyncView } from '../components/States.tsx';
import { PageHeader } from '../components/Layout.tsx';
import { QuizRunner, type QuizResult } from '../components/QuizRunner.tsx';
import { QuizResults } from '../components/QuizResults.tsx';
import type { Category, Topic } from '../types/content.ts';
import type { Difficulty, Question } from '../types/question.ts';

type Scope = 'all' | 'category' | 'topics';
const LEVELS = DIFFICULTIES;

function ExamSetup({ topics, categories, questions, onStart }: {
  topics: Topic[]; categories: Category[]; questions: Question[]; onStart: (qs: Question[]) => void;
}) {
  const [params] = useSearchParams();
  const initialTopic = params.get('tema');
  const initialCategory = params.get('categoria');
  const [scope, setScope] = useState<Scope>(initialTopic ? 'topics' : initialCategory ? 'category' : 'all');
  const [categoryId, setCategoryId] = useState(initialCategory ?? categories[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>(initialTopic ? [initialTopic] : []);
  const [levels, setLevels] = useState<Difficulty[]>(LEVELS);
  const [count, setCount] = useState(20);
  const [progressive, setProgressive] = useState(true);

  const topicIds = scope === 'all' ? topics.map((t) => t.id)
    : scope === 'category' ? (categories.find((c) => c.id === categoryId)?.topicIds ?? [])
    : picked;
  const available = questions.filter((q) => topicIds.includes(q.topicId) && levels.includes(q.difficulty)).length;
  const total = Math.min(count, available);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (total) onStart(buildExam(questions, topicIds, levels, total, progressive));
  };

  return (
    <form className="card stack exam-setup" onSubmit={submit}>
      <fieldset>
        <legend>¿Qué quieres evaluar?</legend>
        {([['all', 'Todo el contenido'], ['category', 'Una categoría'], ['topics', 'Uno o varios temas']] as const).map(([v, l]) => (
          <label key={v} className="radio-line">
            <input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} /> {l}
          </label>
        ))}
      </fieldset>

      {scope === 'category' && (
        <div className="field">
          <label htmlFor="e-cat">Categoría</label>
          <select id="e-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {scope === 'topics' && (
        <fieldset>
          <legend>Temas</legend>
          {topics.map((t) => (
            <label key={t.id} className="radio-line">
              <input type="checkbox" checked={picked.includes(t.id)} onChange={() => setPicked(toggle(picked, t.id))} /> {t.title}
            </label>
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend>Dificultad</legend>
        <div className="chips-row">
          {LEVELS.map((d) => (
            <label key={d} className="chip chip--check">
              <input type="checkbox" checked={levels.includes(d)} onChange={() => setLevels(toggle(levels, d))} /> {DIFFICULTY_LABEL[d]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Orden de las preguntas</legend>
        <label className="radio-line">
          <input type="radio" name="order" checked={progressive} onChange={() => setProgressive(true)} /> Progresivo: de fácil a desafío
        </label>
        <label className="radio-line">
          <input type="radio" name="order" checked={!progressive} onChange={() => setProgressive(false)} /> Aleatorio
        </label>
      </fieldset>

      <div className="field">
        <label htmlFor="e-count">Número de preguntas</label>
        <select id="e-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <p className="exam-summary" aria-live="polite">
        {total
          ? <><strong>{total} preguntas</strong> · Tiempo estimado: {Math.ceil(total * 0.75)} min{total < count && ` (solo hay ${available} disponibles con estos filtros)`}</>
          : 'No hay preguntas con estos filtros. Elige al menos un tema y una dificultad.'}
      </p>
      <button className="btn btn--primary" disabled={!total}><ClipboardCheck size={18} aria-hidden /> Comenzar evaluación</button>
    </form>
  );
}

export default function Exam() {
  useDocumentMeta('Evaluación');
  const data = useAsync(async () => {
    const [topics, categories, questions] = await Promise.all([getTopics(), getCategories(), getAllQuestions()]);
    return { topics, categories, questions };
  }, []);
  const [exam, setExam] = useState<Question[] | null>(null);
  const [results, setResults] = useState<QuizResult[] | null>(null);

  return (
    <AsyncView state={data}>
      {({ topics, categories, questions }) => {
        const title = (id: string) => topics.find((t) => t.id === id)?.title ?? '';
        if (results) return <QuizResults results={results} topicTitle={title} onRestart={() => { setResults(null); setExam(null); }} />;
        if (exam) return <QuizRunner questions={exam} onFinish={setResults} />;
        return (
          <div className="stack-lg">
            <PageHeader title="Evaluación">
              <p className="muted">Preguntas aleatorias del banco, sin pistas hasta que respondes. Tus respuestas cuentan para el progreso y el repaso.</p>
            </PageHeader>
            <ExamSetup topics={topics} categories={categories} questions={questions} onStart={setExam} />
          </div>
        );
      }}
    </AsyncView>
  );
}
