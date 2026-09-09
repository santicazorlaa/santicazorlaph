import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { adminPassword, authSecret } from "./env";

const COOKIE = "sc_admin";
const MAX_AGE = 60 * 60 * 24 * 30;

function sign(expires: number) {
  return createHmac("sha256", authSecret()).update(`admin:${expires}`).digest("hex");
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
