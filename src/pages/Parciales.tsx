import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, RotateCcw, XCircle } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { PageHeader } from '../components/Layout.tsx';
import { EmptyState, NotFoundState } from '../components/States.tsx';
import { ImageFigure } from '../components/ImageFigure.tsx';

// Cada carpeta parcial_N/ en la raíz del proyecto es un parcial: un .json + sus imágenes (figuras/, paginas/).
// Vite los empaqueta en build; agregar parcial_N/ con la misma forma basta para que aparezca aquí.
// Un parcial calificado trae respuesta_estudiante/calificacion; un simulacro solo trae la solucion.
interface Solucion {
  respuesta: string; justificacion: string; fuente?: string; contraste?: string;
  opciones?: Record<string, string>; pasos?: string[]; figura_ref?: number;
}
interface Item {
  n?: number; tema?: string; enunciado?: string; figura_ref?: number; solucion: Solucion;
  respuesta_estudiante?: string; calificacion?: string;
}
interface Closed extends Item {
  n: number; enunciado: string; opciones?: Record<string, string>;
  justificacion_estudiante?: string; procedimiento_estudiante?: { ecuacion: string; notas: string };
}
interface Problema extends Item { titulo: string; enunciado: string; pregunta?: string }
interface Parcial {
  encabezado: {
    asignatura: string; codigo_asignatura: string; titulo: string; fecha_manuscrita: string; instrucciones: string;
    temas?: string[]; nota_clave?: string; nota_final?: number; nota_maxima: number;
  };
  orden_paginas?: { pagina: number; contenido: string; foto: string }[];
  resumen_notas?: {
    parte_1_teoria: { valor: number; obtenido: number };
    parte_2_ejercicios: { detalle: { seccion: string; obtenido: number }[] };
  };
  parte_1_teoria: { valor: number; verdadero_falso: Closed[]; pregunta_abierta: Problema; seleccion_multiple: Closed[] };
  parte_2_ejercicios: {
    valor: number;
    simbologia: { instruccion: string; ejercicios: (Item & { n: number; descripcion: string })[] };
    problemas: Problema[];
  };
  notas_transcripcion?: string;
  figuras: { n: number; archivo: string; pagina?: number; descripcion: string; detalle?: string }[];
}

const JSONS = import.meta.glob<Parcial>('/parcial_*/*.json', { eager: true, import: 'default' });
const IMAGES = import.meta.glob<string>('/parcial_*/**/*.{jpg,svg}', { eager: true, query: '?url', import: 'default' });

const PARCIALES = Object.entries(JSONS)
  .map(([path, data]) => ({ id: path.split('/')[1], data }))
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

const img = (id: string, file: string, alt: string, page = 0, description?: string) => ({
  id: file, src: IMAGES[`/${id}/${file}`] ?? '', alt, description, labels: [], important: false, kind: 'foto', page,
});

type Fig = (n?: number) => ReactNode;

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
    return p ? <ParcialView key={p.id} id={p.id} p={p.data} /> : <NotFoundState />;
  }
  return (
    <div className="stack-lg">
      <PageHeader title="Parciales">
        <p className="muted">Exámenes anteriores y simulacros: respóndelos tú y compara con la clave justificada.</p>
      </PageHeader>
      {PARCIALES.length ? (
        <div className="grid grid--2">
          {PARCIALES.map(({ id, data: { encabezado: e } }) => (
            <article key={id} className="card category-card">
              <div className="category-card__icon" aria-hidden><FileText /></div>
              <h3><Link to={`/parciales/${id}`} className="stretched">{e.titulo.split('.')[0]}</Link></h3>
              <p className="muted">{e.titulo.split('. ').slice(1).join('. ')}</p>
              <p className="meta"><span>{e.asignatura}</span><span>{e.fecha_manuscrita}</span></p>
              <span className="card__cta">Simular parcial <ArrowRight size={16} aria-hidden /></span>
            </article>
          ))}
        </div>
      ) : <EmptyState title="No hay parciales disponibles" />}
    </div>
  );
}

