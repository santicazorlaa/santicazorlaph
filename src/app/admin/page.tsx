import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fechaBreve, plural, precio } from "@/lib/format";
import { OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Panel", robots: { index: false } };

/**
 * El panel: un tablero con una tarjeta por cada cosa que se puede hacer.
 *
 * Antes era una sola página larguísima con todo encima —crear un partido, la
 * lista, las ventas, la marca de agua, los descuentos— y había que scrollear a
 * ciegas para llegar a cualquier cosa. Cada apartado vive ahora en su propia
 * pantalla y acá quedan las tarjetas, con el número que importa de cada una
 * para que el tablero sirva además de resumen: cuántos partidos hay, cuánto se
 * vendió este mes, si falta cargar contenido.
 */
export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const inicioDelMes = new Date();
  inicioDelMes.setDate(1);
  inicioDelMes.setHours(0, 0, 0, 0);

  const [partidos, publicados, fotos, ventasDelMes, pendientes, ultimoPartido, ultimaVenta] =
    await Promise.all([
      db.event.count(),
      db.event.count({ where: { published: true } }),
      db.photo.count(),
      db.order.aggregate({
        where: { status: OrderStatus.PAID, paidAt: { gte: inicioDelMes } },
        _sum: { totalArs: true },
        _count: true,
      }),
      db.order.count({ where: { status: OrderStatus.PENDING } }),
      db.event.findFirst({ orderBy: { date: "desc" }, select: { title: true, date: true } }),
      db.order.findFirst({
        where: { status: OrderStatus.PAID },
        orderBy: { paidAt: "desc" },
        select: { paidAt: true, totalArs: true },
      }),
    ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="titulo text-4xl mb-2">Panel</h1>
      <p className="text-sm text-muted mb-10">
        {ultimaVenta?.paidAt
          ? `Última venta: ${precio(ultimaVenta.totalArs)}, el ${fechaBreve(ultimaVenta.paidAt)}.`
          : "Todavía no entró ninguna venta."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Tarjeta
          href="/admin/partidos?nuevo=1"
          titulo="Cargar un partido"
          dato="Nuevo"
          detalle="Crear el partido y subirle las fotos."
          destacada
        />

        <Tarjeta
          href="/admin/partidos"
          titulo="Partidos"
          dato={String(partidos)}
          detalle={
            partidos === 0
              ? "Todavía no cargaste ninguno."
              : `${publicados} ${publicados === 1 ? "publicado" : "publicados"} · ${plural(fotos, "foto", "fotos")} en total${
                  ultimoPartido ? ` · último: ${ultimoPartido.title}` : ""
                }`
          }
        />

        <Tarjeta
          href="/admin/ventas"
          titulo="Ventas"
          dato={precio(ventasDelMes._sum.totalArs ?? 0)}
          detalle={`${plural(ventasDelMes._count, "venta", "ventas")} este mes${
            pendientes > 0
              ? ` · ${plural(pendientes, "pendiente", "pendientes")}, casi siempre un checkout abandonado`
              : ""
          }`}
        />

        <Tarjeta
          href="/admin/contenido"
          titulo="Contenido del sitio"
          dato="Textos y fotos"
          detalle="Tu historia, la tapa, el portfolio, el WhatsApp y los legales."
        />

        <Tarjeta
          href="/admin/ajustes"
          titulo="Ajustes"
          dato="Marca y precios"
          detalle="La marca de agua y los descuentos por cantidad."
        />
      </div>
    </div>
  );
}

/**
 * Una tarjeta del tablero. El movimiento al pasar el mouse es mínimo a
 * propósito —dos píxeles y un borde— porque es una pantalla que Santi va a ver
 * todos los días: lo que se ve mucho no se anima, se responde.
 */
function Tarjeta({
  href,
  titulo,
  dato,
  detalle,
  destacada = false,
}: {
  href: string;
  titulo: string;
  dato: string;
  detalle: string;
  destacada?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group border rounded-lg p-5 block transition-[border-color,transform] duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none ${
        destacada
          ? "border-accent/40 bg-accent/5 con-mouse:hover:border-accent"
          : "border-line con-mouse:hover:border-accent"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="etiqueta text-muted">{titulo}</h2>
        <span className="etiqueta text-[0.7rem] text-muted opacity-0 con-mouse:group-hover:opacity-100 transition-opacity duration-150 ease-out">
          Entrar →
        </span>
      </div>
      <p className="titulo text-2xl tabular-nums mb-1">{dato}</p>
      <p className="text-sm text-muted">{detalle}</p>
    </Link>
  );
}
