import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { OrderStatus } from "@/lib/orders";
import { signedDownloadUrl } from "@/lib/storage";

/**
 * Emite el link de descarga del original. Las dos condiciones que se verifican
 * acá son las que sostienen todo el negocio: que la orden esté pagada, y que la
 * foto pedida pertenezca a esa orden.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const photoId = new URL(request.url).searchParams.get("foto");

  if (!photoId) {
    return NextResponse.json({ error: "Falta la foto" }, { status: 400 });
  }

  const item = await db.orderItem.findFirst({
    where: {
      photoId,
      order: { token, status: OrderStatus.PAID },
    },
    select: {
      photo: { select: { originalKey: true, originalName: true, code: true } },
    },
  });

  if (!item) {
    return NextResponse.json(
      { error: "Esa foto no está en una compra pagada" },
      { status: 403 },
    );
  }

  const url = await signedDownloadUrl(
    item.photo.originalKey,
    item.photo.originalName || `${item.photo.code}.jpg`,
  );

  return NextResponse.json({ url });
}
