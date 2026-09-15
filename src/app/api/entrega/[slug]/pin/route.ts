import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { cookieDeEntrega, paseDeEntrega, pinCorrecto } from "@/lib/auth";
import { db } from "@/lib/db";
import { ipDe, olvidarIntentos, superaLimite } from "@/lib/limite";

const schema = z.object({
  pin: z.string().min(1).max(20),
});

type Props = { params: Promise<{ slug: string }> };

const QUINCE_MINUTOS = 15 * 60;
const UNA_HORA = 60 * 60;

export async function POST(request: Request, { params }: Props) {
  const { slug } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "PIN inválido" }, { status: 400 });
  }

  const { pin } = parsed.data;

  const delivery = await db.clientDelivery.findUnique({
    where: { slug, published: true },
    select: { id: true, pin: true },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  }

  if (!delivery.pin) {
    return NextResponse.json({ success: true });
  }

  // Dos frenos: por persona, y por entrega en total. El segundo es el que
  // para a quien reparte los intentos entre muchas direcciones: un PIN de
  // cuatro números son 10.000 combinaciones, y a 60 por hora son semanas.
  const clavePersona = `pin:${delivery.id}:${ipDe(request)}`;
  if (
    (await superaLimite(clavePersona, 8, QUINCE_MINUTOS)) ||
    (await superaLimite(`pin:${delivery.id}`, 60, UNA_HORA))
  ) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." },
      { status: 429 },
    );
  }

  if (pinCorrecto(pin, delivery.pin)) {
    await olvidarIntentos(clavePersona);
    const cookieStore = await cookies();
    cookieStore.set(cookieDeEntrega(delivery.id), paseDeEntrega(delivery.id, delivery.pin), {
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
