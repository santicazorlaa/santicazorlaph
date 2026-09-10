/**
 * Copia los textos del sitio de una base a la otra.
 *
 * Hace falta porque desarrollo y producción usan bases distintas, a propósito:
 * lo que Santi escribe probando en local no aparece en el sitio publicado hasta
 * que se copia. Las imágenes en cambio viajan solas —el bucket es compartido—,
 * así que con los textos alcanza.
 *
 * Va en dos pasos, y no en uno, para poder mirar el archivo antes de escribir
 * en la base real:
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/copiar-contenido.ts --exportar
 *   npx tsx --conditions=react-server --env-file=.env.vercel scripts/copiar-contenido.ts --importar
 *
 * Sin `--importar` el segundo paso es un ensayo y no escribe nada.
 *
 * Sólo toca las claves de contenido: la marca de agua y los descuentos se
 * configuran en producción y no se pisan desde acá.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { CLAVES, leerContenido, guardarContenido, type Clave } from "../src/lib/contenido";
import { db } from "../src/lib/db";

const ARCHIVO = "contenido.json";

async function exportar() {
  const contenido = await leerContenido();
  const guardar: Partial<Record<Clave, string>> = {};

  for (const clave of CLAVES) {
    // Lo vacío no se exporta: si en producción hay algo escrito y acá no, sería
    // borrarlo sin querer.
    if (contenido[clave].trim()) guardar[clave] = contenido[clave];
  }

  writeFileSync(ARCHIVO, JSON.stringify(guardar, null, 2), "utf8");
  console.log(`${Object.keys(guardar).length} textos guardados en ${ARCHIVO}`);
}

async function importar(aplicar: boolean) {
  const datos = JSON.parse(readFileSync(ARCHIVO, "utf8")) as Record<string, string>;
  const validas = Object.fromEntries(
    Object.entries(datos).filter(([clave]) => (CLAVES as readonly string[]).includes(clave)),
  ) as Partial<Record<Clave, string>>;

  const actual = await leerContenido();
  for (const [clave, valor] of Object.entries(validas) as [Clave, string][]) {
    const antes = actual[clave];
    const cambia = antes !== valor;
    console.log(
      `${cambia ? "→" : " ="} ${clave}: ${valor.slice(0, 60).replace(/\n/g, " / ")}${
        cambia && antes ? `   (pisa: ${antes.slice(0, 30).replace(/\n/g, " / ")}…)` : ""
      }`,
    );
  }

  if (!aplicar) {
    console.log("\nFue un ensayo. Nada de esto se escribió todavía.");
    return;
  }

  await guardarContenido(validas);
  console.log(`\n${Object.keys(validas).length} textos escritos en esta base.`);
}

async function main() {
  if (process.argv.includes("--exportar")) return exportar();
  return importar(process.argv.includes("--importar"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
