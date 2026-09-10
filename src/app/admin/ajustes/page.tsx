import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DescuentosPanel } from "@/components/descuentos-panel";
import { MarcaDeAgua } from "@/components/marca-de-agua";
import { leerAjustesDeFoto, leerEscalones } from "@/lib/ajustes";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { SLOTS } from "@/lib/marca-slots";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ajustes", robots: { index: false } };

const AVISOS: Record<string, string> = {
  guardada: "Listo: la marca nueva se aplica a las fotos que subas de ahora en adelante.",
  restaurada: "Volvimos a usar tu logo del proyecto.",
  "sin-archivo": "No elegiste ningún archivo.",
  "slot-invalido": "No reconocimos qué marca querías cambiar.",
  opacidad:
    "Listo: las fotos que subas de ahora en adelante salen con esos valores. Las que ya están online no cambian hasta que se rehagan.",
  "opacidad-invalida": "Alguno de esos valores no es un número válido.",
};

const AVISOS_DESCUENTOS: Record<string, string> = {
  guardados: "Listo: los descuentos nuevos rigen desde ahora, para toda compra.",
  vacio: "No quedó ningún escalón válido, así que no se guardó nada.",
};

type Props = {
  searchParams: Promise<{ marca?: string; detalle?: string; descuentos?: string }>;
};

export default async function AjustesPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { marca, detalle, descuentos } = await searchParams;
  const aviso =
    marca === "error"
      ? (detalle ?? "No pudimos guardar el archivo")
      : marca
        ? (AVISOS[marca] ?? null)
        : null;

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

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/admin"
        className="etiqueta text-muted hover:text-accent transition-colors inline-block mb-6"
      >
        ← Panel
      </Link>

      <h1 className="titulo text-4xl mb-1">Ajustes del sitio</h1>
      <p className="text-sm text-muted mb-10 max-w-prose">
        Valen para todos los partidos. Se cambian de vez en cuando y se aplican a partir de ese
        momento.
      </p>

      <MarcaDeAgua estados={estadosMarca} aviso={aviso} ajustes={ajustesDeFoto} />

      <DescuentosPanel
        escalones={escalones}
        precioReferencia={precioReferencia}
        aviso={descuentos ? (AVISOS_DESCUENTOS[descuentos] ?? null) : null}
      />
    </div>
  );
}
