// ---- Formato crudo, tal como lo genera scripts/extract_welding_pdfs.py en output/ ----

export interface RawIndexEntry {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  category: string | null;
  subcategory: string[] | null;
  tags: string[] | null;
  author: string | null;
  date: string | null;
  source_file: string;
  page_count: number | null;
  featured_image: string | null;
  image_count: number | null;
  table_count: number | null;
}

export type RawBlock =
  | { type: 'paragraph' | 'caption' | 'warning'; text: string | null; page: number }
  | { type: 'list'; items: string[] | null; ordered: boolean; page: number }
  | { type: 'image'; image_id: string; page: number }
  | { type: 'table'; table_id: string; page: number };

export interface RawSection {
  id: string;
  title: string | null;
  level: number;
  page: number;
  content: RawBlock[];
  parent_id: string | null;
}

export interface RawImage {
  id: string;
  page: number;
  file: string;
  width: number | null;
  height: number | null;
  type: string | null;
  description: string | null;
  visible_text: string | null;
  caption: string | null;
  alt: string | null;
  contains_important_info: boolean;
  decorative: boolean;
  show_on_web: boolean;
}

export interface RawTable {
  id: string;
  page: number;
  caption: string | null;
  headers: string[] | null;
  rows: (string | null)[][] | null;
  notes: string | null;
}

export interface RawDocument {
  slug: string;
  sections: RawSection[];
  images: RawImage[];
  tables: RawTable[];
  metadata?: { class_label?: string | null };
}

// ---- Modelo normalizado que consume la UI ----

export interface Category {
  id: string;
  name: string;
  description: string;
  topicIds: string[];
  /** true: la agrupación se dedujo del nombre del PDF, no viene impresa en los datos. */
  inferred: boolean;
}

export interface Topic {
  id: string;
  order: number;
  title: string;
  description: string;
  categoryId: string;
  tags: string[];
  pageCount: number;
  imageCount: number;
  tableCount: number;
  cover?: string;
  author?: string;
  sourceFile: string;
}

export interface ContentImage {
  id: string;
  src: string;
  alt: string;
  description?: string;
  /** Rótulos visibles dentro de la imagen, útiles como guía de observación. */
  labels: string[];
  important: boolean;
  kind: string;
  width?: number;
  height?: number;
  page: number;
}

export interface ContentTable {
  id: string;
  caption: string;
  headers: string[];
  rows: string[][];
  notes?: string;
  page: number;
}

export type Block =
  | { kind: 'text'; variant: 'paragraph' | 'caption' | 'warning'; text: string }
  | { kind: 'list'; items: string[]; ordered: boolean }
  | { kind: 'image'; image: ContentImage }
  | { kind: 'table'; table: ContentTable };

/** Unidad mínima de estudio (una diapositiva con contenido). */
export interface Step {
  id: string;
  title: string;
  page: number;
  lessonId: string;
  blocks: Block[];
}

/** Agrupa pasos bajo una sección de nivel 1 del PDF. */
export interface Lesson {
  id: string;
  title: string;
  steps: Step[];
}

export interface TopicContent extends Topic {
  classLabel?: string;
  lessons: Lesson[];
  steps: Step[];
  images: ContentImage[];
  tables: ContentTable[];
}
