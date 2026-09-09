import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BorrarPartido } from "@/components/borrar-partido";
import { DescuentosPanel } from "@/components/descuentos-panel";
import { MarcaDeAgua } from "@/components/marca-de-agua";
import { leerAjustesDeFoto, leerEscalones } from "@/lib/ajustes";
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
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

/**
 * Borra un partido: sus fotos, sus archivos y el partido.
 *
 * Se niega si alguna foto está en una compra. No es una comodidad: alguien la
 * pagó y su link de descarga tiene que seguir andando. La base lo impide igual
 * —el renglón de la orden apunta a la foto—, pero un error de base es un
 * callejón sin salida para quien está mirando el panel, así que se chequea acá
 * y se explica.
 */
async function borrarPartido(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("eventId") ?? "");
  if (!id) redirect("/admin");

  const evento = await db.event.findUnique({
    where: { id },
    select: {
      coverKey: true,
      photos: {
        select: {
          originalKey: true,
          previewKey: true,
          thumbKey: true,
          _count: { select: { orderItems: true } },
        },
      },
    },
  });
  if (!evento) redirect("/admin?borrado=inexistente");

  const vendidas = evento.photos.filter((f) => f._count.orderItems > 0).length;
  if (vendidas > 0) redirect("/admin?borrado=vendidas");

  // Primero la base, que es la decisión, y después los archivos. Al revés, si
  // la base fallara, quedaría un partido con las fotos rotas. En este orden lo
  // peor que puede pasar es que sobren archivos en el bucket, que no molestan.
  await db.event.delete({ where: { id } });

  for (const foto of evento.photos) {
    await deleteObject("private", foto.originalKey).catch(() => {});
    await deleteObject("public", foto.previewKey).catch(() => {});
    await deleteObject("public", foto.thumbKey).catch(() => {});
  }
  if (evento.coverKey?.startsWith("portada/")) {
    await deleteObject("public", evento.coverKey).catch(() => {});
  }

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin?borrado=listo");
}

const AVISOS_BORRADO: Record<string, string> = {
  listo: "Listo: el partido y sus fotos se borraron.",
  vendidas:
    "Ese partido tiene fotos vendidas, así que no se puede borrar: el link de descarga de quien las compró tiene que seguir funcionando. Se puede despublicar.",
  inexistente: "Ese partido ya no existe.",
};

const AVISOS_DESCUENTOS: Record<string, string> = {
  guardados: "Listo: los descuentos nuevos rigen desde ahora, para toda compra.",
  vacio: "No quedó ningún escalón válido, así que no se guardó nada.",
};

type Props = {
  searchParams: Promise<{
    marca?: string;
    detalle?: string;
    descuentos?: string;
    borrado?: string;
  }>;
};

export default async function AdminPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { marca, detalle, descuentos, borrado } = await searchParams;
  const aviso = marca === "error" ? (detalle ?? "No pudimos guardar el archivo") : marca ? (AVISOS[marca] ?? null) : null;

  const ajustesDeFoto = await leerAjustesDeFoto();
  const escalones = await leerEscalones();

  // El ejemplo de precios usa un partido real; si todavía no hay ninguno, el
  // valor con el que se crean.
  const precioReferencia =
    (await db.event.findFirst({ orderBy: { date: "desc" }, select: { priceArs: true } }))
      ?.priceArs ?? 2500;
  const marcasPropias = await db.watermark.findMany();
  const estadosMarca = SLOTS.map((slot) => {
    const fila = marcasPropias.find((m) => m.slot === slot);
    return { slot, propia: Boolean(fila), filename: fila?.filename ?? null };
  });

  const [eventos, fotosVendidas, ventas] = await Promise.all([
    db.event.findMany({
      orderBy: { date: "desc" },
      include: { _count: { select: { photos: true } } },
    }),
    // Las fotos que están en alguna compra, para no ofrecer borrar lo que no
    // se puede. Son pocas y se cuentan acá en vez de una consulta por partido.
    db.photo.findMany({
      where: { orderItems: { some: {} } },
      select: { eventId: true },
    }),
    db.order.aggregate({
      where: { status: OrderStatus.PAID },
      _sum: { totalArs: true },
      _count: true,
    }),
  ]);

  const vendidasPorPartido = new Map<string, number>();
  for (const foto of fotosVendidas) {
    vendidasPorPartido.set(foto.eventId, (vendidasPorPartido.get(foto.eventId) ?? 0) + 1);
  }

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

      <DescuentosPanel
        escalones={escalones}
        precioReferencia={precioReferencia}
        aviso={descuentos ? (AVISOS_DESCUENTOS[descuentos] ?? null) : null}
      />

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

      {borrado && (
        <p
          className={`text-sm mb-4 ${borrado === "listo" ? "text-good" : "text-danger"}`}
        >
          {AVISOS_BORRADO[borrado] ?? null}
        </p>
      )}

      {eventos.length === 0 ? (
        <p className="text-muted border border-dashed border-line rounded-lg py-12 text-center">
          Todavía no cargaste ningún partido.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {eventos.map((evento) => (
            <li key={evento.id} className="flex items-center gap-4 py-4">
              <Link
                href={`/admin/evento/${evento.id}`}
                className="flex flex-wrap items-baseline gap-x-5 gap-y-1 flex-1 min-w-0 hover:text-accent transition-colors"
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
              <div className="shrink-0 w-32 text-right">
                <BorrarPartido
                  eventId={evento.id}
                  titulo={evento.title}
                  cantidadFotos={evento._count.photos}
                  vendidas={vendidasPorPartido.get(evento.id) ?? 0}
                  action={borrarPartido}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
