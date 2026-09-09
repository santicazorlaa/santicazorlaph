import { NextResponse } from "next/server";

import {
  acotarOpacidad,
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
    const porcentaje = (campo: string) => {
      const n = Number(form.get(campo));
      return Number.isFinite(n) ? acotarOpacidad(n / 100) : null;
    };

    const mosaico = porcentaje("mosaico");
    const centro = porcentaje("centro");
    if (mosaico === null || centro === null) {
      return NextResponse.redirect(`${siteUrl}/admin?marca=opacidad-invalida`, {
        status: 303,
      });
    }

    await guardarAjuste(OPACIDAD_MOSAICO, String(mosaico));
    await guardarAjuste(OPACIDAD_CENTRO, String(centro));
    return NextResponse.redirect(`${siteUrl}/admin?marca=opacidad`, { status: 303 });
  }

  if (!esSlot(slot)) {
    return NextResponse.redirect(`${siteUrl}/admin?marca=slot-invalido`, { status: 303 });
  }

  if (accion === "borrar") {
    await borrarMarca(slot);
    return NextResponse.redirect(`${siteUrl}/admin?marca=restaurada`, { status: 303 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(`${siteUrl}/admin?marca=sin-archivo`, { status: 303 });
  }

  try {
    await guardarMarca(slot, file);
  } catch (error) {
    const motivo =
      error instanceof MarcaError ? error.message : "No pudimos guardar el archivo";
    return NextResponse.redirect(
      `${siteUrl}/admin?marca=error&detalle=${encodeURIComponent(motivo)}`,
      { status: 303 },
    );
  }

  return NextResponse.redirect(`${siteUrl}/admin?marca=guardada`, { status: 303 });
}
