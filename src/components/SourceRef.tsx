import type { MouseEvent, ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { FileText } from 'lucide-react';
import type { Question } from '../types/question.ts';
import { getTopicById } from '../services/contentRepository.ts';
import { useAsync } from '../hooks/useAsync.ts';

/**
 * Enlace al paso de estudio de una pregunta.
 * - Si ya estás en ese paso, desplaza hasta su título (antes el enlace apuntaba a la misma URL y no hacía nada).
 * - Desde una evaluación o un repaso abre otra pestaña para no perder el avance del cuestionario.
 */
export function StudyLink({ topicId, sectionId, className, children }: { topicId: string; sectionId: string; className?: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const inQuiz = pathname === '/evaluacion' || pathname === '/repaso';
  const onClick = (e: MouseEvent) => {
    const target = pathname === `/estudiar/${topicId}` && document.getElementById(`t-${sectionId}`);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  };
  return (
    <Link to={`/estudiar/${topicId}?paso=${sectionId}`} className={className} onClick={onClick}
      {...(inQuiz ? { target: '_blank', rel: 'noopener' } : {})}>
      {children}{inQuiz && <span className="sr-only"> (se abre en otra pestaña)</span>}
    </Link>
  );
}

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
      <StudyLink topicId={q.topicId} sectionId={q.sectionId}>Ver esa parte del material</StudyLink>
    </div>
  );
}
