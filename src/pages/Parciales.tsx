import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { PageHeader } from '../components/Layout.tsx';
import { EmptyState, NotFoundState } from '../components/States.tsx';
import { ImageFigure } from '../components/ImageFigure.tsx';

// Cada carpeta parcial_N/ en la raíz del proyecto es un parcial: un .json + sus fotos (figuras/, paginas/).
// Vite los empaqueta en build; agregar parcial_2/ con la misma forma basta para que aparezca aquí.
type Parcial = typeof import('../../parcial_1/parcial1_soldadura.json');
const JSONS = import.meta.glob<Parcial>('/parcial_*/*.json', { eager: true, import: 'default' });
const IMAGES = import.meta.glob<string>('/parcial_*/**/*.jpg', { eager: true, query: '?url', import: 'default' });

const PARCIALES = Object.entries(JSONS)
  .map(([path, data]) => ({ id: path.split('/')[1], data }))
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

const img = (id: string, file: string, alt: string, page: number) => ({
  id: file, src: IMAGES[`/${id}/${file}`] ?? '', alt, labels: [], important: false, kind: 'foto', page,
});

/** Marca del docente → color de badge: correcta (verde), incorrecta (rojo), ambigua/parcial (ámbar). */
function Grade({ value }: { value?: string }) {
  if (!value) return null;
  const tone = value.startsWith('correcta') ? 'easy' : value.startsWith('incorrecta') ? 'hard' : 'medium';
  return <span className={`badge badge--${tone}`}>{value}</span>;
}

export default function Parciales() {
  const { id } = useParams();
  useDocumentMeta('Parciales');
  if (id) {
    const p = PARCIALES.find((x) => x.id === id);
    return p ? <ParcialView id={p.id} p={p.data} /> : <NotFoundState />;
  }
  return (
    <div className="stack-lg">
      <PageHeader title="Parciales">
        <p className="muted">Exámenes anteriores transcritos con sus respuestas, calificaciones y fotos originales.</p>
      </PageHeader>
      {PARCIALES.length ? (
        <div className="grid grid--2">
          {PARCIALES.map(({ id, data: { encabezado: e } }) => (
            <article key={id} className="card category-card">
              <div className="category-card__icon" aria-hidden><FileText /></div>
              <h3><Link to={`/parciales/${id}`} className="stretched">{e.titulo.split('.')[0]}</Link></h3>
              <p className="muted">{e.titulo.split('. ').slice(1).join('. ')}</p>
              <p className="meta"><span>{e.asignatura}</span><span>{e.fecha_manuscrita}</span><span>Nota {e.nota_final} / {e.nota_maxima}</span></p>
              <span className="card__cta">Ver parcial <ArrowRight size={16} aria-hidden /></span>
            </article>
          ))}
        </div>
      ) : <EmptyState title="No hay parciales disponibles" />}
    </div>
  );
}

