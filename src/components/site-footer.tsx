import Link from "next/link";

import { linkInstagram, linkLinkedin, type Contenido } from "@/lib/contenido";
import { siteName } from "@/lib/env";

/**
 * El pie del sitio: contacto, redes, cómo se paga y los textos legales.
 *
 * Cada bloque aparece sólo si Santi cargó ese dato en el panel. Un pie con
 * "Instagram" que no lleva a ningún lado da menos confianza que uno sin
 * Instagram.
 */
export function SiteFooter({ contenido }: { contenido: Contenido }) {
  const instagram = linkInstagram(contenido["contacto.instagram"]);
  const linkedin = linkLinkedin(contenido["contacto.linkedin"]);
  const email = contenido["contacto.email"].trim();
  const hayTerminos = Boolean(contenido["legal.terminos"].trim());
  const hayPrivacidad = Boolean(contenido["legal.privacidad"].trim());

  return (
    <footer className="border-t border-line mt-24">
      <div className="mx-auto max-w-6xl px-5 py-12 grid gap-10 sm:grid-cols-3">
        <div>
          <p className="titulo text-lg">{siteName}</p>
          <p className="etiqueta text-muted mt-2">Tucumán, Argentina</p>
          {email && (
            <a
              href={`mailto:${email}`}
              className="block text-sm text-muted con-mouse:hover:text-ink transition-colors mt-3"
            >
              {email}
            </a>
          )}
        </div>

        {(instagram || linkedin) && (
          <div>
            <p className="etiqueta text-muted mb-3">Seguime</p>
            <ul className="space-y-2 text-sm">
              {instagram && (
                <li>
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="con-mouse:hover:text-accent transition-colors"
                  >
                    Instagram
                  </a>
                </li>
              )}
              {linkedin && (
                <li>
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="con-mouse:hover:text-accent transition-colors"
                  >
                    LinkedIn
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}

        <div>
          <p className="etiqueta text-muted mb-3">Pagos</p>
          <p className="text-sm text-muted max-w-xs">
            Se cobra con MercadoPago: tarjeta de crédito o débito, transferencia o
            efectivo. Las fotos se descargan en alta resolución y sin marca de agua.
          </p>
          {(hayTerminos || hayPrivacidad) && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-sm">
              {hayTerminos && (
                <li>
                  <Link
                    href="/legales/terminos"
                    className="text-muted con-mouse:hover:text-ink transition-colors"
                  >
                    Términos
                  </Link>
                </li>
              )}
              {hayPrivacidad && (
                <li>
                  <Link
                    href="/legales/privacidad"
                    className="text-muted con-mouse:hover:text-ink transition-colors"
                  >
                    Privacidad
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-8 text-sm text-muted">
        © {new Date().getFullYear()} {siteName}
      </div>
    </footer>
  );
}
