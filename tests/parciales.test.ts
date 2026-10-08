// Integridad de los parciales: cada clave es una opción válida y cada figura citada existe en disco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const dirs = readdirSync('.').filter((d) => /^parcial_\d+$/.test(d));

for (const dir of dirs) {
  test(`${dir}: claves y figuras coherentes`, () => {
    const file = readdirSync(dir).find((f) => f.endsWith('.json'))!;
    const p = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
    const t = p.parte_1_teoria;
    for (const q of t.verdadero_falso) assert.match(q.solucion.respuesta, /^[VF]$/, `V/F ${q.n}`);
    for (const q of t.seleccion_multiple) assert.ok(q.solucion.respuesta in q.opciones, `selección ${q.n}`);

    const figs = new Set(p.figuras.map((f: { n: number; archivo: string }) => {
      assert.ok(existsSync(`${dir}/${f.archivo}`), `falta ${f.archivo}`);
      return f.n;
    }));
    const items = [t.pregunta_abierta, ...t.verdadero_falso, ...t.seleccion_multiple,
      ...p.parte_2_ejercicios.simbologia.ejercicios, ...p.parte_2_ejercicios.problemas];
    for (const q of items) {
      assert.ok(q.solucion?.justificacion, `sin justificación: ${q.n ?? q.titulo}`);
      for (const ref of [q.figura_ref, q.solucion.figura_ref]) if (ref) assert.ok(figs.has(ref), `figura ${ref}`);
    }
  });
}
