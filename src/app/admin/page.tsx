import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MarcaDeAgua } from "@/components/marca-de-agua";
import { leerAjustesDeFoto } from "@/lib/ajustes";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fechaBreve, plural, precio, slugify } from "@/lib/format";
import { SLOTS } from "@/lib/marca-slots";
import { OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Panel", robots: { index: false } };

const AVISOS: Record<string, string> = {
  guardada: "Listo: la marca nueva se aplica a las fotos que subas de ahora en adelante.",
  restaurada: "Volvimos a usar tu logo del proyecto.",
  "sin-archivo": "No elegiste ningún archivo.",
  "slot-invalido": "No reconocimos qué marca querías cambiar.",
  opacidad:
    "Listo: las fotos que subas de ahora en adelante salen con esos valores. Las que ya están online no cambian hasta que se rehagan.",
  "opacidad-invalida": "Alguno de esos valores no es un número válido.",
};

type Props = { searchParams: Promise<{ marca?: string; detalle?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { marca, detalle } = await searchParams;
  const aviso = marca === "error" ? (detalle ?? "No pudimos guardar el archivo") : marca ? (AVISOS[marca] ?? null) : null;

  const ajustesDeFoto = await leerAjustesDeFoto();
  const marcasPropias = await db.watermark.findMany();
  const estadosMarca = SLOTS.map((slot) => {
    const fila = marcasPropias.find((m) => m.slot === slot);
    return { slot, propia: Boolean(fila), filename: fila?.filename ?? null };
  });

  const [eventos, ventas] = await Promise.all([
    db.event.findMany({
      orderBy: { date: "desc" },
      include: { _count: { select: { photos: true } } },
    }),
    db.order.aggregate({
      where: { status: OrderStatus.PAID },
      _sum: { totalArs: true },
      _count: true,
    }),
  ]);

  async function crearEvento(formData: FormData) {
    "use server";
    if (!(await isAdmin())) redirect("/admin/login");

    const title = String(formData.get("title") ?? "").trim();
    const fechaTexto = String(formData.get("date") ?? "");
    const location = String(formData.get("location") ?? "").trim();
    const priceArs = Number(formData.get("priceArs") ?? 2500);

    if (!title || !fechaTexto) return;

    // Si ya existe un partido con ese nombre, le pegamos un sufijo al slug.
    const base = slugify(title);
    let slug = base;
    for (let i = 2; await db.event.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`;
    }

    const evento = await db.event.create({
      data: {
        title,
        slug,
        date: new Date(`${fechaTexto}T12:00:00`),
        location: location || null,
        priceArs: Number.isFinite(priceArs) && priceArs > 0 ? Math.round(priceArs) : 2500,
      },
    });

    redirect(`/admin/evento/${evento.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-10">
        <h1 className="titulo text-4xl">Panel</h1>
        <p className="text-sm text-muted tabular-nums">
          {plural(ventas._count, "venta", "ventas")} · {precio(ventas._sum.totalArs ?? 0)}
        </p>
      </div>

      <MarcaDeAgua estados={estadosMarca} aviso={aviso} ajustes={ajustesDeFoto} />

      <section className="border border-line rounded-lg p-5 mb-10">
        <h2 className="etiqueta text-muted mb-4">Nuevo partido</h2>
        <form action={crearEvento} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className="etiqueta text-muted block mb-1.5">
              Nombre
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="CAT vs Lastenia"
              className="w-full bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none"
            />
          </div>
          <div>
            <label htmlFor="date" className="etiqueta text-muted block mb-1.5">
              Fecha
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              className="w-full bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none"
            />
          </div>
          <div>
            <label htmlFor="location" className="etiqueta text-muted block mb-1.5">
              Lugar
            </label>
            <input
              id="location"
              name="location"
              placeholder="San Miguel de Tucumán"
              className="w-full bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none"
            />
          </div>
          <div>
            <label htmlFor="priceArs" className="etiqueta text-muted block mb-1.5">
              Precio por foto
            </label>
            <input
              id="priceArs"
              name="priceArs"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              defaultValue={2500}
              className="w-full bg-surface border border-line rounded-md px-3 py-2.5 tabular-nums focus:border-accent outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-accent-solid text-accent-ink etiqueta rounded-md py-2.5"
            >
              Crear partido
            </button>
          </div>
        </form>
      </section>

      <h2 className="etiqueta text-muted mb-4">
        {plural(eventos.length, "partido", "partidos")}
      </h2>

      {eventos.length === 0 ? (
        <p className="text-muted border border-dashed border-line rounded-lg py-12 text-center">
          Todavía no cargaste ningún partido.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {eventos.map((evento) => (
            <li key={evento.id}>
              <Link
                href={`/admin/evento/${evento.id}`}
                className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-4 hover:text-accent transition-colors"
              >
                <span className="titulo text-xl flex-1 min-w-50">{evento.title}</span>
                <span className="text-sm text-muted tabular-nums">
                  {fechaBreve(evento.date)}
                </span>
                <span className="text-sm text-muted tabular-nums w-20 text-right">
                  {plural(evento._count.photos, "foto", "fotos")}
                </span>
                <span
                  className={`etiqueta text-[0.65rem] w-24 text-right ${
                    evento.published ? "text-good" : "text-muted"
                  }`}
                >
                  {evento.published ? "Publicado" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
