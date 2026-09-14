import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  pin: z.string().min(1).max(20),
});

type Props = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Props) {
  const { slug } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "PIN inválido" }, { status: 400 });
  }

  const { pin } = parsed.data;

  const delivery = await db.clientDelivery.findUnique({
    where: { slug },
    select: { id: true, pin: true },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  }

  if (!delivery.pin || delivery.pin.trim() === pin.trim()) {
    // PIN correcto: establecemos la cookie de autorización
    const cookieStore = await cookies();
    cookieStore.set(`pin_${delivery.id}`, "authorized", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 días
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "PIN incorrecto. Revisá el código del equipo." }, { status: 401 });
}
