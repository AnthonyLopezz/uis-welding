import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAsync } from '../hooks/useAsync.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { getAllTopicContents, getTags } from '../services/contentRepository.ts';
import { searchContent } from '../services/searchService.ts';
import { AsyncView, EmptyState } from '../components/States.tsx';
import { PageHeader, SearchBar } from '../components/Layout.tsx';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  useDocumentMeta(q ? `Búsqueda: ${q}` : 'Buscar');
  // Solo aquí se descargan todos los documentos: la búsqueda de contenido los necesita.
  const data = useAsync(async () => ({ topics: await getAllTopicContents(), tags: await getTags() }), []);
  const results = useMemo(() => (data.status === 'success' ? searchContent(data.data.topics, q) : null), [data, q]);

  return (
    <div className="stack-lg">
      <PageHeader title={q ? `Resultados para “${q}”` : 'Buscar'} />
      <div className="only-mobile"><SearchBar autoFocus={!q} /></div>
      <AsyncView state={data}>
        {({ tags }) => {
          if (q.length < 2) {
            return (
              <section className="card">
                <h2>Prueba con un concepto</h2>
                <ul className="chips">
                  {tags.map((t) => <li key={t}><Link to={`/buscar?q=${encodeURIComponent(t)}`}>{t}</Link></li>)}
                </ul>
              </section>
            );
          }
          if (!results || results.topics.length + results.steps.length + results.images.length === 0) {
            return <EmptyState icon="search" title="Sin resultados" message="Revisa la ortografía o usa un término más general (por ejemplo: «gas», «electrodo», «símbolo»)." />;
          }
          return (
            <>
              {results.topics.length > 0 && (
                <section aria-labelledby="r-topics">
                  <h2 id="r-topics" className="group-title">Temas <span className="muted">({results.topics.length})</span></h2>
                  <ul className="results">
                    {results.topics.map(({ topic, match }) => (
                      <li key={topic.id} className="card">
                        <Link to={`/tema/${topic.id}`} className="results__title">{topic.title}</Link>
                        <p className="muted">{match}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {results.steps.length > 0 && (
                <section aria-labelledby="r-steps">
                  <h2 id="r-steps" className="group-title">Contenido <span className="muted">({results.steps.length})</span></h2>
                  <ul className="results">
                    {results.steps.map((r) => (
                      <li key={r.stepId} className="card">
                        <Link to={`/estudiar/${r.topic.id}?paso=${r.stepId}`} className="results__title">{r.title}</Link>
                        <p className="eyebrow">{r.topic.title}</p>
                        <p>{r.snippet}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {results.images.length > 0 && (
                <section aria-labelledby="r-img">
                  <h2 id="r-img" className="group-title">Imágenes <span className="muted">({results.images.length})</span></h2>
                  <ul className="results results--images">
                    {results.images.map((r) => (
                      <li key={r.src} className="card">
                        <img src={r.src} alt={r.alt} loading="lazy" decoding="async" />
                        <Link to={`/estudiar/${r.topic.id}?paso=${r.stepId}`} className="results__title">{r.alt}</Link>
                        <p className="eyebrow">{r.topic.title}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          );
        }}
      </AsyncView>
    </div>
  );
}
