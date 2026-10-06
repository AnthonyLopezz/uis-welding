import { Link, useParams } from 'react-router';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { useProgress } from '../store/ProgressContext.tsx';
import { AsyncView, EmptyState, NotFoundState } from '../components/States.tsx';
import { TopicCard } from '../components/Cards.tsx';
import { PageHeader } from '../components/Layout.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { overallPercent } from '../services/learning.ts';

export default function CategoryPage() {
  const { id = '' } = useParams();
  const catalog = useCatalog();
  const { state } = useProgress();
  const category = catalog.status === 'success' ? catalog.data.categories.find((c) => c.id === id) : undefined;
  useDocumentMeta(category?.name, category?.description);

  return (
    <AsyncView state={catalog}>
      {({ topics }) => {
        if (!category) return <NotFoundState what="La categoría" />;
        const list = topics.filter((t) => category.topicIds.includes(t.id));
        return (
          <div className="stack-lg">
            <Link to="/categorias" className="back"><ArrowLeft size={18} aria-hidden /> Categorías</Link>
            <PageHeader eyebrow="Categoría" title={category.name}>
              <p className="muted">{category.description}</p>
              <ProgressBar value={overallPercent(state, category.topicIds)} label={`Progreso en ${category.name}`} />
              <Link className="btn btn--ghost" to={`/evaluacion?categoria=${category.id}`}>
                <ClipboardCheck size={18} aria-hidden /> Evaluar esta categoría
              </Link>
            </PageHeader>
            {list.length
              ? <div className="grid grid--3">{list.map((t) => <TopicCard key={t.id} topic={t} categoryName={category.name} />)}</div>
              : <EmptyState title="Esta categoría aún no tiene temas" />}
          </div>
        );
      }}
    </AsyncView>
  );
}