/** Clave razonada: pasos, figura de solución, por qué, el porqué de cada opción, fuente y contraste con lo respondido. */
function Explain({ s, student, grade, extra, fig }: { s: Solucion; student?: string; grade?: string; extra?: ReactNode; fig: Fig }) {
  return (
    <div className="stack">
      {s.pasos && <ol>{s.pasos.map((p) => <li key={p}>{p}</li>)}</ol>}
      {fig(s.figura_ref)}
      <p className="feedback__why"><strong>Por qué:</strong> {s.justificacion}</p>
      {s.opciones && <ul>{Object.entries(s.opciones).map(([k, v]) => <li key={k}><strong>{k}.</strong> {v}</li>)}</ul>}
      {s.fuente && <p className="small muted">Fuente: {s.fuente}</p>}
      {student && (
        <div className="callout callout--warning stack">
          <p><strong>En el parcial se respondió:</strong> {student} <Grade value={grade} /></p>
          {extra}
          {s.contraste && <p><strong>Contraste:</strong> {s.contraste}</p>}
        </div>
      )}
    </div>
  );
}

interface ChoiceProps {
  qid: string; q: Closed; options: [string, string][]; trueFalse?: boolean; fig: Fig;
  value?: string; checked: boolean; onChange: (v: string) => void; onCheck: () => void;
}

/** Pregunta cerrada: eliges, compruebas y se revela la clave con su justificación. */
function Choice({ qid, q, options, trueFalse = false, fig, value, checked, onChange, onCheck }: ChoiceProps) {
  const key = q.solucion.respuesta;
  const state = (k: string) => !checked ? (k === value ? 'option--checked' : '')
    : k === key ? 'option--correct' : k === value ? 'option--wrong' : '';
  const extra = <>
    {q.justificacion_estudiante && <p><strong>Justificación dada:</strong> {q.justificacion_estudiante}</p>}
    {q.procedimiento_estudiante && (
      <p><strong>Procedimiento dado:</strong> <code>{q.procedimiento_estudiante.ecuacion}</code> — {q.procedimiento_estudiante.notas}</p>
    )}
  </>;
  return (
    <form className="question card" onSubmit={(e) => { e.preventDefault(); if (value) onCheck(); }}>
      <fieldset>
        <legend className="question__text">{q.n}. {q.enunciado}</legend>
        {q.tema && <span className="badge">{q.tema}</span>}
        <div className={`options ${trueFalse ? 'options--row' : ''}`}>
          {options.map(([k, label]) => (
            <label key={k} className={`option ${state(k)}`}>
              <input type="radio" name={qid} value={k} checked={value === k} disabled={checked} onChange={() => onChange(k)} />
              <span className="option__letter">{k}</span><span className="option__text">{label}</span>
              {checked && k === key && <span className="option__mark"><CheckCircle2 aria-hidden /></span>}
              {checked && k === value && k !== key && <span className="option__mark"><XCircle aria-hidden /></span>}
            </label>
          ))}
        </div>
      </fieldset>
      {checked ? (
        <div className={`feedback feedback--${value === key ? 'ok' : 'ko'}`} role="status">
          <p className="feedback__title">
            {value === key ? <><CheckCircle2 aria-hidden /> ¡Correcto!</> : <><XCircle aria-hidden /> Incorrecto: la respuesta es {key}</>}
          </p>
          <Explain s={q.solucion} student={q.respuesta_estudiante} grade={q.calificacion} extra={extra} fig={fig} />
        </div>
      ) : <button type="submit" className="btn btn--primary" disabled={!value}>Comprobar</button>}
    </form>
  );
}

/** Pregunta abierta: escribes tu respuesta (borrador local) y luego revelas la solución. */
function Open({ q, title, text, fig }: { q: Item; title?: string; text: ReactNode; fig: Fig }) {
  return (
    <div className="question card">
      {title && <h3>{title}</h3>}
      {q.tema && <span className="badge">{q.tema}</span>}
      <p className="question__text">{q.n !== undefined && `${q.n}. `}{text}</p>
      {fig(q.figura_ref)}
      <label className="field">
        <span>Tu respuesta</span>
        <textarea rows={4} placeholder="Escribe o esboza aquí tu respuesta antes de revelar…" />
      </label>
      <details className="reveal">
        <summary>Ver solución</summary>
        <div className="feedback feedback--ok stack">
          <p><strong>Respuesta:</strong> {q.solucion.respuesta}</p>
          <Explain s={q.solucion} student={q.respuesta_estudiante} grade={q.calificacion} fig={fig} />
        </div>
      </details>
    </div>
  );
}

function Part({ title, value, children }: { title: string; value: number; children: ReactNode }) {
  return (
    <section className="stack">
      <div className="section-head"><h2>{title}</h2><span className="badge">{value.toFixed(1)} pts</span></div>
      {children}
    </section>
  );
}

