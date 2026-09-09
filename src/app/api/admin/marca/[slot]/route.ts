import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth";
import { leerMarca } from "@/lib/marca";
import { esSlot } from "@/lib/marca-slots";

/// Muestra la marca subida a mano dentro del panel. Sin caché: si la cambiás,
/// tenés que ver la nueva al instante.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { slot } = await params;
  if (!esSlot(slot)) {
    return NextResponse.json({ error: "Slot inválido" }, { status: 400 });
  }

  const marca = await leerMarca(slot);
  if (!marca) {
    return NextResponse.json({ error: "No hay marca propia" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(marca.data), {
    headers: {
      "Content-Type": marca.mime,
      "Cache-Control": "private, no-store",
    },
  });
}
