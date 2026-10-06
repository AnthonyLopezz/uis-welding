// Capa de normalización: convierte el JSON crudo de output/ en el modelo de la UI
// sin modificar los datos originales. Funciones puras (se prueban en tests/).
import type {
  Block, Category, ContentImage, ContentTable, Lesson, RawDocument, RawImage, RawIndexEntry, RawSection,
  RawTable, Step, Topic, TopicContent,
} from '../types/content.ts';

export const NOT_AVAILABLE = 'Información no disponible';

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
const orNA = (s: string | null | undefined) => clean(s) || NOT_AVAILABLE;
const fileName = (path: string) => path.split('/').pop() ?? path;

/** Los datos traen rutas relativas distintas (index.json vs content.json); se unifican a /images/<slug>/<archivo>. */
export const imageUrl = (base: string, slug: string, path: string) => `${base}images/${slug}/${fileName(path)}`;

// La agrupación sale del nombre del archivo fuente ("Unidad #N …" vs "Proceso(s) de soldadura …").
const CATEGORY_DEFS = [
  { id: 'fundamentos', name: 'Fundamentos', match: /^unidad/i,
    description: 'Unidades del curso: presentación, seguridad, terminología y simbología de soldadura.' },
  { id: 'procesos', name: 'Procesos de soldadura', match: /^proceso/i,
    description: 'Procesos de soldadura por llama y por arco eléctrico: oxiacetileno, SMAW y GMAW.' },
];
const OTHER = { id: 'otros', name: 'Otros documentos', description: 'Documentos sin unidad asignada.' };

const categoryFor = (sourceFile: string) => CATEGORY_DEFS.find((c) => c.match.test(sourceFile)) ?? OTHER;

export function toTopic(raw: RawIndexEntry, order: number, base: string): Topic {
  return {
    id: raw.slug,
    order,
    title: orNA(raw.title),
    description: orNA(raw.description),
    categoryId: categoryFor(raw.source_file).id,
    tags: raw.tags ?? [],
    pageCount: raw.page_count ?? 0,
    imageCount: raw.image_count ?? 0,
    tableCount: raw.table_count ?? 0,
    cover: raw.featured_image ? imageUrl(base, raw.slug, raw.featured_image) : undefined,
    author: clean(raw.author) || undefined,
    sourceFile: raw.source_file,
  };
}

export function toCategories(topics: Topic[]): Category[] {
  return [...CATEGORY_DEFS, OTHER]
    .map((c) => ({
      id: c.id, name: c.name, description: c.description, inferred: true,
      topicIds: topics.filter((t) => t.categoryId === c.id).map((t) => t.id),
    }))
    .filter((c) => c.topicIds.length > 0);
}

/** Logos repetidos e imágenes marcadas como decorativas no aportan al estudio. */
const isStudyImage = (i: RawImage) => i.show_on_web && !i.decorative && !(i.type === 'logo' && !i.contains_important_info);
const LABEL_KINDS = new Set(['diagrama', 'infografia', 'grafico', 'tabla convertida en imagen', 'documento escaneado']);

function toImage(raw: RawImage, slug: string, base: string): ContentImage {
  const labels = raw.contains_important_info && LABEL_KINDS.has(raw.type ?? '')
    ? clean(raw.visible_text).split(';').map(clean).filter((l) => l.length > 1 && l.length < 90)
    : [];
  return {
    id: raw.id,
    src: imageUrl(base, slug, raw.file),
    alt: clean(raw.alt) || clean(raw.description) || 'Imagen del documento',
    description: clean(raw.description) || undefined,
    labels: [...new Set(labels)],
    important: raw.contains_important_info,
    kind: clean(raw.type) || 'imagen',
    width: raw.width ?? undefined,
    height: raw.height ?? undefined,
    page: raw.page,
  };
}

function toTable(raw: RawTable): ContentTable {
  return {
    id: raw.id,
    caption: orNA(raw.caption),
    headers: (raw.headers ?? []).map(orNA),
    rows: (raw.rows ?? []).map((r) => r.map((c) => clean(c) || '—')),
    notes: clean(raw.notes) || undefined,
    page: raw.page,
  };
}

function toBlocks(section: RawSection, images: Map<string, ContentImage>, tables: Map<string, ContentTable>): Block[] {
  const blocks: Block[] = [];
  for (const b of section.content) {
    if (b.type === 'list') {
      const items = (b.items ?? []).map(clean).filter(Boolean);
      if (items.length) blocks.push({ kind: 'list', items, ordered: b.ordered });
    } else if (b.type === 'image') {
      const image = images.get(b.image_id);
      if (image) blocks.push({ kind: 'image', image });
    } else if (b.type === 'table') {
      const table = tables.get(b.table_id);
      if (table) blocks.push({ kind: 'table', table });
    } else {
      const text = clean(b.text);
      if (text) blocks.push({ kind: 'text', variant: b.type, text });
    }
  }
  return blocks;
}

/** Nivel 1 del PDF → lección; cada sección con contenido → paso. */
export function toTopicContent(topic: Topic, raw: RawDocument, base: string): TopicContent {
  const allImages = raw.images.filter(isStudyImage).map((i) => toImage(i, topic.id, base));
  const images = new Map(allImages.map((i) => [i.id, i]));
  const tables = new Map(raw.tables.map((t) => [t.id, toTable(t)]));
  const titles = new Map(raw.sections.map((s) => [s.id, clean(s.title)]));

  const lessons: Lesson[] = [];
  for (const s of raw.sections) {
    const lessonId = s.level === 1 || !s.parent_id ? s.id : s.parent_id;
    let lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) {
      lesson = { id: lessonId, title: titles.get(lessonId) || NOT_AVAILABLE, steps: [] };
      lessons.push(lesson);
    }
    const blocks = toBlocks(s, images, tables);
    if (!blocks.length) continue;
    const title = clean(s.title) || (s.parent_id && titles.get(s.parent_id)) || `Página ${s.page}`;
    lesson.steps.push({ id: s.id, title, page: s.page, lessonId, blocks });
  }
  const withSteps = lessons.filter((l) => l.steps.length);

  return {
    ...topic,
    classLabel: clean(raw.metadata?.class_label) || undefined,
    lessons: withSteps,
    steps: withSteps.flatMap((l) => l.steps),
    images: allImages,
    tables: [...tables.values()],
  };
}

/** Texto plano de un paso, para búsqueda. */
export const stepText = (step: Step) =>
  step.blocks.map((b) =>
    b.kind === 'text' ? b.text
      : b.kind === 'list' ? b.items.join(' ')
      : b.kind === 'image' ? `${b.image.alt} ${b.image.description ?? ''} ${b.image.labels.join(' ')}`
      : `${b.table.caption} ${b.table.headers.join(' ')} ${b.table.rows.flat().join(' ')}`,
  ).join(' ');
