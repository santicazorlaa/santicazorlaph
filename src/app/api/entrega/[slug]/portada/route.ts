import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/**
 * Sirve la portada de una entrega desde nuestro propio dominio.
 *
 * Google bloquea a los robots de WhatsApp/Instagram cuando intentan bajar la
 * imagen directo de `lh3.googleusercontent.com` (es una protección de Google
 * contra el robo de fotos de Drive, no depende de nuestro código): la miniatura
 * se ve perfecto en cualquier navegador, pero esos robots reciben un rechazo y
 * la vista previa del link queda sin foto. Pasando la imagen por acá, el robot
 * la pide a nuestro dominio en vez de al de Google.
 */
export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;

  const entrega = await db.clientDelivery.findUnique({
    where: { slug, published: true },
    select: { coverUrl: true },
  });

  if (!entrega?.coverUrl) {
    return NextResponse.json({ error: "Sin portada" }, { status: 404 });
  }

  const respuesta = await fetch(entrega.coverUrl);
  if (!respuesta.ok || !respuesta.body) {
    return NextResponse.json({ error: "No se pudo bajar la portada" }, { status: 502 });
  }

  return new NextResponse(respuesta.body, {
    headers: {
      "Content-Type": respuesta.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=1800",
    },
  });
}
