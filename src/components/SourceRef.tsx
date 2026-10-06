import { Link } from 'react-router';
import { FileText } from 'lucide-react';
import type { Question } from '../types/question.ts';
import { getTopicById } from '../services/contentRepository.ts';
import { useAsync } from '../hooks/useAsync.ts';

/** «Dónde encontrarlo»: documento, lámina, sección y PDF original que respaldan la respuesta. */
export function SourceRef({ question: q }: { question: Question }) {
  const state = useAsync(() => getTopicById(q.topicId), [q.topicId]);
  const topic = state.status === 'success' ? state.data : undefined;
  const step = topic?.steps.find((s) => s.id === q.sectionId);
  const table = q.tableId ? topic?.tables.find((t) => t.id === q.tableId) : undefined;
  const page = q.sourcePage ?? step?.page;

  return (
    <div className="source-ref">
      <p className="source-ref__title"><FileText size={16} aria-hidden /> Dónde encontrar la información</p>
      <p>
        <strong>{topic?.title ?? 'Documento'}</strong>
        {page && <> · Lámina {page}</>}
        {step && <> · «{step.title}»</>}
        {table && <> · Tabla: {table.caption}</>}
      </p>
      {topic && <p className="muted">PDF original: {topic.sourceFile}</p>}
      <Link to={`/estudiar/${q.topicId}?paso=${q.sectionId}`}>Ver esa parte del material</Link>
    </div>
  );
}
