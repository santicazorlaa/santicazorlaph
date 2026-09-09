import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClearCartOnPaid } from "@/components/clear-cart";
import { DownloadButton } from "@/components/download-button";
import { db } from "@/lib/db";
import { precio } from "@/lib/format";
import { OrderStatus, reconcilePendingOrder } from "@/lib/orders";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu compra", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

export default async function CompraPage({ params }: Props) {
  const { token } = await params;

  const pendiente = await db.order.findUnique({
    where: { token },
    select: { id: true, status: true },
  });

  // Si el aviso de MercadoPago se perdió, le preguntamos nosotros antes de
  // mostrarle al comprador que su pago sigue pendiente.
  if (pendiente && pendiente.status === OrderStatus.PENDING) {
    await reconcilePendingOrder(pendiente.id).catch(() => null);
  }

  const order = await db.order.findUnique({
    where: { token },
    include: {
      items: {
        include: {
          photo: {
            select: {
              id: true,
              code: true,
              thumbKey: true,
              event: { select: { title: true } },
            },
          },
        },
      },
    },
  });

  if (!order) notFound();

  const pagada = order.status === OrderStatus.PAID;

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      {pagada && <ClearCartOnPaid />}

      <p className="etiqueta text-accent mb-4">
        {pagada ? "Pago acreditado" : "Pago pendiente"}
      </p>
      <h1 className="titulo text-4xl sm:text-5xl mb-4">
        {pagada ? "Tus fotos están listas" : "Estamos esperando el pago"}
      </h1>

      {pagada ? (
        <p className="text-muted max-w-xl">
          Descargá cada foto en resolución completa y sin marca de agua. Guardá este link:
          podés volver cuando quieras y las fotos siguen acá.
        </p>
      ) : (
        <p className="text-muted max-w-xl">
          Si ya pagaste, puede tardar unos segundos en acreditarse. Actualizá esta página en
          un momento. Te mandamos este mismo link a{" "}
          <span className="text-ink">{order.email}</span>.
        </p>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-sm text-muted tabular-nums border-y border-line py-4">
        <span>
          {order.items.length} {order.items.length === 1 ? "foto" : "fotos"}
        </span>
        <span className="cifra">{precio(order.totalArs)}</span>
      </div>

      <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 mt-8">
        {order.items.map((item) => (
          <li key={item.id}>
            <div className="aspect-[3/2] bg-surface rounded-md overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrl(item.photo.thumbKey)}
                alt={`Foto ${item.photo.code}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="etiqueta text-[0.65rem] text-muted">#{item.photo.code}</span>
              {pagada && <DownloadButton token={order.token} photoId={item.photo.id} />}
            </div>
          </li>
        ))}
      </ul>

      {!pagada && (
        <div className="mt-10">
          <Link
            href="/carrito"
            className="etiqueta border border-line rounded-full px-6 py-3 hover:border-accent transition-colors inline-block"
          >
            Volver al carrito
          </Link>
        </div>
      )}
    </div>
  );
}
