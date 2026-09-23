import { NextResponse } from "next/server";

import { guardarAjuste, MOSTRAR_PRECIO_INICIO } from "@/lib/ajustes";
import { isAdmin } from "@/lib/auth";
import { siteUrl } from "@/lib/env";

/// Se envía como form normal para que ande sin JavaScript, igual que el resto
/// del panel. Un checkbox sin marcar no manda nada en el form: por eso
/// "mostrar" ausente significa apagado, no un error.
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(`${siteUrl}/admin/login`, { status: 303 });
  }

  const form = await request.formData();
  const mostrar = form.get("mostrar") === "1";

  await guardarAjuste(MOSTRAR_PRECIO_INICIO, mostrar ? "1" : "0");
  return NextResponse.redirect(`${siteUrl}/admin/ajustes?precio=guardado`, { status: 303 });
}
