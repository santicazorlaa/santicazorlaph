import { NextResponse } from "next/server";
import { z } from "zod";

import { ipDe, superaLimite } from "@/lib/limite";
import { createOrder, OrderError } from "@/lib/orders";

const schema = z.object({
  email: z.string().max(200).email("Necesitamos un email válido para mandarte las fotos"),
  // Opcional de verdad: las fotos llegan por mail igual. Sólo sirve para que
  // Santi sepa a quién etiquetar cuando publica.
  instagram: z.string().max(60).optional(),
  // Sólo mandamos los IDs. El precio y el total los calcula el servidor.
  // Con tope: sin él, un solo pedido con cien mil IDs obliga a la base a
  // buscarlos todos. Ningún partido real tiene tantas fotos.
  photoIds: z
    .array(z.string().min(1).max(64))
    .min(1, "El carrito está vacío")
    .max(500, "Son demasiadas fotos para una sola compra"),
});

export async function POST(request: Request) {
  // Cada orden crea un cobro en MercadoPago. Un programa que las crea en loop
  // llena el panel de pendientes falsas y puede hacer que MercadoPago nos
  // frene a nosotros. Veinte por hora sobra para cualquier comprador real.
  if (await superaLimite(`checkout:${ipDe(request)}`, 20, 60 * 60)) {
    return NextResponse.json(
      { error: "Hiciste muchos intentos de pago seguidos. Esperá un rato y probá de nuevo." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  try {
    const { token, checkoutUrl } = await createOrder(
      parsed.data.photoIds,
      parsed.data.email,
      parsed.data.instagram,
    );
    return NextResponse.json({ token, checkoutUrl });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("checkout falló", error);
    return NextResponse.json(
      { error: "No pudimos crear el pago. Probá de nuevo en un momento." },
      { status: 500 },
    );
  }
}
