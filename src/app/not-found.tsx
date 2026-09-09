import Link from "next/link";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      <section className="py-24 sm:py-32 max-w-xl">
        <p className="etiqueta text-accent mb-4">Error 404</p>
        <h1 className="titulo text-4xl sm:text-6xl text-balance">
          No encontramos esta página
        </h1>
        <p className="mt-6 text-lg text-muted">
          Puede que el partido ya no esté publicado o que el link esté incompleto. Si te lo
          pasaron por WhatsApp, fijate que no haya quedado cortado.
        </p>
        <Link
          href="/"
          className="etiqueta mt-8 inline-flex items-center gap-2 border border-line hover:border-accent rounded-full px-5 py-3 transition-colors"
        >
          Ver los partidos
        </Link>
      </section>
    </div>
  );
}