function ParcialView({ id, p }: { id: string; p: Parcial }) {
  const { encabezado: e, resumen_notas: r, parte_1_teoria: t, parte_2_ejercicios: x } = p;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const fig: Fig = (n) => {
    const f = p.figuras.find((f) => f.n === n);
    return f && <ImageFigure image={img(id, f.archivo, f.descripcion, f.pagina, f.detalle ?? f.descripcion)} showGuide={false} />;
  };

  const closed = [
    ...t.verdadero_falso.map((q) => ({ qid: `vf${q.n}`, key: q.solucion.respuesta })),
    ...t.seleccion_multiple.map((q) => ({ qid: `sm${q.n}`, key: q.solucion.respuesta })),
  ];
  const done = closed.filter((q) => checked[q.qid]);
  const hits = done.filter((q) => answers[q.qid] === q.key).length;
  const bind = (qid: string) => ({
    qid, fig, value: answers[qid], checked: !!checked[qid],
    onChange: (v: string) => setAnswers((a) => ({ ...a, [qid]: v })),
    onCheck: () => setChecked((c) => ({ ...c, [qid]: true })),
  });
  const pa = t.pregunta_abierta;

  return (
    <div className="stack-lg parcial">
      <Link to="/parciales" className="back"><ArrowLeft size={18} aria-hidden /> Parciales</Link>
      <PageHeader eyebrow={`${e.asignatura} · ${e.codigo_asignatura} · ${e.fecha_manuscrita}`} title={e.titulo}>
        <p className="callout callout--warning">{e.instrucciones}</p>
        {e.temas && <p className="meta">{e.temas.map((tm) => <span key={tm}>{tm}</span>)}</p>}
        {e.nota_clave && <p className="small muted">{e.nota_clave}</p>}
      </PageHeader>

      <Part title="Parte 1 · Teoría" value={t.valor}>
        <h3>Verdadero o falso</h3>
        {t.verdadero_falso.map((q) => (
          <Choice key={q.n} {...bind(`vf${q.n}`)} q={q} trueFalse options={[['V', 'Verdadero'], ['F', 'Falso']]} />
        ))}

        <h3>Pregunta abierta</h3>
        <Open q={pa} title={pa.titulo} text={pa.enunciado} fig={fig} />

        <h3>Selección múltiple</h3>
        {t.seleccion_multiple.map((q) => (
          <Choice key={q.n} {...bind(`sm${q.n}`)} q={q} options={Object.entries(q.opciones ?? {})} />
        ))}
      </Part>

      <Part title="Parte 2 · Ejercicios" value={x.valor}>
        <h3>Simbología</h3>
        <p className="muted">{x.simbologia.instruccion}</p>
        {x.simbologia.ejercicios.map((q) => <Open key={q.n} q={q} text={q.descripcion} fig={fig} />)}

        {x.problemas.map((q) => (
          <Open key={q.titulo} q={q} title={q.titulo} fig={fig}
            text={<>{q.enunciado}{q.pregunta && <><br /><br />{q.pregunta}</>}</>} />
        ))}
      </Part>

      <section className="card stack">
        <h2>Tu resultado</h2>
        <p>
          {done.length
            ? <>Acertaste <strong>{hits} de {done.length}</strong> preguntas cerradas comprobadas ({closed.length} en total).</>
            : 'Comprueba preguntas cerradas para ver tu puntaje aquí.'}
        </p>
        <div className="actions">
          <button className="btn btn--primary" onClick={() => setChecked(Object.fromEntries(closed.map((q) => [q.qid, true])))}>Comprobar todo</button>
          <button className="btn btn--ghost" onClick={() => { setAnswers({}); setChecked({}); }}><RotateCcw size={18} aria-hidden /> Reiniciar</button>
        </div>
        {r && (
          <details className="reveal">
            <summary>Nota real del parcial ({e.nota_final} / {e.nota_maxima})</summary>
            <dl className="kv">
              <div><dt>Parte 1 · Teoría</dt><dd>{r.parte_1_teoria.obtenido} / {r.parte_1_teoria.valor}</dd></div>
              {r.parte_2_ejercicios.detalle.map((d) => <div key={d.seccion}><dt>{d.seccion}</dt><dd>{d.obtenido}</dd></div>)}
            </dl>
            {p.notas_transcripcion && <p className="small muted">{p.notas_transcripcion}</p>}
          </details>
        )}
        {p.orden_paginas && (
          <details className="reveal">
            <summary>Fotos del parcial original</summary>
            <div className="grid grid--2">
              {p.orden_paginas.map((pg) => (
                <ImageFigure key={pg.pagina} image={img(id, pg.foto, `Página ${pg.pagina}: ${pg.contenido}`, pg.pagina)} showGuide={false} />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
