import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ipDe, superaLimite } from "@/lib/limite";
import { MetodoPago, OrderStatus } from "@/lib/orders";

type Props = { params: Promise<{ token: string }> };

/**
 * Registra que el comprador de una orden por transferencia tocó "Ya
 * transferí", para que el panel de ventas muestre que ya avisó. No requiere
 * sesión de admin: el token de la compra es la llave, igual que el resto del
 * flujo de `/compra/[token]`.
 *
 * Idempotente a propósito: sólo escribe la primera vez (`avisoTransferenciaEn`
 * en null), así que tocar el botón de nuevo no rompe nada y no hace falta
 * bloquearlo en el navegador.
 */
export async function POST(request: Request, { params }: Props) {
  const { token } = await params;

  if (await superaLimite(`aviso-transferencia:${ipDe(request)}`, 20, 60 * 60)) {
    return NextResponse.json({ error: "Esperá un rato y probá de nuevo." }, { status: 429 });
  }

  await db.order.updateMany({
    where: {
      token,
      metodoPago: MetodoPago.TRANSFERENCIA,
      status: OrderStatus.PENDING,
      avisoTransferenciaEn: null,
    },
    data: { avisoTransferenciaEn: new Date() },
  });

  return NextResponse.json({ ok: true });
}
