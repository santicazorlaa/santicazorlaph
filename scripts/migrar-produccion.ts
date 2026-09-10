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
 */
import { execSync } from "node:child_process";

execSync("npx prisma migrate deploy", { stdio: "inherit" });
