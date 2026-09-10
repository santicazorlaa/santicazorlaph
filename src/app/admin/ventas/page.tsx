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

type Props = { searchParams: Promise<{ mail?: string }> };

export default async function VentasPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { mail } = await searchParams;

  const inicioDelMes = new Date();
  inicioDelMes.setDate(1);
  inicioDelMes.setHours(0, 0, 0, 0);

  const [ventas, ventasDelMes, ordenes] = await Promise.all([
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
    db.order.findMany({
      where: { status: { in: [OrderStatus.PAID, OrderStatus.PENDING] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
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
        Las últimas 20 órdenes. Tocá la flecha de cada una para ver qué fotos compró. Si un
        comprador dice que no le llegó el mail o escribió mal el correo, corregilo acá mismo y
        reenviaselo.
      </p>

      {mail && (
        <p className={`text-sm mb-4 ${mail === "reenviado" ? "text-good" : "text-danger"}`}>
          {AVISOS_MAIL[mail] ?? null}
        </p>
      )}

      {ordenes.length === 0 ? (
        <p className="text-muted border border-dashed border-line rounded-lg py-8 text-center">
          Todavía no hay ventas.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {ordenes.map((orden) => {
            const puedeReenviar = orden.status === OrderStatus.PAID;
            const formId = `reenviar-${orden.id}`;
            return (
              <div key={orden.id} className="contents">
                {/* El formulario va vacío y aparte: el mail y el botón no son
                    vecinos en esta fila, y el atributo `form` los conecta
                    igual. */}
                {puedeReenviar && (
                  <form id={formId} action={reenviarMail}>
                    <input type="hidden" name="orderId" value={orden.id} />
                  </form>
                )}
                <Venta
                  email={orden.email}
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
              </div>
            );
          })}
        </ul>
      )}
    </div>
  );
}
