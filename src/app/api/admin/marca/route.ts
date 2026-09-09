import { NextResponse } from "next/server";

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
