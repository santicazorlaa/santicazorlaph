/**
 * Aplica el historial de migraciones a la base REAL, usando las credenciales
 * de .env.vercel en vez de las de .env (que desde ahora apunta a la base de
 * prueba).
 *
 *   npx tsx --env-file=.env.vercel scripts/migrar-produccion.ts
 *
 * Hace falta correrlo cada vez que se cambia el esquema de la base (un campo
 * nuevo, una tabla nueva): la base de prueba se actualiza con
 * `npx prisma migrate dev`, pero la real sólo se entera cuando se corre esto.
 *
 * Sin argumentos aplica lo que falte. Con argumentos, se los pasa tal cual a
 * `prisma migrate`, que es lo que hace falta para desatascar una migración que
 * falló a mitad —pasó una vez, ver el CLAUDE.md—:
 *
 *   npx tsx --env-file=.env.vercel scripts/migrar-produccion.ts resolve --rolled-back <nombre>
 */
import { execSync } from "node:child_process";

const argumentos = process.argv.slice(2);
const orden = argumentos.length > 0 ? argumentos.join(" ") : "deploy";

execSync(`npx prisma migrate ${orden}`, { stdio: "inherit" });
