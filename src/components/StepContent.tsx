import { AlertTriangle } from 'lucide-react';
import type { Block, ContentTable, Step } from '../types/content.ts';
import { ImageFigure } from './ImageFigure.tsx';

export function TableViewer({ table }: { table: ContentTable }) {
  return (
    <div className="table-wrap" role="region" aria-label={table.caption} tabIndex={0}>
      <table>
        <caption>{table.caption}</caption>
        <thead><tr>{table.headers.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>
          ))}
        </tbody>
      </table>
      {table.notes && <p className="table-notes">{table.notes}</p>}
    </div>
  );
}

/** Un bloque de contenido según su tipo. Para soportar un tipo nuevo basta con añadir un caso aquí. */
export function StudyBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'text':
      if (block.variant === 'warning') {
        return <p className="callout callout--warning"><AlertTriangle size={18} aria-hidden /> <span><strong>Atención:</strong> {block.text}</span></p>;
      }
      return block.variant === 'caption' ? <p className="source">{block.text}</p> : <p>{block.text}</p>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return <Tag className="content-list">{block.items.map((it, i) => <li key={i}>{it}</li>)}</Tag>;
    }
    case 'image':
      return <ImageFigure image={block.image} />;
    case 'table':
      return <TableViewer table={block.table} />;
  }
}

export function StepContent({ step, headingLevel = 2 }: { step: Step; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as const;
  return (
    <section className="step" aria-labelledby={`t-${step.id}`}>
      <H id={`t-${step.id}`} className="step__title">{step.title}</H>
      <div className="step__body">
        {step.blocks.map((b, i) => <StudyBlock key={i} block={b} />)}
      </div>
    </section>
  );
}
