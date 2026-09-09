import "server-only";

import { customAlphabet } from "nanoid";

import { leerEscalones } from "./ajustes";
import { db } from "./db";
import { calcular, repartir } from "./descuentos";
import { enviarMailDeCompra } from "./email";
import { mercadopago as mpEnv } from "./env";
import { createPreference, getPayment } from "./mercadopago";

export const OrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
} as const;

const newToken = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 24);

/// Código corto que el fotógrafo le canta a un jugador para que encuentre su
/// foto. Sin vocales ni caracteres que se confundan al dictarlo por teléfono.
const newPhotoCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export async function generatePhotoCode() {
  // Con 32^5 combinaciones el choque es rarísimo, pero igual reintentamos.
  for (let i = 0; i < 8; i++) {
    const code = newPhotoCode();
    const taken = await db.photo.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("No se pudo generar un código de foto único");
}

export class OrderError extends Error {}

/**
 * Crea la orden y el link de pago. El total sale SIEMPRE del precio guardado en
 * la base, nunca de lo que mande el navegador.
 */
export async function createOrder(photoIds: string[], email: string) {
  const unique = [...new Set(photoIds)];
  if (unique.length === 0) throw new OrderError("El carrito está vacío");
  if (unique.length > 200) throw new OrderError("Demasiadas fotos en una sola compra");

  const photos = await db.photo.findMany({
    where: { id: { in: unique }, event: { published: true } },
    select: {
      id: true,
      code: true,
      event: { select: { title: true, priceArs: true } },
    },
  });

  if (photos.length !== unique.length) {
    throw new OrderError("Algunas fotos ya no están disponibles");
  }

  // El descuento por cantidad se calcula acá, con los precios de la base. Lo
  // que el navegador haya mostrado no interviene.
  const subtotal = photos.reduce((sum, p) => sum + p.event.priceArs, 0);
  const { total: totalArs } = calcular(subtotal, photos.length, await leerEscalones());

  // A MercadoPago se le manda una línea por foto, así que el descuento hay que
  // repartirlo entre esas líneas: si no, cobraría el precio de lista.
  const precios = repartir(
    photos.map((p) => p.event.priceArs),
    totalArs,
  );

  const order = await db.order.create({
    data: {
      token: newToken(),
      email,
      totalArs,
      status: OrderStatus.PENDING,
      items: {
        create: photos.map((p, i) => ({ photoId: p.id, priceArs: precios[i] })),
      },
    },
  });

  // La orden ya existe, así que si MercadoPago no nos da el link hay que
  // borrarla: si no, queda una orden PENDING que nadie va a pagar nunca.
  let preferenceId: string;
  let checkoutUrl: string;
  try {
    ({ preferenceId, checkoutUrl } = await createPreference({
      orderId: order.id,
      orderToken: order.token,
      email,
      items: photos.map((p, i) => ({
        id: p.id,
        title: `Foto ${p.code} · ${p.event.title}`,
        quantity: 1,
        unitPrice: precios[i],
      })),
    }));
  } catch (error) {
    await db.order.delete({ where: { id: order.id } }).catch(() => {});
    throw error;
  }

  await db.order.update({
    where: { id: order.id },
    data: { mpPreferenceId: preferenceId },
  });

  return { token: order.token, checkoutUrl };
}

/**
 * Red de seguridad para cuando el aviso de MercadoPago no llega: una caída, un
 * despliegue a mitad de camino, una redirección. Le pregunta a MercadoPago si
 * esta orden tiene un pago aprobado y, si lo hay, la acredita.
 *
 * Se llama cuando el comprador mira su compra y todavía figura pendiente, que
 * es justo el momento en que le importa.
 */
export async function reconcilePendingOrder(orderId: string) {
  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}`,
    { headers: { Authorization: `Bearer ${mpEnv().accessToken}` }, cache: "no-store" },
  );
  if (!res.ok) return { ok: false, reason: `busqueda fallo (${res.status})` };

  const pagos = ((await res.json()).results ?? []) as { id: number; status: string }[];
  const aprobado = pagos.find((p) => p.status === "approved");
  if (!aprobado) return { ok: false, reason: "sin pago aprobado" };

  // Pasa por la misma verificación que el webhook: monto, estado y orden.
  return confirmPayment(String(aprobado.id));
}

/**
 * Única vía por la que una orden pasa a PAID. Le preguntamos a MercadoPago por
 * el pago; no confiamos en lo que diga quien llamó al webhook.
 */
export async function confirmPayment(paymentId: string) {
  const payment = await getPayment(paymentId);

  const orderId = payment.external_reference;
  if (!orderId) return { ok: false, reason: "sin external_reference" };

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "orden inexistente" };
  if (order.status === OrderStatus.PAID) return { ok: true, alreadyPaid: true };

  // El monto tiene que coincidir con lo que calculamos nosotros.
  const paid = Number(payment.transaction_amount ?? 0);
  if (payment.status === "approved" && paid < order.totalArs) {
    return { ok: false, reason: "monto menor al esperado" };
  }

  if (payment.status !== "approved") {
    if (payment.status === "rejected" || payment.status === "cancelled") {
      await db.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.FAILED, mpPaymentId: String(payment.id) },
      });
    }
    return { ok: false, reason: `pago ${payment.status}` };
  }

  // El estado va en el `where`: si dos avisos de MercadoPago llegan al mismo
  // tiempo, sólo uno hace la transición. Eso es lo que garantiza que el mail
  // salga una sola vez.
  const transicion = await db.order.updateMany({
    where: { id: order.id, status: OrderStatus.PENDING },
    data: {
      status: OrderStatus.PAID,
      paidAt: new Date(),
      mpPaymentId: String(payment.id),
    },
  });

  const reciénPagada = transicion.count === 1;
  if (reciénPagada) {
    // Nunca lanza: si el mail falla, la compra igual quedó acreditada.
    await enviarMailDeCompra(order.id);
  }

  return { ok: true, alreadyPaid: !reciénPagada };
}