function ParcialView({ id, p }: { id: string; p: Parcial }) {
  const { encabezado: e, resumen_notas: r, parte_1_teoria: t, parte_2_ejercicios: x } = p;
  const fig = (n: number) => {
    const f = p.figuras.find((f) => f.n === n);
    return f && <ImageFigure image={img(id, f.archivo, f.descripcion, f.pagina)} showGuide={false} />;
  };
  const sa = t.pregunta_abierta_soplo_de_arco;
  const { junta_de_esquina: je, problema_remolque: pr } = x;

  return (
    <div className="stack-lg narrow">
      <Link to="/parciales" className="back"><ArrowLeft size={18} aria-hidden /> Parciales</Link>
      <PageHeader eyebrow={`${e.asignatura} · ${e.codigo_asignatura} · ${e.fecha_manuscrita}`} title={e.titulo}>
        <p className="muted">{e.instrucciones}</p>
      </PageHeader>

      <section className="card stack">
        <h2>Resumen de notas</h2>
        <dl className="kv">
          <div><dt>Nota final</dt><dd>{e.nota_final} / {e.nota_maxima}</dd></div>
          <div><dt>Parte 1 · Teoría</dt><dd>{r.parte_1_teoria.obtenido} / {r.parte_1_teoria.valor}</dd></div>
          {r.parte_2_ejercicios.detalle.map((d) => <div key={d.seccion}><dt>{d.seccion}</dt><dd>{d.obtenido}</dd></div>)}
        </dl>
        <p className="small muted">{p.notas_transcripcion}</p>
      </section>

      <section className="stack">
        <h2>Parte 1 · Teoría ({t.valor})</h2>
        <h3>Verdadero o falso</h3>
        <ol className="review-list">
          {t.verdadero_falso.map((q) => (
            <li key={q.n} className="card stack">
              <p className="question__text">{q.n}. {q.enunciado}</p>
              <p><strong>Respuesta: {q.respuesta_estudiante}</strong> <Grade value={q.calificacion} /></p>
              {'justificacion_estudiante' in q && <p className="muted">{q.justificacion_estudiante}</p>}
            </li>
          ))}
        </ol>

        <h3>Soplo de arco</h3>
        <div className="card stack">
          <p className="question__text">{sa.enunciado}</p>
          {fig(sa.figura_ref)}
          <p>{sa.respuesta_estudiante}</p>
          <Grade value={sa.calificacion} />
        </div>

        <h3>Selección múltiple</h3>
        <ol className="review-list">
          {t.seleccion_multiple.map((q) => (
            <li key={q.n} className="card stack">
              <p className="question__text">{q.n}. {q.enunciado}</p>
              <ul className="options">
                {Object.entries(q.opciones).map(([k, v]) => (
                  <li key={k} className={`option ${k === q.respuesta_estudiante ? 'option--checked' : ''}`}>
                    <span className="option__letter">{k}</span><span className="option__text">{v}</span>
                  </li>
                ))}
              </ul>
              {q.procedimiento_estudiante && (
                <p className="muted"><code>{q.procedimiento_estudiante.ecuacion}</code> — {q.procedimiento_estudiante.notas}</p>
              )}
              <Grade value={q.calificacion} />
            </li>
          ))}
        </ol>
      </section>

      <section className="stack">
        <h2>Parte 2 · Ejercicios ({x.valor})</h2>
        <h3>Simbología <span className="badge">{x.simbologia.nota_pagina}</span></h3>
        <p className="muted">{x.simbologia.instruccion}</p>
        {x.simbologia.ejercicios.map((q) => (
          <div key={q.n} className="card stack">
            <p className="question__text">{q.n}. {q.descripcion}</p>
            {fig(q.figura_ref)}
            <p><strong>Respuesta:</strong> {q.respuesta_estudiante}</p>
            {'calificacion' in q && <Grade value={q.calificacion} />}
          </div>
        ))}

        <h3>Junta de esquina</h3>
        <div className="card stack">
          <p className="question__text">{je.descripcion}</p>
          {fig(je.figura_ref)}
          <p><strong>Respuesta:</strong> {je.respuesta_estudiante}</p>
        </div>

        <h3>Problema: remolque en {pr.datos.material} <span className="badge">{pr.nota_pagina}</span></h3>
        <div className="card stack">
          <p>{pr.enunciado}</p>
          <p className="question__text">{pr.pregunta}</p>
          {fig(pr.figura_ref)}
          <ul>
            {Object.entries(pr.respuesta_estudiante.descarte_procesos).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
          </ul>
          <p><strong>Procedimiento:</strong> {pr.respuesta_estudiante.procedimiento}</p>
        </div>
      </section>

      <section className="stack">
        <h2>Páginas originales</h2>
        <div className="grid grid--2">
          {p.orden_paginas.map((pg) => (
            <ImageFigure key={pg.pagina} image={img(id, pg.foto, `Página ${pg.pagina}: ${pg.contenido}`, pg.pagina)} showGuide={false} />
          ))}
        </div>
      </section>
    </div>
  );
}
