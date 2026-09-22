import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SenalDeLink } from "@/components/senal-link";
import { EVENTOS, nombreDeVisitante, type TipoDeEvento } from "@/lib/actividad-entrega";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fechaBreve, horaDe } from "@/lib/format";
import { driveThumbUrl } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Actividad de la entrega", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

/// Cuántos renglones de "lo último que pasó" se muestran. Suficiente para
/// entender una tarde sin convertir la pantalla en un listado interminable.
const ULTIMOS = 60;

/// Cuántas fotos entran en el podio.
const PODIO = 12;

/// Sólo la palabra, sin el número adelante: `plural()` de `format.ts` devuelve
/// "3 descargas", y acá el número ya está escrito aparte y en grande.
const palabra = (n: number, singular: string, plural: string) =>
  n === 1 ? singular : plural;

function Numero({
  valor,
  etiqueta,
  detalle,
}: {
  valor: number;
  etiqueta: string;
  detalle?: string;
}) {
  return (
    <div className="border border-line rounded-lg bg-surface/40 p-4">
      <p className="cifra text-3xl leading-none tabular-nums">{valor}</p>
      <p className="etiqueta text-[0.6rem] text-muted mt-2">{etiqueta}</p>
      {detalle && <p className="text-[0.7rem] text-muted mt-1 leading-snug">{detalle}</p>}
    </div>
  );
}

