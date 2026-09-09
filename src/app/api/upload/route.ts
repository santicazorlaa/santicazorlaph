import { NextResponse } from "next/server";

import { usingLocalStorage } from "@/lib/env";
import { putObject, verifyLocalUploadSignature } from "@/lib/storage";

/**
 * Recibe la subida directa cuando trabajamos sin R2. En producción el navegador
 * sube contra el bucket y esta ruta no se usa.
 */
export async function PUT(request: Request) {
  if (!usingLocalStorage()) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const expires = url.searchParams.get("expires");
  const sig = url.searchParams.get("sig");

  if (!key || !expires || !sig) {
    return NextResponse.json({ error: "Link incompleto" }, { status: 400 });
  }
  if (key.includes("..")) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }
  if (!verifyLocalUploadSignature(key, expires, sig)) {
    return NextResponse.json({ error: "El link venció" }, { status: 403 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  await putObject(
    "private",
    key,
    body,
    request.headers.get("content-type") ?? "image/jpeg",
  );

  return new NextResponse(null, { status: 200 });
}
