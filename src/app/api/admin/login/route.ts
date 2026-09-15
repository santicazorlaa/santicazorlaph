import { NextResponse } from "next/server";

import { checkPassword, startSession } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { ipDe, olvidarIntentos, superaLimite } from "@/lib/limite";

const QUINCE_MINUTOS = 15 * 60;

/// Form POST común en vez de server action: entra sin depender de JavaScript.
export async function POST(request: Request) {
  // El freno va antes de mirar la contraseña: si fuera después, quien prueba a
  // la fuerza seguiría enterándose de si acertó.
  const clave = `login:${ipDe(request)}`;
  if (await superaLimite(clave, 5, QUINCE_MINUTOS)) {
    return NextResponse.redirect(`${siteUrl}/admin/login?error=limite`, { status: 303 });
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  if (!checkPassword(password)) {
    return NextResponse.redirect(`${siteUrl}/admin/login?error=1`, { status: 303 });
  }

  await olvidarIntentos(clave);
  await startSession();
  return NextResponse.redirect(`${siteUrl}/admin`, { status: 303 });
}
