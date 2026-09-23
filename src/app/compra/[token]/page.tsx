import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AvisoTransferencia } from "@/components/aviso-transferencia";
import { ClearCartOnPaid } from "@/components/clear-cart";
import { SenalDeLink } from "@/components/senal-link";
import { DownloadButton } from "@/components/download-button";
import { leerContenido, linkWhatsapp } from "@/lib/contenido";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { precio } from "@/lib/format";
import { MetodoPago, OrderStatus, reconcilePendingOrder } from "@/lib/orders";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
/// La dirección de esta pantalla es la llave de la compra: quien la tiene,
/// descarga las fotos. Con `no-referrer` el navegador no se la cuenta a ningún
/// otro sitio al que se salte desde acá.
export const metadata: Metadata = {
  title: "Tu compra",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default async function CompraPage({ params }: Props) {
  const { token } = await params;

  const pendiente = await db.order.findUnique({
    where: { token },
    select: { id: true, status: true, metodoPago: true },
  });

  // Si el aviso de MercadoPago se perdió, le preguntamos nosotros antes de
  // mostrarle al comprador que su pago sigue pendiente. Una orden por
  // transferencia no tiene ningún pago de MercadoPago que buscar.
  if (
    pendiente &&
    pendiente.status === OrderStatus.PENDING &&
    pendiente.metodoPago === MetodoPago.MERCADOPAGO
  ) {
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
  const esTransferencia = order.metodoPago === MetodoPago.TRANSFERENCIA;
  const c = !pagada && esTransferencia ? await leerContenido() : null;

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
      ) : esTransferencia && c ? (
        <div className="space-y-4 max-w-xl">
          <p className="text-muted">
            Transferí <span className="text-ink font-medium">{precio(order.totalArs)}</span> a
            estos datos y avisale a Santi por WhatsApp para que te confirme el pago. Te mandamos
            este mismo link a <span className="text-ink">{order.email}</span>.
          </p>
          <dl className="border border-line rounded-lg p-4 bg-surface max-w-md space-y-2 text-sm">
            {c["transferencia.banco"] && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Banco</dt>
                <dd className="text-ink text-right">{c["transferencia.banco"]}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Titular</dt>
              <dd className="text-ink text-right">{c["transferencia.titular"]}</dd>
            </div>
            {c["transferencia.cuitDni"] && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">CUIT/DNI</dt>
                <dd className="text-ink text-right">{c["transferencia.cuitDni"]}</dd>
              </div>
            )}
            {c["transferencia.alias"] && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Alias</dt>
                <dd className="text-ink font-mono text-right">{c["transferencia.alias"]}</dd>
              </div>
            )}
            {c["transferencia.cbu"] && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">CBU/CVU</dt>
                <dd className="text-ink font-mono text-right">{c["transferencia.cbu"]}</dd>
              </div>
            )}
          </dl>
          <AvisoTransferencia
            token={order.token}
            whatsappHref={linkWhatsapp(
              c["contacto.whatsapp"],
              `Hola Santi, ya transferí ${precio(order.totalArs)} por mis fotos. Mi pedido: ${siteUrl}/compra/${order.token}`,
            )}
            yaAviso={Boolean(order.avisoTransferenciaEn)}
          />
        </div>
      ) : (
        <div className="space-y-4 max-w-xl">
          <p className="text-muted">
            Si ya pagaste, puede tardar unos segundos en acreditarse. Actualizá esta página en
            un momento. Te mandamos este mismo link a{" "}
            <span className="text-ink">{order.email}</span>.
          </p>
          <div className="flex items-center gap-3 border border-line rounded-lg p-3.5 bg-surface max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mercadopago-blanco.svg"
              alt="Mercado Pago"
              className="h-5 w-auto opacity-75 shrink-0"
            />
            <p className="text-xs text-muted">
              Esperando confirmación segura de pago de Mercado Pago…
            </p>
          </div>
        </div>
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
            className="etiqueta border border-line rounded-full px-6 py-3 hover:border-accent transition-colors inline-flex items-center"
          >
            Volver al carrito
            <SenalDeLink />
          </Link>
        </div>
      )}
    </div>
  );
}
