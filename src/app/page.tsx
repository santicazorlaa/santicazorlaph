import { ListaPartidos, type PartidoEnLista } from "@/components/lista-partidos";
import { leerContenido, leerLineas, leerPasos, linkWhatsapp } from "@/lib/contenido";
import { db } from "@/lib/db";
import { fechaBreve, hace, plural, precio } from "@/lib/format";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [contenido, eventos, destacadas] = await Promise.all([
    leerContenido(),
    db.event.findMany({
      where: { published: true },
      orderBy: { date: "desc" },
      include: {
        _count: { select: { photos: true } },
        photos: {
          take: 1,
          orderBy: { takenAt: "asc" },
          select: { thumbKey: true },
        },
      },
    }),
    db.photo.findMany({
      where: { destacada: true, portfolioKey: { not: null } },
      orderBy: [{ ordenPortfolio: "asc" }, { createdAt: "desc" }],
      take: 24,
      select: { id: true, portfolioKey: true, event: { select: { title: true, category: true } } },
    }),
  ]);

  // Cuándo se cargó la última foto de cada partido, para el sello "actualizado
  // hace 2 días". Una sola consulta agrupada en vez de una por partido.
  const ultimasCargas = await db.photo.groupBy({
    by: ["eventId"],
    _max: { createdAt: true },
  });
  const ultimaCargaPorPartido = new Map(
    ultimasCargas.map((f) => [f.eventId, f._max.createdAt]),
  );

  const partidos: PartidoEnLista[] = eventos.map((evento) => {
    const ultima = ultimaCargaPorPartido.get(evento.id);
    return {
      id: evento.id,
      slug: evento.slug,
      title: evento.title,
      fecha: evento.date.toISOString(),
      fechaTexto: fechaBreve(evento.date),
      actualizado: ultima ? hace(ultima) : null,
      location: evento.location,
      category: evento.category,
      fotos: evento._count.photos,
      precioTexto: precio(evento.priceArs),
      portada: (evento.coverKey ?? evento.photos[0]?.thumbKey)
        ? publicUrl(evento.coverKey ?? evento.photos[0].thumbKey)
        : null,
    };
  });

  const pasos = leerPasos(contenido["pasos.items"]);
  const serviciosItems = leerLineas(contenido["servicios.items"]);
  const hayServicios = Boolean(
    contenido["servicios.titulo"].trim() || contenido["servicios.texto"].trim(),
  );
  const haySobre = Boolean(contenido["sobre.texto"].trim());
  const whatsapp = linkWhatsapp(contenido["contacto.whatsapp"], contenido["contacto.mensaje"]);

  // La foto grande del encabezado: la que Santi eligió, y si no eligió ninguna,
  // la portada del partido más nuevo. Nunca queda un encabezado vacío.
  const tapa = contenido["hero.fotoKey"] || eventos.find((e) => e.coverKey)?.coverKey || null;

  return (
    <div>
      <section className="relative border-b border-line overflow-hidden">
        {tapa && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={publicUrl(tapa)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              fetchPriority="high"
            />
            {/* El degradado no es decoración: sin él el titular blanco cae sobre
                una foto de contraste impredecible y deja de leerse. */}
            <div className="absolute inset-0 bg-gradient-to-t from-ground via-ground/85 to-ground/45" />
          </>
        )}

        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-36">
          <h1 className="titulo text-5xl sm:text-7xl max-w-3xl text-balance">
            {contenido["hero.titular"]}
          </h1>
          {contenido["hero.bajada"] && (
            <p className="mt-6 max-w-xl text-lg text-muted">{contenido["hero.bajada"]}</p>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#partidos"
              className="etiqueta bg-accent-solid text-accent-ink rounded-full px-6 py-3.5 hover:opacity-90 transition-opacity"
            >
              Buscar mi foto
            </a>
            {hayServicios && (
              <a
                href="#servicios"
                className="etiqueta border border-line rounded-full px-6 py-3.5 con-mouse:hover:border-accent transition-colors"
              >
                Contratar una cobertura
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5">
        <section id="partidos" className="py-16 scroll-mt-20">
          <h2 className="etiqueta text-muted mb-6">
            {eventos.length > 0
              ? plural(eventos.length, "partido publicado", "partidos publicados")
              : "Partidos"}
          </h2>

          {eventos.length === 0 ? (
            <p className="text-muted py-16 text-center border border-dashed border-line rounded-lg">
              Todavía no hay partidos publicados.
            </p>
          ) : (
            <ListaPartidos partidos={partidos} />
          )}
        </section>

        {pasos.length > 0 && (
          <section id="como-funciona" className="py-16 border-t border-line scroll-mt-20">
            <h2 className="titulo text-3xl sm:text-4xl mb-2">Cómo funciona</h2>
            <p className="text-muted mb-10 max-w-xl">
              Pagás sólo las fotos que elegís, y las tenés en el momento.
            </p>
            <ol className="grid gap-8 sm:grid-cols-3">
              {pasos.map((paso, i) => (
                <li key={i}>
                  <span className="cifra text-accent text-4xl">{i + 1}</span>
                  <h3 className="titulo text-xl mt-3">{paso.titulo}</h3>
                  {paso.detalle && <p className="mt-2 text-muted">{paso.detalle}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {haySobre && (
          <section id="quien-soy" className="py-16 border-t border-line scroll-mt-20">
            <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] items-start">
              {contenido["sobre.fotoKey"] && (
                <div className="aspect-[4/5] bg-surface rounded-lg overflow-hidden border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrl(contenido["sobre.fotoKey"])}
                    alt="Santi Cazorla"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className={contenido["sobre.fotoKey"] ? "" : "max-w-2xl"}>
                <h2 className="titulo text-3xl sm:text-4xl mb-6 text-balance">
                  {contenido["sobre.titulo"] || "Quién soy"}
                </h2>
                {contenido["sobre.texto"]
                  .split("\n")
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((parrafo, i) => (
                    <p key={i} className="text-lg text-muted mb-4 max-w-prose">
                      {parrafo}
                    </p>
                  ))}
              </div>
            </div>
          </section>
        )}

        {hayServicios && (
          <section id="servicios" className="py-16 border-t border-line scroll-mt-20">
            <div className="border border-line rounded-lg p-8 sm:p-12 bg-surface">
              <h2 className="titulo text-3xl sm:text-4xl mb-4 text-balance">
                {contenido["servicios.titulo"] || "¿Organizás un evento?"}
              </h2>
              {contenido["servicios.texto"]
                .split("\n")
                .map((p) => p.trim())
                .filter(Boolean)
                .map((parrafo, i) => (
                  <p key={i} className="text-lg text-muted mb-4 max-w-prose">
                    {parrafo}
                  </p>
                ))}

              {serviciosItems.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2 mt-8">
                  {serviciosItems.map((item, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="text-accent mt-0.5 shrink-0" aria-hidden>
                        —
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="etiqueta inline-block mt-10 bg-accent-solid text-accent-ink rounded-full px-6 py-3.5 hover:opacity-90 transition-opacity"
                >
                  Hablemos por WhatsApp
                </a>
              )}
            </div>
          </section>
        )}

        {destacadas.length > 0 && (
          <section id="portfolio" className="py-16 border-t border-line scroll-mt-20">
            <h2 className="titulo text-3xl sm:text-4xl mb-2">Lo mejor de mi trabajo</h2>
            <p className="text-muted mb-10 max-w-xl">
              Una selección chica, elegida a mano entre todo lo que cubrí.
            </p>
            <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {destacadas.map((foto) => (
                <li
                  key={foto.id}
                  className="aspect-[3/2] bg-surface rounded overflow-hidden border border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrl(foto.portfolioKey!)}
                    alt={foto.event.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {whatsapp && (
          <section className="py-20 border-t border-line text-center">
            <h2 className="titulo text-3xl sm:text-4xl text-balance max-w-2xl mx-auto">
              ¿Tenés un evento en puerta?
            </h2>
            <p className="text-muted mt-4 max-w-lg mx-auto">
              Escribime y lo charlamos. Contame qué es, cuándo y dónde.
            </p>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="etiqueta inline-block mt-8 bg-accent-solid text-accent-ink rounded-full px-8 py-4 hover:opacity-90 transition-opacity"
            >
              Hablemos por WhatsApp
            </a>
          </section>
        )}
      </div>
    </div>
  );
}
