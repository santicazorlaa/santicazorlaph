import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { adminPassword, authSecret } from "./env";

const COOKIE = "sc_admin";
const MAX_AGE = 60 * 60 * 24 * 30;

/// La firma de la sesión incluye una huella de la contraseña. Así, cambiar
/// `ADMIN_PASSWORD` en Vercel cierra en el acto todas las sesiones abiertas:
/// es la forma de echar a alguien que se haya llevado la cookie, sin tener que
/// rotar además `AUTH_SECRET`.
function sign(expires: number) {
  const huella = createHash("sha256").update(adminPassword()).digest("hex");
  return createHmac("sha256", authSecret()).update(`admin:${expires}:${huella}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function checkPassword(input: string) {
  return safeEqual(input, adminPassword());
}

export async function startSession() {
  const expires = Date.now() + MAX_AGE * 1000;
  const store = await cookies();
  store.set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function isAdmin() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;

  const [expires, signature] = raw.split(".");
  if (!expires || !signature) return false;
  if (Number(expires) < Date.now()) return false;

  return safeEqual(signature, sign(Number(expires)));
}

/**
 * El pase de una entrega con PIN.
 *
 * Antes la cookie decía literalmente "authorized", y cualquiera podía
 * escribirla a mano en su navegador y saltarse el PIN. Ahora lleva una firma
 * que sólo el servidor sabe calcular, atada a la entrega y a su PIN: si Santi
 * cambia el PIN, los pases viejos dejan de servir solos.
 */
export function cookieDeEntrega(entregaId: string) {
  return `pin_${entregaId}`;
}

export function paseDeEntrega(entregaId: string, pin: string) {
  return createHmac("sha256", authSecret()).update(`entrega:${entregaId}:${pin.trim()}`).digest("hex");
}

export async function entregaAutorizada(entrega: { id: string; pin: string | null }) {
  if (!entrega.pin) return true;
  const valor = (await cookies()).get(cookieDeEntrega(entrega.id))?.value;
  return Boolean(valor) && safeEqual(valor!, paseDeEntrega(entrega.id, entrega.pin));
}

export function pinCorrecto(ingresado: string, pin: string) {
  return safeEqual(ingresado.trim(), pin.trim());
}
