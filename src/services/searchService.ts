import type { TopicContent } from '../types/content.ts';
import { stepText } from './normalize.ts';

export const normalizeText = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export interface SearchResults {
  topics: { topic: TopicContent; match: string }[];
  steps: { topic: TopicContent; stepId: string; title: string; snippet: string }[];
  images: { topic: TopicContent; stepId: string; src: string; alt: string; text: string }[];
}

function snippet(text: string, q: string, radius = 70): string {
  const i = normalizeText(text).indexOf(q);
  if (i < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, i - radius);
  return `${start ? '…' : ''}${text.slice(start, i + q.length + radius)}${i + q.length + radius < text.length ? '…' : ''}`;
}

/** Búsqueda sin acentos ni mayúsculas en títulos, descripciones, etiquetas, texto, captions y tablas. */
export function searchContent(topics: TopicContent[], query: string, limit = 30): SearchResults {
  const q = normalizeText(query.trim());
  const res: SearchResults = { topics: [], steps: [], images: [] };
  if (q.length < 2) return res;
  const has = (s: string | undefined) => !!s && normalizeText(s).includes(q);

  for (const topic of topics) {
    const tag = topic.tags.find(has);
    if (has(topic.title) || has(topic.description) || tag) {
      res.topics.push({ topic, match: tag ? `Etiqueta: ${tag}` : topic.description });
    }
    for (const step of topic.steps) {
      const text = stepText(step);
      if (has(step.title) || has(text)) {
        res.steps.push({ topic, stepId: step.id, title: step.title, snippet: snippet(text, q) });
      }
      for (const b of step.blocks) {
        if (b.kind !== 'image') continue;
        const text = [b.image.alt, b.image.description, b.image.labels.join(', ')].filter(Boolean).join(' — ');
        if (has(text)) res.images.push({ topic, stepId: step.id, src: b.image.src, alt: b.image.alt, text: snippet(text, q, 50) });
      }
    }
  }
  return { topics: res.topics, steps: res.steps.slice(0, limit), images: res.images.slice(0, limit) };
}
