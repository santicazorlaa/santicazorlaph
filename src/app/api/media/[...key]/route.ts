import { NextResponse } from "next/server";

import { getObject } from "@/lib/storage";
import { usingLocalStorage } from "@/lib/env";

/**
 * Sirve los previews con marca de agua cuando trabajamos sin R2. En producción
 * los sirve el CDN y esta ruta no se usa.
 *
 * Sólo entrega el bucket público: los originales viven en otro bucket y no hay
 * ninguna ruta que los exponga sin pago.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (!usingLocalStorage()) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  const { key } = await params;
  const objectKey = key.join("/");

  // Sin esto, un ".." en la URL podría salirse de la carpeta de storage.
  if (objectKey.includes("..")) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  try {
    const body = await getObject("public", objectKey);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
