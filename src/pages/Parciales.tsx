import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, FileText, RotateCcw, XCircle } from 'lucide-react';
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

/**
 * El JSON solo trae la respuesta de la estudiante y la marca del docente, no una clave oficial.
 * Clave deducible: si la marcaron correcta es esa; en V/F incorrecta es la contraria. Si no, no hay clave.
 */
function keyOf(student: string, grade: string, trueFalse: boolean) {
  if (grade.startsWith('correcta')) return student;
  if (trueFalse && grade.startsWith('incorrecta')) return student === 'V' ? 'F' : 'V';
  return undefined;
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
        <p className="muted">Exámenes anteriores para simular: respóndelos tú y compara con la respuesta calificada.</p>
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

interface ChoiceProps {
  qid: string; n: number; text: string; options: [string, string][]; student: string; grade: string; trueFalse?: boolean;
  extra?: ReactNode; value?: string; checked: boolean; onChange: (v: string) => void; onCheck: () => void;
}

/** Pregunta cerrada: eliges, compruebas y se revela la respuesta calificada. */
function Choice({ qid, n, text, options, student, grade, trueFalse = false, extra, value, checked, onChange, onCheck }: ChoiceProps) {
  const key = keyOf(student, grade, trueFalse);
  const state = (k: string) => !checked ? (k === value ? 'option--checked' : '')
    : k === key ? 'option--correct' : k === value ? (key ? 'option--wrong' : 'option--checked') : '';
  return (
    <form className="question card" onSubmit={(e) => { e.preventDefault(); if (value) onCheck(); }}>
      <fieldset>
        <legend className="question__text">{n}. {text}</legend>
        <div className={`options ${trueFalse ? 'options--row' : ''}`}>
          {options.map(([k, label]) => (
            <label key={k} className={`option ${state(k)}`}>
              <input type="radio" name={qid} value={k} checked={value === k} disabled={checked} onChange={() => onChange(k)} />
              <span className="option__letter">{k}</span><span className="option__text">{label}</span>
              {checked && k === key && <span className="option__mark"><CheckCircle2 aria-hidden /></span>}
              {checked && key && k === value && k !== key && <span className="option__mark"><XCircle aria-hidden /></span>}
            </label>
          ))}
        </div>
      </fieldset>
      {checked ? (
        <div className={`feedback feedback--${!key ? 'neutral' : value === key ? 'ok' : 'ko'}`} role="status">
          <p className="feedback__title">
            {!key ? <><CircleHelp aria-hidden /> Sin clave confirmada</> : value === key
              ? <><CheckCircle2 aria-hidden /> ¡Correcto!</> : <><XCircle aria-hidden /> Incorrecto: la respuesta es {key}</>}
          </p>
          <p>En el parcial se respondió <strong>{student}</strong> <Grade value={grade} /></p>
          {extra}
        </div>
      ) : <button type="submit" className="btn btn--primary" disabled={!value}>Comprobar</button>}
    </form>
  );
}

/** Pregunta abierta: escribes tu respuesta (borrador local) y luego revelas la del parcial. */
function Open({ n, text, figure, children }: { n?: number; text: ReactNode; figure?: ReactNode; children: ReactNode }) {
  return (
    <div className="question card">
      <p className="question__text">{n !== undefined && `${n}. `}{text}</p>
      {figure}
      <label className="field">
        <span>Tu respuesta</span>
        <textarea rows={4} placeholder="Escribe o esboza aquí tu respuesta antes de revelar…" />
      </label>
      <details className="reveal">
        <summary>Ver respuesta del parcial</summary>
        <div className="stack">{children}</div>
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

  const fig = (n: number) => {
    const f = p.figuras.find((f) => f.n === n);
    return f && <ImageFigure image={img(id, f.archivo, f.descripcion, f.pagina)} showGuide={false} />;
  };
  const sa = t.pregunta_abierta_soplo_de_arco;
  const { junta_de_esquina: je, problema_remolque: pr } = x;

  const closed = [
    ...t.verdadero_falso.map((q) => ({ qid: `vf${q.n}`, key: keyOf(q.respuesta_estudiante, q.calificacion, true) })),
    ...t.seleccion_multiple.map((q) => ({ qid: `sm${q.n}`, key: keyOf(q.respuesta_estudiante, q.calificacion, false) })),
  ];
  const gradable = closed.filter((q) => q.key && checked[q.qid]);
  const hits = gradable.filter((q) => answers[q.qid] === q.key).length;
  const bind = (qid: string) => ({
    qid, value: answers[qid], checked: !!checked[qid],
    onChange: (v: string) => setAnswers((a) => ({ ...a, [qid]: v })),
    onCheck: () => setChecked((c) => ({ ...c, [qid]: true })),
  });

  return (
    <div className="stack-lg parcial">
      <Link to="/parciales" className="back"><ArrowLeft size={18} aria-hidden /> Parciales</Link>
      <PageHeader eyebrow={`${e.asignatura} · ${e.codigo_asignatura} · ${e.fecha_manuscrita}`} title={e.titulo}>
        <p className="callout callout--warning">{e.instrucciones}</p>
      </PageHeader>

      <Part title="Parte 1 · Teoría" value={t.valor}>
        <h3>Verdadero o falso</h3>
        {t.verdadero_falso.map((q) => (
          <Choice key={q.n} {...bind(`vf${q.n}`)} n={q.n} text={q.enunciado} trueFalse
            options={[['V', 'Verdadero'], ['F', 'Falso']]} student={q.respuesta_estudiante} grade={q.calificacion}
            extra={'justificacion_estudiante' in q && <p className="feedback__why"><strong>Justificación:</strong> {q.justificacion_estudiante}</p>} />
        ))}

        <h3>Pregunta abierta</h3>
        <Open text={sa.enunciado} figure={fig(sa.figura_ref)}>
          <p>{sa.respuesta_estudiante}</p>
          <Grade value={sa.calificacion} />
        </Open>

        <h3>Selección múltiple</h3>
        {t.seleccion_multiple.map((q) => (
          <Choice key={q.n} {...bind(`sm${q.n}`)} n={q.n} text={q.enunciado}
            options={Object.entries(q.opciones)} student={q.respuesta_estudiante} grade={q.calificacion}
            extra={q.procedimiento_estudiante && (
              <p className="feedback__why"><strong>Procedimiento:</strong> <code>{q.procedimiento_estudiante.ecuacion}</code> — {q.procedimiento_estudiante.notas}</p>
            )} />
        ))}
      </Part>

      <Part title="Parte 2 · Ejercicios" value={x.valor}>
        <h3>Simbología</h3>
        <p className="muted">{x.simbologia.instruccion}</p>
        {x.simbologia.ejercicios.map((q) => (
          <Open key={q.n} n={q.n} text={q.descripcion} figure={fig(q.figura_ref)}>
            <p>{q.respuesta_estudiante}</p>
            {'calificacion' in q && <Grade value={q.calificacion} />}
          </Open>
        ))}

        <h3>Junta de esquina</h3>
        <Open text={je.descripcion} figure={fig(je.figura_ref)}>
          <p>{je.respuesta_estudiante}</p>
        </Open>

        <h3>Problema: remolque ultraliviano</h3>
        <Open text={<>{pr.enunciado}<br /><br />{pr.pregunta}</>} figure={fig(pr.figura_ref)}>
          <ul>
            {Object.entries(pr.respuesta_estudiante.descarte_procesos).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
          </ul>
          <p><strong>Procedimiento:</strong> {pr.respuesta_estudiante.procedimiento}</p>
        </Open>
      </Part>

      <section className="card stack">
        <h2>Tu resultado</h2>
        <p>
          {gradable.length
            ? <>Acertaste <strong>{hits} de {gradable.length}</strong> preguntas cerradas con clave confirmada.</>
            : 'Comprueba preguntas cerradas para ver tu puntaje aquí.'}
          {' '}<span className="muted">({closed.filter((q) => !q.key).length} no tienen clave confirmada en la transcripción.)</span>
        </p>
        <div className="actions">
          <button className="btn btn--primary" onClick={() => setChecked(Object.fromEntries(closed.map((q) => [q.qid, true])))}>Comprobar todo</button>
          <button className="btn btn--ghost" onClick={() => { setAnswers({}); setChecked({}); }}><RotateCcw size={18} aria-hidden /> Reiniciar</button>
        </div>
        <details className="reveal">
          <summary>Nota real del parcial ({e.nota_final} / {e.nota_maxima})</summary>
          <dl className="kv">
            <div><dt>Parte 1 · Teoría</dt><dd>{r.parte_1_teoria.obtenido} / {r.parte_1_teoria.valor}</dd></div>
            {r.parte_2_ejercicios.detalle.map((d) => <div key={d.seccion}><dt>{d.seccion}</dt><dd>{d.obtenido}</dd></div>)}
          </dl>
          <p className="small muted">{p.notas_transcripcion}</p>
        </details>
        <details className="reveal">
          <summary>Fotos del parcial original</summary>
          <div className="grid grid--2">
            {p.orden_paginas.map((pg) => (
              <ImageFigure key={pg.pagina} image={img(id, pg.foto, `Página ${pg.pagina}: ${pg.contenido}`, pg.pagina)} showGuide={false} />
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
