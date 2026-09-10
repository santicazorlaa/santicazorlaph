import { NextResponse } from "next/server";

import { ESCALONES_DESCUENTO, guardarAjuste } from "@/lib/ajustes";
import { isAdmin } from "@/lib/auth";
import { escribir, MAXIMO_ESCALONES, type Escalon } from "@/lib/descuentos";
import { siteUrl } from "@/lib/env";

/// Se envía como form normal para que ande sin JavaScript, igual que el resto
/// del panel.
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(`${siteUrl}/admin/login`, { status: 303 });
  }

  const form = await request.formData();

  const filas: Escalon[] = [];
  for (let i = 0; i < MAXIMO_ESCALONES; i++) {
    const desde = Number(form.get(`desde${i}`));
    const porcentaje = Number(form.get(`pct${i}`));
    // Las filas vacías son la forma de sacar un escalón, así que no son error.
    if (!Number.isFinite(desde) || !Number.isFinite(porcentaje)) continue;
    filas.push({ desde, porcentaje });
  }

  // `escribir` normaliza: ordena, saca repetidos y acota el porcentaje. Guardar
  // ya normalizado evita que quede en la base algo que después haya que
  // interpretar de otra manera.
  const texto = escribir(filas);
  if (!texto) {
    return NextResponse.redirect(`${siteUrl}/admin/ajustes?descuentos=vacio`, { status: 303 });
  }

  await guardarAjuste(ESCALONES_DESCUENTO, texto);
  return NextResponse.redirect(`${siteUrl}/admin/ajustes?descuentos=guardados`, { status: 303 });
}
