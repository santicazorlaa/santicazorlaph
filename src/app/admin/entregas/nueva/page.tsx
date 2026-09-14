import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BotonEnvio } from "@/components/boton-envio";
import { isAdmin } from "@/lib/auth";
import { createClientDelivery } from "@/lib/deliveries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nueva entrega a equipo", robots: { index: false } };

const claseCampo =
  "w-full bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none text-sm";

async function crearEntregaAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const fechaTexto = String(formData.get("date") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const driveUrl = String(formData.get("driveUrl") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!title || !clientName || !fechaTexto || !driveUrl) {
    redirect("/admin/entregas/nueva?error=faltan_campos");
  }

  let deliveryId = "";
  try {
    const delivery = await createClientDelivery({
      title,
      clientName,
      date: new Date(`${fechaTexto}T12:00:00`),
      location: location || undefined,
      driveUrl,
      pin: pin || undefined,
    });
    deliveryId = delivery.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    redirect(`/admin/entregas/nueva?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/admin/entregas");
  redirect(`/admin/entregas/${deliveryId}?creado=1`);
}

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NuevaEntregaPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { error } = await searchParams;
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="flex items-center gap-2 text-xs text-muted mb-4">
        <Link href="/admin" className="con-mouse:hover:text-ink transition-colors">
          Panel
        </Link>
        <span>/</span>
        <Link href="/admin/entregas" className="con-mouse:hover:text-ink transition-colors">
          Entregas a Equipos
        </Link>
        <span>/</span>
        <span className="text-ink">Nueva</span>
      </div>

      <h1 className="titulo text-3xl sm:text-4xl mb-2">Nueva entrega privada</h1>
      <p className="text-sm text-muted mb-8">
        Creá una galería exclusiva para el equipo conectando la carpeta de Google Drive donde tenés
        los archivos originales.
      </p>

      {error && (
        <div className="mb-6 p-4 border border-red-500/30 bg-red-500/10 rounded-md text-sm text-red-200">
          {error === "faltan_campos"
            ? "Por favor completá los campos obligatorios (Título, Equipo, Fecha y Link de Drive)."
            : decodeURIComponent(error)}
        </div>
      )}

      <form action={crearEntregaAction} className="space-y-6 bg-surface border border-line p-6 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2" htmlFor="title">
            Título del evento o partido *
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="Ej: San Cirano vs Newman - Plantel Superior"
            className={claseCampo}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2" htmlFor="clientName">
              Club o Equipo *
            </label>
            <input
              id="clientName"
              name="clientName"
              required
              placeholder="Ej: San Cirano"
              className={claseCampo}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2" htmlFor="date">
              Fecha *
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={hoy}
              className={claseCampo}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2" htmlFor="location">
            Cancha o Lugar (opcional)
          </label>
          <input
            id="location"
            name="location"
            placeholder="Ej: Cancha 1, Villa Celina"
            className={claseCampo}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2" htmlFor="driveUrl">
            Link de la carpeta de Google Drive *
          </label>
          <input
            id="driveUrl"
            name="driveUrl"
            required
            placeholder="https://drive.google.com/drive/folders/1ABCxyz..."
            className={claseCampo}
          />
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Recordá que en Google Drive la carpeta debe estar compartida como:
            <strong className="text-ink ml-1">&quot;Cualquiera con el enlace puede ver&quot;</strong>. Así los jugadores pueden ver y descargar cada foto individual en resolución original.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2" htmlFor="pin">
            PIN de acceso para el equipo (opcional)
          </label>
          <input
            id="pin"
            name="pin"
            maxLength={8}
            placeholder="Ej: 4820 (dejar en blanco para acceso directo por link)"
            className={claseCampo}
          />
          <p className="mt-1 text-xs text-muted">
            Si ponés un PIN, los jugadores deberán escribirlo una sola vez para desbloquear la galería.
          </p>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-line">
          <Link
            href="/admin/entregas"
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            Cancelar
          </Link>

          <BotonEnvio
            enviando="Creando y sincronizando…"
            className="bg-accent text-ground font-medium text-sm px-6 py-2.5 rounded-md hover:bg-accent/90 transition-colors"
          >
            Crear entrega
          </BotonEnvio>
        </div>
      </form>
    </div>
  );
}
