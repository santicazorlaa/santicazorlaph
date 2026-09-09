import { NextResponse } from "next/server";

import { usingLocalStorage } from "@/lib/env";
import { getObject, verifyLocalDownloadSignature } from "@/lib/storage";

/**
 * Entrega el original firmado cuando trabajamos sin R2. En producción el link
 * apunta directo a R2 con una URL prefirmada y esta ruta no se usa.
 *
 * La firma la emite el servidor sólo para órdenes pagas y caduca a los pocos
 * minutos, así que el link no sirve para compartir.
 */
export async function GET(request: Request) {
  if (!usingLocalStorage()) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const expires = url.searchParams.get("expires");
  const sig = url.searchParams.get("sig");
  const filename = url.searchParams.get("filename") ?? "foto.jpg";

  if (!key || !expires || !sig) {
    return NextResponse.json({ error: "Link incompleto" }, { status: 400 });
  }

  if (!verifyLocalDownloadSignature(key, expires, sig)) {
    return NextResponse.json({ error: "El link venció" }, { status: 403 });
  }

  try {
    const body = await getObject("private", key);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
