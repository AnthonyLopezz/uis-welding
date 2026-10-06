import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { getCategories, getTags, getTopics } from '../services/contentRepository.ts';
import { DIFFICULTIES, DIFFICULTY_LABEL, getAllQuestions } from '../services/questionRepository.ts';
import { normalizeText } from '../services/searchService.ts';
import { topicPercent } from '../services/learning.ts';
import { AsyncView, EmptyState } from '../components/States.tsx';
import { TopicCard } from '../components/Cards.tsx';
import { PageHeader } from '../components/Layout.tsx';
import type { Question } from '../types/question.ts';

type Sort = 'order' | 'title' | 'progress-asc' | 'progress-desc';
type Status = 'all' | 'new' | 'progress' | 'done';

/** Reparto de las preguntas del tema por dificultad. */
function topicDifficulty(qs: Question[]): string {
  if (!qs.length) return 'Sin preguntas';
  const parts = DIFFICULTIES.map((d) => `${qs.filter((q) => q.difficulty === d).length} ${DIFFICULTY_LABEL[d].toLowerCase()}`);
  return `${qs.length} preguntas (${parts.join(', ')})`;
}

export default function Explore() {
  useDocumentMeta('Explorar temas');
  const { state } = useProgress();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [sort, setSort] = useState<Sort>('order');
  const category = params.get('categoria') ?? 'all';

  const data = useAsync(async () => {
    const [topics, categories, tags, questions] = await Promise.all([getTopics(), getCategories(), getTags(), getAllQuestions()]);
    return { topics, categories, tags, questions };
  }, []);

  const filtered = useMemo(() => {
    if (data.status !== 'success') return [];
    const q = normalizeText(text.trim());
    const pct = (id: string) => topicPercent(state, id);
    return data.data.topics
      .filter((t) => category === 'all' || t.categoryId === category)
      .filter((t) => !tag || t.tags.includes(tag))
      .filter((t) => !q || normalizeText(`${t.title} ${t.description} ${t.tags.join(' ')}`).includes(q))
      .filter((t) => status === 'all'
        || (status === 'new' && pct(t.id) === 0)
        || (status === 'progress' && pct(t.id) > 0 && pct(t.id) < 100)
        || (status === 'done' && pct(t.id) === 100))
      .sort((a, b) =>
        sort === 'title' ? a.title.localeCompare(b.title, 'es')
          : sort === 'progress-asc' ? pct(a.id) - pct(b.id)
          : sort === 'progress-desc' ? pct(b.id) - pct(a.id)
          : a.order - b.order);
  }, [data, text, tag, status, sort, category, state]);

  return (
    <div className="stack-lg">
      <PageHeader title="Todos los temas">
        <p className="muted">Busca, filtra y elige qué estudiar.</p>
      </PageHeader>
      <AsyncView state={data}>
        {({ categories, tags, questions }) => (
          <>
            <div className="filters card">
              <div className="field field--grow">
                <label htmlFor="f-text">Buscar temas</label>
                <div className="input-icon">
                  <Search size={18} aria-hidden />
                  <input id="f-text" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: gases, polaridad, símbolos…" />
                </div>
              </div>
              <div className="chips-row" role="group" aria-label="Filtrar por categoría">
                {[{ id: 'all', name: 'Todas' }, ...categories].map((c) => (
                  <button key={c.id} className="chip" aria-pressed={category === c.id}
                    onClick={() => setParams(c.id === 'all' ? {} : { categoria: c.id }, { replace: true })}>
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="f-tag">Etiqueta</label>
                <select id="f-tag" value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">Todas</option>
                  {tags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-status">Estado</label>
                <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  <option value="all">Todos</option>
                  <option value="new">Sin iniciar</option>
                  <option value="progress">En progreso</option>
                  <option value="done">Completados</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-sort">Ordenar por</label>
                <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="order">Orden del curso</option>
                  <option value="title">Nombre (A–Z)</option>
                  <option value="progress-asc">Menor progreso</option>
                  <option value="progress-desc">Mayor progreso</option>
                </select>
              </div>
            </div>
            <p className="muted" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'tema' : 'temas'}</p>
            {filtered.length ? (
              <div className="grid grid--3">
                {filtered.map((t) => (
                  <TopicCard key={t.id} topic={t}
                    categoryName={categories.find((c) => c.id === t.categoryId)?.name}
                    extra={topicDifficulty(questions.filter((q) => q.topicId === t.id))} />
                ))}
              </div>
            ) : (
              <EmptyState icon="search" title="Ningún tema coincide con los filtros" message="Prueba con otra palabra o quita algún filtro." />
            )}
          </>
        )}
      </AsyncView>
    </div>
  );
}
