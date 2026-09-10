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
import { fechaBreve, horaDe, plural, precio, slugify } from "@/lib/format";
import { SLOTS } from "@/lib/marca-slots";
import { enviarMailDeCompra } from "@/lib/email";
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
  if (!orderId) redirect("/admin");
  if (!email || !email.includes("@")) redirect("/admin?mail=mail-invalido");

  await db.order.update({ where: { id: orderId }, data: { email } });

  const resultado = await enviarMailDeCompra(orderId);
  revalidatePath("/admin");
  redirect(`/admin?mail=${resultado.ok ? "reenviado" : "reenvio-error"}`);
}

type Props = {
  searchParams: Promise<{
    marca?: string;
    detalle?: string;
    descuentos?: string;
    borrado?: string;
    mail?: string;
  }>;
};

export default async function AdminPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { marca, detalle, descuentos, borrado, mail } = await searchParams;
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

  const inicioDelMes = new Date();
  inicioDelMes.setDate(1);
  inicioDelMes.setHours(0, 0, 0, 0);

  const [eventos, fotosVendidas, ventas, ventasDelMes, ultimasOrdenes] = await Promise.all([
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
        status: true,
        totalArs: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
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
    const category = String(formData.get("category") ?? "").trim();
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
        category: category || null,
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
          <span className="text-line"> · </span>
          este mes: {plural(ventasDelMes._count, "venta", "ventas")} ·{" "}
          {precio(ventasDelMes._sum.totalArs ?? 0)}
        </p>
      </div>

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
            <label htmlFor="category" className="etiqueta text-muted block mb-1.5">
              Deporte
            </label>
            <input
              id="category"
              name="category"
              list="deportes"
              placeholder="Fútbol"
              className="w-full bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none"
            />
            <datalist id="deportes">
              <option value="Fútbol" />
              <option value="Básquet" />
              <option value="Vóley" />
              <option value="Rugby" />
              <option value="Hockey" />
              <option value="Maratón" />
            </datalist>
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
                {evento.category && (
                  <span className="etiqueta text-[0.65rem] text-muted">{evento.category}</span>
                )}
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

      <div className="mt-16 pt-10 border-t border-line">
        <h2 className="titulo text-2xl mb-1">Ventas recientes</h2>
        <p className="text-sm text-muted mb-6 max-w-prose">
          Las últimas 20 órdenes. Si un comprador dice que no le llegó el mail o
          escribió mal el correo, reenviaselo desde acá.
        </p>

        {mail && (
          <p className={`text-sm mb-4 ${mail === "reenviado" ? "text-good" : "text-danger"}`}>
            {AVISOS_MAIL[mail] ?? null}
          </p>
        )}

        {ultimasOrdenes.length === 0 ? (
          <p className="text-muted border border-dashed border-line rounded-lg py-8 text-center mb-4">
            Todavía no hay ventas.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line mb-4">
            {ultimasOrdenes.map((orden) => {
              const formId = `reenviar-${orden.id}`;
              const puedeReenviar = orden.status === OrderStatus.PAID;
              return (
                <li key={orden.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 py-3">
                  {/* El formulario no envuelve el mail ni el botón porque no son
                      vecinos en este layout de fila; el atributo `form` en los dos
                      los conecta igual con este <form>, que va vacío. */}
                  {puedeReenviar && (
                    <form id={formId} action={reenviarMail}>
                      <input type="hidden" name="orderId" value={orden.id} />
                    </form>
                  )}
                  {puedeReenviar ? (
                    <input
                      type="email"
                      name="email"
                      form={formId}
                      defaultValue={orden.email}
                      className="text-sm flex-1 min-w-40 bg-transparent border border-transparent hover:border-line focus:border-accent rounded px-1.5 py-0.5 -mx-1.5 outline-none transition-colors"
                    />
                  ) : (
                    <span className="text-sm flex-1 min-w-40 truncate px-1.5">{orden.email}</span>
                  )}
                  <span className="text-sm text-muted tabular-nums">
                    {fechaBreve(orden.createdAt)} {horaDe(orden.createdAt)}
                  </span>
                  <span className="text-sm text-muted tabular-nums w-20 text-right">
                    {plural(orden._count.items, "foto", "fotos")}
                  </span>
                  <span className="text-sm tabular-nums w-24 text-right">
                    {precio(orden.totalArs)}
                  </span>
                  <span
                    className={`etiqueta text-[0.65rem] w-20 text-right ${
                      orden.status === OrderStatus.PAID ? "text-good" : "text-muted"
                    }`}
                  >
                    {orden.status === OrderStatus.PAID ? "Pagada" : "Pendiente"}
                  </span>
                  <span className="w-28 text-right">
                    {puedeReenviar && (
                      <button
                        type="submit"
                        form={formId}
                        className="etiqueta text-[0.65rem] text-muted hover:text-accent transition-colors"
                      >
                        Reenviar mail
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Abajo del todo porque son de las que se tocan una vez y no se miran
          más. Arriba estorbaban lo de todos los días, que es cargar un partido
          y ver cómo va. */}
      <div className="mt-16 pt-10 border-t border-line">
        <h2 className="titulo text-2xl mb-1">Ajustes del sitio</h2>
        <p className="text-sm text-muted mb-6 max-w-prose">
          Valen para todos los partidos. Se cambian de vez en cuando y se aplican a
          partir de ese momento.
        </p>

      <MarcaDeAgua estados={estadosMarca} aviso={aviso} ajustes={ajustesDeFoto} />

      <DescuentosPanel
        escalones={escalones}
        precioReferencia={precioReferencia}
        aviso={descuentos ? (AVISOS_DESCUENTOS[descuentos] ?? null) : null}
      />
      </div>
    </div>
  );
}
