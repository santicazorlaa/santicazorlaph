import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Venta } from "@/components/venta";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { enviarMailDeCompra } from "@/lib/email";
import { fechaBreve, horaDe, plural, precio } from "@/lib/format";
import { OrderStatus } from "@/lib/orders";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ventas", robots: { index: false } };

const AVISOS_MAIL: Record<string, string> = {
  reenviado: "Listo: le volvimos a mandar el mail con sus fotos.",
  "reenvio-error": "No se pudo reenviar. Puede que falte configurar el correo.",
  "mail-invalido": "Ese mail no parece válido, así que no se guardó ni se mandó nada.",
  "orden-descartada": "Orden pendiente descartada correctamente.",
  "pendientes-limpias": "Se eliminaron las órdenes pendientes abandonadas.",
};

/**
 * Reenvía el mail de descarga a mano, para cuando el comprador dice que no le
 * llegó o escribió mal el email. Sólo tiene sentido en órdenes ya pagadas: una
 * pendiente todavía no tiene nada que entregar.
 *
 * El mail viene siempre del campo del formulario, que el panel precarga con el
 * de la venta: si no se tocó, reenvía al mismo; si se corrigió, guarda la
 * corrección primero y reenvía a la dirección nueva.
 */
async function reenviarMail(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const orderId = String(formData.get("orderId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  if (!orderId) redirect("/admin/ventas");
  if (!email || !email.includes("@")) redirect("/admin/ventas?mail=mail-invalido");

  await db.order.update({ where: { id: orderId }, data: { email } });

  const resultado = await enviarMailDeCompra(orderId);
  revalidatePath("/admin/ventas");
  redirect(`/admin/ventas?mail=${resultado.ok ? "reenviado" : "reenvio-error"}`);
}

async function descartarPendiente(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) redirect("/admin/ventas");

  // Sólo permitimos borrar si efectivamente está PENDING: una pagada nunca se borra.
  await db.order.deleteMany({
    where: { id: orderId, status: OrderStatus.PENDING },
  });

  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
  redirect("/admin/ventas?mail=orden-descartada&filtro=pendientes");
}

async function limpiarPendientesAntiguas() {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  // Carritos abandonados hace más de 24 horas:
  const hace24hs = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.order.deleteMany({
    where: { status: OrderStatus.PENDING, createdAt: { lt: hace24hs } },
  });

  revalidatePath("/admin/ventas");
  revalidatePath("/admin");
  redirect("/admin/ventas?mail=pendientes-limpias&filtro=pendientes");
}

type Props = { searchParams: Promise<{ mail?: string; filtro?: string }> };

export default async function VentasPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { mail, filtro: filtroParam } = await searchParams;
  const filtro = filtroParam === "pendientes" || filtroParam === "todas" ? filtroParam : "pagadas";

  const inicioDelMes = new Date();
  inicioDelMes.setDate(1);
  inicioDelMes.setHours(0, 0, 0, 0);

  const filtroEstado =
    filtro === "pagadas"
      ? { status: OrderStatus.PAID }
      : filtro === "pendientes"
        ? { status: OrderStatus.PENDING }
        : { status: { in: [OrderStatus.PAID, OrderStatus.PENDING] } };

  const [ventas, ventasDelMes, cantPagadas, cantPendientes, ordenes] = await Promise.all([
    db.order.aggregate({
      where: { status: OrderStatus.PAID },
      _sum: { totalArs: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { status: OrderStatus.PAID, paidAt: { gte: inicioDelMes } },
      _sum: { totalArs: true },
      _count: true,
    }),
    db.order.count({ where: { status: OrderStatus.PAID } }),
    db.order.count({ where: { status: OrderStatus.PENDING } }),
    db.order.findMany({
      where: filtroEstado,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        email: true,
        buyerName: true,
        instagram: true,
        status: true,
        totalArs: true,
        createdAt: true,
        items: {
          select: {
            priceArs: true,
            photo: {
              select: { id: true, code: true, thumbKey: true, event: { select: { title: true } } },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/admin"
        className="etiqueta text-muted hover:text-accent transition-colors inline-block mb-6"
      >
        ← Panel
      </Link>

      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-2">
        <h1 className="titulo text-4xl">Ventas</h1>
        <p className="text-sm text-muted tabular-nums">
          {plural(ventas._count, "venta", "ventas")} · {precio(ventas._sum.totalArs ?? 0)}
          <span className="text-line"> · </span>
          este mes: {plural(ventasDelMes._count, "venta", "ventas")} ·{" "}
          {precio(ventasDelMes._sum.totalArs ?? 0)}
        </p>
      </div>

      <p className="text-sm text-muted mb-6 max-w-prose">
        Tocá la flecha de cada orden para ver las fotos compradas. Si un comprador dice que no le llegó
        el mail o escribió mal el correo, corregilo acá mismo y reenviáselo.
      </p>

      {mail && (
        <p
          className={`text-sm mb-6 ${
            mail === "reenviado" || mail === "orden-descartada" || mail === "pendientes-limpias"
              ? "text-good"
              : "text-danger"
          }`}
        >
          {AVISOS_MAIL[mail] ?? null}
        </p>
      )}

      {/* Pestañas de filtrado para que los carritos pendientes no tapen las ventas reales */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/ventas?filtro=pagadas"
            className={`etiqueta text-xs rounded-full px-4 py-1.5 transition-colors ${
              filtro === "pagadas"
                ? "bg-accent-solid text-accent-ink font-medium"
                : "border border-line text-muted hover:border-accent hover:text-fg"
            }`}
          >
            Pagadas ({cantPagadas})
          </Link>
          <Link
            href="/admin/ventas?filtro=pendientes"
            className={`etiqueta text-xs rounded-full px-4 py-1.5 transition-colors ${
              filtro === "pendientes"
                ? "bg-accent-solid text-accent-ink font-medium"
                : "border border-line text-muted hover:border-accent hover:text-fg"
            }`}
          >
            Pendientes / Carritos ({cantPendientes})
          </Link>
          <Link
            href="/admin/ventas?filtro=todas"
            className={`etiqueta text-xs rounded-full px-4 py-1.5 transition-colors ${
              filtro === "todas"
                ? "bg-accent-solid text-accent-ink font-medium"
                : "border border-line text-muted hover:border-accent hover:text-fg"
            }`}
          >
            Todas ({cantPagadas + cantPendientes})
          </Link>
        </div>

        {cantPendientes > 0 && (
          <form action={limpiarPendientesAntiguas}>
            <button
              type="submit"
              className="etiqueta text-xs text-muted hover:text-danger transition-colors"
              title="Borra las órdenes pendientes con más de 24 horas que nunca se pagaron"
            >
              Limpiar abandonadas (+24hs)
            </button>
          </form>
        )}
      </div>

      {ordenes.length === 0 ? (
        <p className="text-muted border border-dashed border-line rounded-lg py-8 text-center">
          {filtro === "pendientes"
            ? "No hay órdenes pendientes en este momento."
            : filtro === "pagadas"
              ? "Todavía no hay ventas registradas."
              : "No hay órdenes registradas."}
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {ordenes.map((orden) => {
            const puedeReenviar = orden.status === OrderStatus.PAID;
            const esPendiente = orden.status === OrderStatus.PENDING;
            const formId = `reenviar-${orden.id}`;
            const discardFormId = `descartar-${orden.id}`;
            return (
              <div key={orden.id} className="contents">
                {puedeReenviar && (
                  <form id={formId} action={reenviarMail}>
                    <input type="hidden" name="orderId" value={orden.id} />
                  </form>
                )}
                {esPendiente && (
                  <form id={discardFormId} action={descartarPendiente}>
                    <input type="hidden" name="orderId" value={orden.id} />
                  </form>
                )}
                <div className="relative group/fila">
                  <Venta
                    email={orden.email}
                    buyerName={orden.buyerName}
                    instagram={orden.instagram}
                    fecha={`${fechaBreve(orden.createdAt)} ${horaDe(orden.createdAt)}`}
                    cantidad={plural(orden.items.length, "foto", "fotos")}
                    total={precio(orden.totalArs)}
                    pagada={puedeReenviar}
                    formId={puedeReenviar ? formId : null}
                    fotos={orden.items.map((item) => ({
                      id: item.photo.id,
                      code: item.photo.code,
                      thumbUrl: publicUrl(item.photo.thumbKey),
                      partido: item.photo.event.title,
                      precio: precio(item.priceArs),
                    }))}
                  />
                  {esPendiente && (
                    <div className="absolute right-0 top-3 flex items-center pr-2">
                      <button
                        type="submit"
                        form={discardFormId}
                        className="etiqueta text-[0.65rem] text-muted hover:text-danger transition-colors px-2 py-0.5"
                        title="Descartar carrito abandonado"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </ul>
      )}
    </div>
  );
}
