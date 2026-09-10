import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { leerContenido, type Clave } from "@/lib/contenido";

export const dynamic = "force-dynamic";

/// Las dos páginas legales que el sitio necesita para dar seriedad: qué se
/// vende y qué se hace con los datos del comprador. El texto lo escribe Santi
/// desde el panel; si está vacío, la página no existe en vez de mostrar un
/// documento en blanco, que es peor que no tenerlo.
const DOCUMENTOS: Record<string, { titulo: string; clave: Clave }> = {
  terminos: { titulo: "Términos y condiciones", clave: "legal.terminos" },
  privacidad: { titulo: "Política de privacidad", clave: "legal.privacidad" },
};

type Props = { params: Promise<{ documento: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { documento } = await params;
  const doc = DOCUMENTOS[documento];
  return { title: doc?.titulo ?? "Legales" };
}

export default async function LegalPage({ params }: Props) {
  const { documento } = await params;
  const doc = DOCUMENTOS[documento];
  if (!doc) notFound();

  const contenido = await leerContenido();
  const texto = contenido[doc.clave].trim();
  if (!texto) notFound();

  const parrafos = texto
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="titulo text-4xl mb-10">{doc.titulo}</h1>
      {parrafos.map((parrafo, i) =>
        // Una línea corta y sin punto final se lee como subtítulo, no como
        // párrafo: es la forma de darle estructura a un texto escrito en un
        // cuadro de texto común, sin pedirle a nadie que aprenda a marcarlo.
        parrafo.length < 60 && !parrafo.endsWith(".") ? (
          <h2 key={i} className="titulo text-xl mt-10 mb-3">
            {parrafo}
          </h2>
        ) : (
          <p key={i} className="text-muted mb-4 leading-relaxed">
            {parrafo}
          </p>
        ),
      )}
    </div>
  );
}
