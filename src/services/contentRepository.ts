// Acceso a los contenidos. La UI solo conoce estas funciones, no los archivos JSON.
import type { Category, RawDocument, RawIndexEntry, Topic, TopicContent } from '../types/content.ts';
import { toCategories, toTopic, toTopicContent } from './normalize.ts';

const BASE = import.meta.env.BASE_URL;
const cache = new Map<string, Promise<unknown>>();

/** fetch con caché en memoria: cada JSON se descarga una sola vez por sesión. */
function getJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(`${BASE}data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${path} (${r.status})`);
      return r.json();
    });
    p.catch(() => cache.delete(path)); // permite reintentar tras un error de red
    cache.set(path, p);
  }
  return cache.get(path) as Promise<T>;
}

export const getDocuments = () => getJson<RawIndexEntry[]>('index.json');

export async function getTopics(): Promise<Topic[]> {
  const docs = await getDocuments();
  return docs.map((d, i) => toTopic(d, i, BASE));
}

export async function getCategories(): Promise<Category[]> {
  return toCategories(await getTopics());
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  return (await getCategories()).find((c) => c.id === id);
}

const topicCache = new Map<string, Promise<TopicContent | undefined>>();

/** Documento normalizado; se normaliza una sola vez por sesión. */
export function getTopicById(id: string): Promise<TopicContent | undefined> {
  if (!topicCache.has(id)) {
    const p = (async () => {
      const topic = (await getTopics()).find((t) => t.id === id);
      if (!topic) return undefined;
      return toTopicContent(topic, await getJson<RawDocument>(`documents/${id}.json`), BASE);
    })();
    p.catch(() => topicCache.delete(id));
    topicCache.set(id, p);
  }
  return topicCache.get(id)!;
}

export async function getAllTopicContents(): Promise<TopicContent[]> {
  const topics = await getTopics();
  return (await Promise.all(topics.map((t) => getTopicById(t.id)))).filter((t): t is TopicContent => !!t);
}

export async function getTags(): Promise<string[]> {
  const tags = await getJson<{ tag: string }[]>('tags.json');
  return tags.map((t) => t.tag);
}
