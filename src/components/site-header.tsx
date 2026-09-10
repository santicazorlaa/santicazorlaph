"use client";

import Link from "next/link";

import { useCart } from "./cart-context";
import { LatidoDeLink, SenalDeLink } from "./senal-link";

export function SiteHeader() {
  const { count, ready } = useCart();

  return (
    <header className="border-b border-line sticky top-0 z-30 bg-ground/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-5 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="Santi Cazorla · Fotografía Deportiva"
          className="shrink-0 opacity-95 hover:opacity-100 transition-opacity"
        >
          {/* El logotipo completo es muy apaisado (6,6:1) y no entra en un
              celular junto al carrito: ahí mostramos sólo el isotipo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.svg" alt="" className="h-7 w-auto sm:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="hidden sm:block h-10 w-auto" />
        </Link>

        {/* Cada link lleva su propio punto de espera. El encabezado está en
            todas las pantallas y es de donde más se navega: si el cambio tarda,
            la respuesta tiene que estar en el link que se tocó. */}
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="etiqueta text-muted hover:text-ink transition-colors flex items-center"
          >
            Partidos
            <SenalDeLink />
          </Link>
          <Link
            href="/portfolio"
            className="etiqueta text-muted hover:text-ink transition-colors flex items-center"
          >
            Portfolio
            <SenalDeLink />
          </Link>
          {/* El carrito va como ícono y no como palabra. Con la palabra, el
              punto de espera le comía el lugar de un costado y el texto
              quedaba corrido dentro del botón; y un carrito se reconoce de un
              vistazo, que es lo que hace falta en una barra que está en todas
              las pantallas. La palabra vive igual en el `aria-label`, para
              quien no ve el dibujo. */}
          <Link
            href="/carrito"
            aria-label={ready && count > 0 ? `Carrito, ${count}` : "Carrito"}
            className="etiqueta flex items-center gap-2 border border-line hover:border-accent rounded-full pl-3 pr-3 py-2 transition-colors"
          >
            <LatidoDeLink>
              <IconoCarrito />
            </LatidoDeLink>
            {ready && count > 0 && (
              /* La `key` con el número adentro no es un detalle: al cambiar,
                 React tira este span y pone otro, y el nuevo entra con la
                 animación. Eso es lo que confirma, desde el otro extremo de la
                 pantalla, que la foto que se acaba de tocar entró al carrito. */
              <span
                key={count}
                aria-hidden
                className="bg-accent-solid text-accent-ink rounded-full min-w-5 h-5 px-1.5 grid place-items-center text-[0.7rem] font-semibold tabular-nums entra-contador"
              >
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/// El carrito de la compra. Va con `currentColor` para que tome el color del
/// texto de al lado y siga al hover del botón sin tener que repintarlo aparte.
function IconoCarrito() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="w-5 h-5"
    >
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}
