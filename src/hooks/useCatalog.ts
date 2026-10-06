import { getCategories, getTopics } from '../services/contentRepository.ts';
import { useAsync } from './useAsync.ts';

/** Temas + categorías (solo index.json: lo mínimo para listados y dashboard). */
export const useCatalog = () =>
  useAsync(async () => {
    const [topics, categories] = await Promise.all([getTopics(), getCategories()]);
    return { topics, categories, categoryName: (id: string) => categories.find((c) => c.id === id)?.name ?? '' };
  }, []);
