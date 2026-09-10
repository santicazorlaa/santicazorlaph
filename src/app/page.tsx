import Link from "next/link";

import { Aparecer } from "@/components/aparecer";
import { TextoEntrante } from "@/components/texto-entrante";
import { CintaPortfolio } from "@/components/cinta-portfolio";
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
    db.portfolioPhoto.findMany({
      orderBy: [{ orden: "asc" }, { createdAt: "desc" }],
      // La cinta carga sus fotos de entrada, así que el tope no es estético
      // sino de peso: en la portada va una muestra, y el portfolio completo
      // está a un clic.
      take: 16,
      select: { id: true, key: true, thumbKey: true, width: true, height: true, titulo: true },
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
  // El recorte alto, para el celular. Sólo existe si la tapa la eligió Santi:
  // la portada de un partido que entra de suplente viene con un solo recorte.
  const tapaCelular = contenido["hero.fotoKey"] ? contenido["hero.fotoKeyCelular"] : "";

  return (
    <div>
      <section
        className={`relative border-b border-line overflow-hidden flex items-end ${
          // La altura sale de la misma proporción con la que Santi encuadró la
          // foto en el panel (3/4 en el celular, 12/5 en la computadora), así
          // que lo que acomodó ahí es lo que se ve acá.
          //
          // Va como alto *mínimo* y no como proporción fija a propósito: con
          // una proporción fija, un titular largo no agrandaba la sección sino
          // que se salía por arriba y quedaba cortado abajo del logo. Que el
          // recorte muestre un poco más de foto no se nota; un título cortado,
          // sí.
          tapa ? "min-h-[133.33vw] md:min-h-[41.67vw]" : ""
        }`}
      >
        {tapa && (
          <>
            <picture>
              {tapaCelular && (
                <source media="(max-width: 767px)" srcSet={publicUrl(tapaCelular)} />
              )}
              <img
                src={publicUrl(tapa)}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                fetchPriority="high"
              />
            </picture>
            {/* El degradado no es decoración: sin él el titular blanco cae sobre
                una foto de contraste impredecible y deja de leerse. */}
            <div className="absolute inset-0 bg-gradient-to-t from-ground via-ground/85 to-ground/45" />
          </>
        )}

        <div className="relative w-full mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <TextoEntrante as="h1" className="titulo text-5xl sm:text-7xl max-w-3xl text-balance">
            {contenido["hero.titular"]}
          </TextoEntrante>
          {contenido["hero.bajada"] && (
            <p className="mt-6 max-w-xl text-lg text-muted">{contenido["hero.bajada"]}</p>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#partidos"
              className="etiqueta bg-accent-solid text-accent-ink rounded-full px-6 py-3.5 con-mouse:hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-150 ease-out"
            >
              Buscar mi foto
            </a>
            {hayServicios && (
              <a
                href="#servicios"
                className="etiqueta border border-line rounded-full px-6 py-3.5 con-mouse:hover:border-accent active:scale-[0.97] transition-[border-color,transform] duration-150 ease-out"
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
            <Aparecer>
              <TextoEntrante as="h2" className="titulo text-3xl sm:text-4xl mb-2">Cómo funciona</TextoEntrante>
              <p className="text-muted mb-10 max-w-xl">
                Pagás sólo las fotos que elegís, y las tenés en el momento.
              </p>
              <ol className="grid gap-8 sm:grid-cols-3">
                {pasos.map((paso, i) => (
                  <li key={i} className="flex flex-col justify-between">
                    <div>
                      <span className="cifra text-accent text-4xl">{i + 1}</span>
                      <h3 className="titulo text-xl mt-3">{paso.titulo}</h3>
                      {paso.detalle && <p className="mt-2 text-muted">{paso.detalle}</p>}
                    </div>
                    {i === 2 && (
                      <div className="mt-4 pt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/mercadopago-blanco.svg"
                          alt="Mercado Pago"
                          className="h-5 w-auto opacity-60"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </Aparecer>
          </section>
        )}

        {haySobre && (
          <section id="quien-soy" className="py-16 border-t border-line scroll-mt-20">
            <Aparecer>
              <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] items-start">
                {contenido["sobre.fotoKey"] && (
                  /* Sin proporción fija: la foto se muestra como es. Forzarla a
                     vertical recortaba de prepo una foto apaisada, y no hay forma
                     de saber de antemano cuál va a elegir Santi. */
                  <div className="bg-surface rounded-lg overflow-hidden border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={publicUrl(contenido["sobre.fotoKey"])}
                      alt="Santi Cazorla"
                      className="w-full h-auto"
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
            </Aparecer>
          </section>
        )}

        {hayServicios && (
          <section id="servicios" className="py-16 border-t border-line scroll-mt-20">
            <Aparecer>
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
            </Aparecer>
          </section>
        )}

        {destacadas.length > 0 && (
          <section id="portfolio" className="py-16 border-t border-line scroll-mt-20">
            <Aparecer>
              <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
                <div>
                  <TextoEntrante as="h2" className="titulo text-3xl sm:text-4xl mb-2">Lo mejor de mi trabajo</TextoEntrante>
                  <p className="text-muted max-w-xl">
                    Una selección chica, elegida a mano entre todo lo que cubrí.
                  </p>
                </div>
                <Link
                  href="/portfolio"
                  className="etiqueta border border-line rounded-full px-5 py-3 shrink-0 con-mouse:hover:border-accent active:scale-[0.97] transition-[border-color,transform] duration-150 ease-out"
                >
                  Ver todo →
                </Link>
              </div>
              <CintaPortfolio
                fotos={destacadas.map((foto) => ({
                  id: foto.id,
                  url: publicUrl(foto.thumbKey),
                  urlGrande: publicUrl(foto.key),
                  ancho: foto.width,
                  alto: foto.height,
                  titulo: foto.titulo ?? "",
                }))}
              />
            </Aparecer>
          </section>
        )}

        {whatsapp && (
          <section className="py-20 border-t border-line text-center">
            <TextoEntrante as="h2" className="titulo text-3xl sm:text-4xl text-balance max-w-2xl mx-auto">
              {contenido["contacto.titulo"] || "¿Tenés un evento en puerta?"}
            </TextoEntrante>
            {contenido["contacto.bajada"] && (
              <p className="text-muted mt-4 max-w-lg mx-auto">
                {contenido["contacto.bajada"]}
              </p>
            )}
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
