import { useCatalog } from '../hooks/useCatalog.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { AsyncView, EmptyState } from '../components/States.tsx';
import { CategoryCard } from '../components/Cards.tsx';
import { PageHeader } from '../components/Layout.tsx';

export default function Categories() {
  useDocumentMeta('Categorías');
  const catalog = useCatalog();
  return (
    <div className="stack-lg">
      <PageHeader title="Categorías">
        <p className="muted">Los documentos del curso agrupados según su tipo: unidades temáticas y procesos de soldadura.</p>
      </PageHeader>
      <AsyncView state={catalog}>
        {({ categories }) => categories.length
          ? <div className="grid grid--2">{categories.map((c) => <CategoryCard key={c.id} category={c} />)}</div>
          : <EmptyState title="No hay categorías disponibles" />}
      </AsyncView>
    </div>
  );
}
