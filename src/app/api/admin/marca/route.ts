import { NextResponse } from "next/server";

import {
  acotar,
  CALIDAD_PREVIEW,
  guardarAjuste,
  OPACIDAD_CENTRO,
  OPACIDAD_MOSAICO,
} from "@/lib/ajustes";
import { isAdmin } from "@/lib/auth";
import { borrarMarca, guardarMarca, MarcaError } from "@/lib/marca";
import { esSlot } from "@/lib/marca-slots";
import { siteUrl } from "@/lib/env";

/// Se envía como form normal para que ande sin JavaScript, igual que el login.
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(`${siteUrl}/admin/login`, { status: 303 });
  }

  const form = await request.formData();
  const slot = String(form.get("slot") ?? "");
  const accion = String(form.get("accion") ?? "guardar");

  // La intensidad no pertenece a un slot: es un ajuste del sitio, así que se
  // resuelve antes de exigir que venga un slot válido.
  if (accion === "opacidad") {
    // El mosaico y el centro viajan en porcentaje y se guardan de 0 a 1; la
    // calidad JPEG ya viene en la escala en que se guarda.
    const leer = (campo: string, clave: string, dividir: number) => {
      const n = Number(form.get(campo));
      return Number.isFinite(n) ? acotar(clave, n / dividir) : null;
    };

    const mosaico = leer("mosaico", OPACIDAD_MOSAICO, 100);
    const centro = leer("centro", OPACIDAD_CENTRO, 100);
    const calidad = leer("calidad", CALIDAD_PREVIEW, 1);
    if (mosaico === null || centro === null || calidad === null) {
      return NextResponse.redirect(`${siteUrl}/admin/ajustes?marca=opacidad-invalida`, {
        status: 303,
      });
    }

    await guardarAjuste(OPACIDAD_MOSAICO, String(mosaico));
    await guardarAjuste(OPACIDAD_CENTRO, String(centro));
    await guardarAjuste(CALIDAD_PREVIEW, String(calidad));
    return NextResponse.redirect(`${siteUrl}/admin/ajustes?marca=opacidad`, { status: 303 });
  }

  if (!esSlot(slot)) {
    return NextResponse.redirect(`${siteUrl}/admin/ajustes?marca=slot-invalido`, { status: 303 });
  }

  if (accion === "borrar") {
    await borrarMarca(slot);
    return NextResponse.redirect(`${siteUrl}/admin/ajustes?marca=restaurada`, { status: 303 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(`${siteUrl}/admin/ajustes?marca=sin-archivo`, { status: 303 });
  }

  try {
    await guardarMarca(slot, file);
  } catch (error) {
    const motivo =
      error instanceof MarcaError ? error.message : "No pudimos guardar el archivo";
    return NextResponse.redirect(
      `${siteUrl}/admin/ajustes?marca=error&detalle=${encodeURIComponent(motivo)}`,
      { status: 303 },
    );
  }

  return NextResponse.redirect(`${siteUrl}/admin/ajustes?marca=guardada`, { status: 303 });
}
