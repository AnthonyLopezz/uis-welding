// Copia los datos extraídos de los PDFs (output/) a public/ para que Vite/Netlify los sirvan como estáticos.
// output/ es la fuente de verdad y no se modifica. Solo se publican .webp (los .jpeg/.png originales no).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'output';
const DATA = 'public/data';
const IMAGES = 'public/images';

rmSync(DATA, { recursive: true, force: true });
rmSync(IMAGES, { recursive: true, force: true });
mkdirSync(join(DATA, 'documents'), { recursive: true });

for (const file of ['index.json', 'tags.json']) cpSync(join(SRC, file), join(DATA, file));

const slugs = readdirSync(join(SRC, 'documents'));
for (const slug of slugs) {
  const dir = join(SRC, 'documents', slug);
  cpSync(join(dir, 'content.json'), join(DATA, 'documents', `${slug}.json`));
  if (existsSync(join(dir, 'images'))) {
    cpSync(join(dir, 'images'), join(IMAGES, slug), { recursive: true, filter: (p) => !/\.(jpe?g|png)$/i.test(p) });
  }
}
console.log(`sync-data: ${slugs.length} documentos copiados a public/`);