export default async function ActividadDeEntregaPage({ params }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { id } = await params;

  const entrega = await db.clientDelivery.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      clientName: true,
      _count: { select: { photos: true, eventos: true } },
    },
  });
  if (!entrega) notFound();

  // Las cuentas se hacen en la base y no trayendo todo para contar acá: una
  // entrega con doscientas fotos y veinte personas junta miles de renglones, y
  // eso no se trae a la memoria para sumar cinco números.
  const [porTipo, porVisitante, porFotoYTipo, ultimos] = await Promise.all([
    db.deliveryEvent.groupBy({
      by: ["tipo"],
      where: { deliveryId: entrega.id },
      _count: { _all: true },
    }),
    db.deliveryEvent.groupBy({
      by: ["visitante"],
      where: { deliveryId: entrega.id },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    // Se agrupa por el código de la foto y **no por su identificador**, y es
    // la diferencia entre que esta lista sirva o no: sincronizar con Drive
    // borra las fotos y las vuelve a crear con identificadores nuevos, así que
    // agrupando por identificador el podio se vaciaba solo cada vez que Santi
    // sube fotos nuevas —el botón que más usa de esa pantalla—. El código viene
    // del nombre del archivo y no cambia nunca.
    db.deliveryEvent.groupBy({
      by: ["codigo", "tipo"],
      where: { deliveryId: entrega.id, codigo: { not: null } },
      _count: { _all: true },
    }),
    db.deliveryEvent.findMany({
      where: { deliveryId: entrega.id },
      orderBy: { createdAt: "desc" },
      take: ULTIMOS,
      select: { id: true, tipo: true, codigo: true, visitante: true, createdAt: true },
    }),
  ]);

  const cuenta = (tipo: TipoDeEvento) =>
    porTipo.find((f) => f.tipo === tipo)?._count._all ?? 0;

  const personas = porVisitante.length;
  const ultimaVez = porVisitante.reduce<Date | null>((mayor, v) => {
    const cuando = v._max.createdAt;
    if (!cuando) return mayor;
    return !mayor || cuando > mayor ? cuando : mayor;
  }, null);

  // Junta, para cada foto, cuántas veces se la miró y cuántas se la bajó.
  const porFoto = new Map<string, { vio: number; redes: number; original: number }>();
  for (const fila of porFotoYTipo) {
    if (!fila.codigo) continue;
    const actual = porFoto.get(fila.codigo) ?? { vio: 0, redes: 0, original: 0 };
    if (fila.tipo === "vio") actual.vio += fila._count._all;
    if (fila.tipo === "redes") actual.redes += fila._count._all;
    if (fila.tipo === "original") actual.original += fila._count._all;
    porFoto.set(fila.codigo, actual);
  }

  const podio = [...porFoto.entries()]
    .map(([codigo, n]) => ({ codigo, ...n, descargas: n.redes + n.original }))
    .sort((a, b) => b.descargas - a.descargas || b.vio - a.vio)
    .slice(0, PODIO);

  // La miniatura se busca por código dentro de esta entrega. Si esa foto ya no
  // está en Drive, el renglón sale sin imagen pero con su número: que se haya
  // ido del lote no borra que la bajaron.
  const fotosDelPodio = podio.length
    ? await db.deliveryPhoto.findMany({
        where: { deliveryId: entrega.id, code: { in: podio.map((p) => p.codigo) } },
        select: { code: true, driveFileId: true },
      })
    : [];
  const fotoPorId = new Map(fotosDelPodio.map((f) => [f.code, f]));

  const visitantes = [...porVisitante].sort(
    (a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0),
  );

  const hayAlgo = entrega._count.eventos > 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <nav className="etiqueta text-muted flex items-center gap-2 mb-6 flex-wrap">
        <Link href="/admin" className="con-mouse:hover:text-ink transition-colors">
          Panel
          <SenalDeLink />
        </Link>
        <span className="opacity-40">/</span>
        <Link href="/admin/entregas" className="con-mouse:hover:text-ink transition-colors">
          Entregas
          <SenalDeLink />
        </Link>
        <span className="opacity-40">/</span>
        <Link
          href={`/admin/entregas/${entrega.id}`}
          className="con-mouse:hover:text-ink transition-colors"
        >
          {entrega.title}
          <SenalDeLink />
        </Link>
        <span className="opacity-40">/</span>
        <span className="text-ink">Actividad</span>
      </nav>

      <header className="mb-8">
        <p className="etiqueta text-accent">{entrega.clientName}</p>
        <h1 className="titulo text-3xl sm:text-4xl mt-2">Actividad de la entrega</h1>
        <p className="text-sm text-muted mt-3 max-w-2xl leading-relaxed">
          Qué pasó adentro de <span className="text-ink">{entrega.title}</span>. No se
          guarda quién es nadie: cada persona figura con un número al azar que vive en
          su navegador, sin nombre y sin mail. La dirección de internet se usa un rato
          nada más para frenar abusos, como en el resto del sitio, y no queda pegada a
          lo que hizo cada uno.
        </p>
      </header>

      {!hayAlgo ? (
        <div className="border border-dashed border-line rounded-lg py-16 text-center">
          <p className="text-sm font-medium">Todavía no entró nadie.</p>
          <p className="text-xs text-muted mt-2 max-w-md mx-auto leading-relaxed">
            Acá va a aparecer quién entró, qué fotos miró y qué se descargó, apenas
            alguien abra el link de la entrega.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Numero
              valor={personas}
              etiqueta={palabra(personas, "Persona", "Personas")}
              detalle="Navegadores distintos que abrieron la galería"
            />
            <Numero valor={cuenta("acceso")} etiqueta="Visitas" detalle="Veces que se abrió" />
            <Numero
              valor={cuenta("original")}
              etiqueta="Máxima calidad"
              detalle="Descargas del archivo original"
            />
            <Numero
              valor={cuenta("redes")}
              etiqueta="Para redes"
              detalle="Descargas de la versión liviana"
            />
            <Numero
              valor={cuenta("drive")}
              etiqueta="Fueron a Drive"
              detalle="Apretaron el botón de la carpeta"
            />
          </section>

          {ultimaVez && (
            <p className="text-xs text-muted mt-4 tabular-nums">
              Lo último fue el {fechaBreve(ultimaVez)} a las {horaDe(ultimaVez)}.
            </p>
          )}

          {/* Lo que Drive no nos cuenta hay que decirlo acá y no dejar que el
              número de al lado se lea como otra cosa. */}
          <p className="text-[0.7rem] text-muted mt-2 max-w-2xl leading-relaxed border-l-2 border-line pl-3">
            Lo que pasa adentro de Google Drive no se puede ver: Drive no avisa quién
            abre la carpeta ni qué baja desde ahí. Por eso el último número dice
            &laquo;apretaron el botón&raquo; y no &laquo;entraron&raquo;. Las descargas
            hechas desde esta galería sí se cuentan una por una.
          </p>

          {podio.length > 0 && (
            <section className="mt-12">
              <h2 className="titulo text-xl">Las más pedidas</h2>
              <p className="text-xs text-muted mt-1">
                Ordenadas por cuántas veces se descargaron.
              </p>
              <ul className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {podio.map((fila) => {
                  const foto = fotoPorId.get(fila.codigo);
                  return (
                    <li
                      key={fila.codigo}
                      className="border border-line rounded-lg overflow-hidden bg-surface/40"
                    >
                      {foto && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={driveThumbUrl(foto.driveFileId, "thumb")}
                          alt={`Foto ${fila.codigo}`}
                          referrerPolicy="no-referrer"
                          className="w-full aspect-[3/2] object-cover"
                        />
                      )}
                      <div className="p-2.5">
                        <p className="etiqueta text-[0.6rem] text-muted">
                          #{fila.codigo}
                        </p>
                        <p className="cifra text-lg leading-none mt-1.5 tabular-nums">
                          {fila.descargas}
                        </p>
                        <p className="text-[0.65rem] text-muted mt-1 leading-snug">
                          {palabra(fila.descargas, "descarga", "descargas")}
                          {fila.vio > 0 && ` · la miraron ${fila.vio}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="mt-12 grid lg:grid-cols-2 gap-10">
            <section>
              <h2 className="titulo text-xl">Quiénes entraron</h2>
              <p className="text-xs text-muted mt-1">
                Una fila por persona. El código es sólo para distinguirlas entre sí.
              </p>
              <ul className="mt-5 divide-y divide-line border-y border-line">
                {visitantes.map((v) => (
                  <li
                    key={v.visitante}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <span className="etiqueta text-[0.65rem] rounded bg-surface border border-line px-2 py-1 text-muted tabular-nums shrink-0">
                      {nombreDeVisitante(v.visitante)}
                    </span>
                    <span className="text-xs text-muted tabular-nums text-right min-w-0">
                      {v._count._all} {palabra(v._count._all, "acción", "acciones")}
                      {v._max.createdAt && (
                        <span className="opacity-60">
                          {" · "}
                          {fechaBreve(v._max.createdAt)} {horaDe(v._max.createdAt)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="titulo text-xl">Lo último que pasó</h2>
              <p className="text-xs text-muted mt-1">
                Las {ULTIMOS} acciones más recientes, de la más nueva a la más vieja.
              </p>
              <ul className="mt-5 divide-y divide-line border-y border-line">
                {ultimos.map((e) => (
                  <li key={e.id} className="py-3 flex items-baseline gap-3">
                    <span className="etiqueta text-[0.6rem] text-muted tabular-nums shrink-0 w-12">
                      {nombreDeVisitante(e.visitante)}
                    </span>
                    <span className="text-xs min-w-0 flex-1">
                      {EVENTOS[e.tipo as TipoDeEvento] ?? e.tipo}
                      {e.codigo && <span className="text-muted"> · #{e.codigo}</span>}
                    </span>
                    <span className="text-[0.7rem] text-muted tabular-nums shrink-0">
                      {fechaBreve(e.createdAt)} {horaDe(e.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
