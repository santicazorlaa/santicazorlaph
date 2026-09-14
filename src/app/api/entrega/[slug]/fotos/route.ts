import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { toDeliveryPhotoDTO } from "@/lib/deliveries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Props) {
  const { slug } = await params;
  const url = new URL(request.url);

  const desde = Math.max(0, parseInt(url.searchParams.get("desde") ?? "0", 10) || 0);
  const codigo = url.searchParams.get("codigo")?.trim().toUpperCase();

  const delivery = await db.clientDelivery.findUnique({
    where: { slug, published: true },
    select: { id: true, pin: true },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  }

  // Verificamos si tiene PIN y si está autorizado
  if (delivery.pin) {
    const cookieStore = await cookies();
    const authorized = cookieStore.get(`pin_${delivery.id}`);
    if (!authorized) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const whereClause: { deliveryId: string; code?: { contains: string } | string } = {
    deliveryId: delivery.id,
  };

  if (codigo) {
    whereClause.code = { contains: codigo };
  }

  const photos = await db.deliveryPhoto.findMany({
    where: whereClause,
    orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
    skip: codigo ? 0 : desde,
    take: 48,
  });

  return NextResponse.json({
    photos: photos.map(toDeliveryPhotoDTO),
  });
}
