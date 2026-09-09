import Link from "next/link";

import { db } from "@/lib/db";
import { fechaBreve, plural, precio } from "@/lib/format";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const eventos = await db.event.findMany({
    where: { published: true },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { photos: true } },
      photos: { take: 1, orderBy: { takenAt: "asc" }, select: { thumbKey: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-5">
      <section className="py-16 sm:py-24 border-b border-line">
        <h1 className="titulo text-5xl sm:text-7xl max-w-3xl text-balance">
          Encontrá las fotos de tu partido
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Entrá al partido que jugaste, elegí las fotos que te gusten y llevátelas en alta
          resolución, sin marca de agua. Se descargan al instante, apenas se acredita el pago.
        </p>
      </section>

      <section className="py-12">
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
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {eventos.map((evento) => {
              const portada = evento.coverKey ?? evento.photos[0]?.thumbKey;
              return (
                <li key={evento.id}>
                  <Link
                    href={`/e/${evento.slug}`}
                    className="group block border border-line rounded-lg overflow-hidden hover:border-accent transition-colors"
                  >
                    <div className="aspect-[3/2] bg-surface overflow-hidden">
                      {portada ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={publicUrl(portada)}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted text-sm">
                          Sin fotos
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="titulo text-xl group-hover:text-accent transition-colors text-balance">
                        {evento.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted tabular-nums">
                        {fechaBreve(evento.date)}
                        {evento.location ? ` · ${evento.location}` : ""}
                      </p>
                      <p className="mt-3 flex items-baseline justify-between text-sm">
                        <span className="text-muted tabular-nums">
                          {plural(evento._count.photos, "foto", "fotos")}
                        </span>
                        <span className="cifra">{precio(evento.priceArs)} c/u</span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
