import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BotonEnvio } from "@/components/boton-envio";
import { PestanasIngresos } from "@/components/pestanas-ingresos";
import { SenalDeLink } from "@/components/senal-link";
import { COMISION_MP, guardarAjuste, leerNumero, RANGOS } from "@/lib/ajustes";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { precio, plural } from "@/lib/format";
import { agrupar, desdeMasAntiguo, type Vista } from "@/lib/ingresos";
import { MetodoPago, OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresos", robots: { index: false } };

async function guardarComision(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  // Acepta "12,61" y "12.61": en Argentina la coma es lo natural.
  const n = Number(String(formData.get("comision") ?? "").trim().replace(",", "."));
  const { min, max } = RANGOS[COMISION_MP];
  if (!Number.isFinite(n) || n < min || n > max) redirect("/admin/ingresos?comision=invalida");

  await guardarAjuste(COMISION_MP, String(Math.round(n * 100) / 100));
  revalidatePath("/admin/ingresos");
  redirect("/admin/ingresos?comision=guardada");
}

const AVISOS: Record<string, { texto: string; bueno: boolean }> = {
  guardada: { texto: "Listo: los ingresos se calculan con el porcentaje nuevo.", bueno: true },
  invalida: { texto: "Ese porcentaje no es válido: tiene que estar entre 0 y 40.", bueno: false },
};

type Props = { searchParams: Promise<{ vista?: string; comision?: string }> };

/**
 * Cuánta plata entró, separada por día, semana o mes, ya descontado lo que
 * MercadoPago se queda. Sólo cuenta ventas de este sitio, así que no se mezcla
 * con lo que la cuenta cobra por otros negocios.
 */
export default async function IngresosPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { vista: vistaParam, comision: avisoParam } = await searchParams;
  const vista: Vista = vistaParam === "semana" || vistaParam === "mes" ? vistaParam : "dia";

  const [porcentaje, pagadas] = await Promise.all([
    leerNumero(COMISION_MP),
    db.order.findMany({
      where: { status: OrderStatus.PAID, paidAt: { gte: desdeMasAntiguo() } },
      select: { paidAt: true, totalArs: true, metodoPago: true },
    }),
  ]);

  const filas = agrupar(
    pagadas.flatMap((o) =>
      o.paidAt
        ? [{ pagadaEn: o.paidAt, totalArs: o.totalArs, conComision: o.metodoPago !== MetodoPago.TRANSFERENCIA }]
        : [],
    ),
    vista,
    porcentaje,
  );

  const total = filas.reduce(
    (t, f) => ({
      ventas: t.ventas + f.ventas,
      bruto: t.bruto + f.bruto,
      descuento: t.descuento + f.descuento,
      neto: t.neto + f.neto,
    }),
    { ventas: 0, bruto: 0, descuento: 0, neto: 0 },
  );
  const aviso = avisoParam ? AVISOS[avisoParam] : undefined;
  const ventana = vista === "dia" ? "los últimos 30 días" : vista === "semana" ? "las últimas 12 semanas" : "los últimos 12 meses";

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/admin"
        className="etiqueta text-muted hover:text-accent transition-colors inline-flex items-center mb-6"
      >
        ← Panel
        <SenalDeLink />
      </Link>

      <h1 className="titulo text-4xl mb-2">Ingresos</h1>
      <p className="text-sm text-muted mb-8 max-w-prose">
        Lo que entró por ventas del sitio, ya descontado el {porcentaje.toLocaleString("es-AR")}% que
        MercadoPago se queda (su cargo más la retención de Ingresos Brutos). Es la cifra que tiene que
        coincidir con lo que cae en tu cuenta. Las ventas por transferencia no llevan descuento.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Resumen etiqueta={`Te quedó (${ventana})`} valor={precio(total.neto)} destacado />
        <Resumen etiqueta="Vendido en total" valor={precio(total.bruto)} />
        <Resumen etiqueta="Se descontó" valor={precio(total.descuento)} />
      </div>

      <PestanasIngresos vistaActual={vista}>
        <div className="border-y border-line divide-y divide-line">
          <div className="hidden sm:grid grid-cols-[1fr_5rem_8rem_8rem_8rem] gap-4 py-2 etiqueta text-[0.65rem] text-muted">
            <span>Período</span>
            <span className="text-right">Ventas</span>
            <span className="text-right">Vendido</span>
            <span className="text-right">Descuento</span>
            <span className="text-right">Te quedó</span>
          </div>
          {filas.map((f) => (
            <div
              key={f.clave}
              className={`grid grid-cols-2 sm:grid-cols-[1fr_5rem_8rem_8rem_8rem] gap-x-4 gap-y-1 py-3 text-sm tabular-nums ${
                f.ventas === 0 ? "text-muted" : ""
              }`}
            >
              <span className="col-span-2 sm:col-span-1">{f.etiqueta}</span>
              <span className="sm:text-right">{plural(f.ventas, "venta", "ventas")}</span>
              <span className="text-right">{precio(f.bruto)}</span>
              <span className="text-muted sm:text-right">{f.descuento > 0 ? `− ${precio(f.descuento)}` : "—"}</span>
              <span className="text-right font-medium">{precio(f.neto)}</span>
            </div>
          ))}
        </div>
      </PestanasIngresos>

      <section className="border border-line rounded-lg p-5 mt-10">
        <h2 className="etiqueta text-muted mb-1">Porcentaje que descuenta MercadoPago</h2>
        <p className="text-sm text-muted mb-4 max-w-prose">
          Sumá el cargo de MercadoPago y la retención de Ingresos Brutos. Si alguna cambia, corregilo
          acá y todos los números se recalculan. No cambia lo que se le cobra al comprador.
        </p>
        {aviso && <p className={`text-sm mb-4 ${aviso.bueno ? "text-good" : "text-danger"}`}>{aviso.texto}</p>}
        <form action={guardarComision} className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              name="comision"
              inputMode="decimal"
              defaultValue={String(porcentaje).replace(".", ",")}
              className="w-24 bg-transparent border border-line rounded px-3 py-2 tabular-nums"
              aria-label="Porcentaje que descuenta MercadoPago"
            />
            %
          </label>
          <BotonEnvio
            enviando="Guardando…"
            className="bg-accent-solid text-accent-ink rounded px-6 py-2.5 hover:opacity-90 inline-flex items-center"
          >
            Guardar
          </BotonEnvio>
        </form>
      </section>
    </div>
  );
}

function Resumen({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`border rounded-lg p-5 ${destacado ? "border-accent/40 bg-accent/5" : "border-line"}`}>
      <p className="etiqueta text-muted mb-1">{etiqueta}</p>
      <p className="titulo text-2xl tabular-nums">{valor}</p>
    </div>
  );
}
