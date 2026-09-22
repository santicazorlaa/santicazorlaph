"use client";

import { avisarActividad } from "@/lib/actividad-entrega";

/// El botón que lleva a la carpeta de Google Drive.
///
/// Existe como componente aparte sólo para poder anotar el clic: la página de
/// la entrega la dibuja el servidor y ahí no hay forma de escuchar un clic.
///
/// **Lo que se anota es "apretó el botón", no "entró a Drive".** Del otro lado
/// del enlace empieza Google y ahí no vemos nada: ni quién abre la carpeta, ni
/// qué baja, ni cuánto se queda. Es la diferencia entre lo que se puede medir y
/// lo que sería lindo poder medir, y en el panel figura con ese nombre para que
/// nadie lea de más.
export function BotonDriveEntrega({ slug, url }: { slug: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => avisarActividad(slug, "drive")}
      className="text-xs border border-line bg-surface con-mouse:hover:border-accent text-ink px-3.5 py-2 rounded-md font-medium transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.97] inline-flex items-center gap-1.5 shadow-sm"
    >
      <span>📂 Abrir lote en Google Drive ↗</span>
    </a>
  );
}
