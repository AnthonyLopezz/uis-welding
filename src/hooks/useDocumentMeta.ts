import { useEffect } from 'react';

const APP = 'UIS Learning';

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/** Título y metadatos por página: "UIS Learning — <título>". */
export function useDocumentMeta(title?: string, description?: string) {
  useEffect(() => {
    const full = title ? `${APP} — ${title}` : `${APP} — Soldadura`;
    document.title = full;
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
  }, [title, description]);
}
