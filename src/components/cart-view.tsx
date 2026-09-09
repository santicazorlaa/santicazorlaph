"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "./cart-context";
import { plural, precio } from "@/lib/format";
import { proximoEscalon } from "@/lib/descuentos";

export function CartView() {
  const cart = useCart();

  // Cuántas fotos le faltan para el próximo descuento. Decírselo es lo que
  // convierte el descuento en un motivo para agregar una más.
  const siguiente = proximoEscalon(cart.count, cart.escalones);
  const faltan =
    siguiente && cart.count > 0
      ? { escalon: siguiente, cuantas: siguiente.desde - cart.count }
      : null;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!cart.ready) return null;

  if (cart.count === 0) {
    return (
      <div className="border border-dashed border-line rounded-lg py-20 text-center">
        <p className="text-muted mb-6">No agregaste ninguna foto todavía.</p>
        <Link
          href="/"
          className="etiqueta border border-line rounded-full px-6 py-3 hover:border-accent transition-colors inline-block"
        >
          Ver los partidos
        </Link>
      </div>
    );
  }

  const pagar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          photoIds: cart.items.map((i) => i.photoId),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No pudimos crear el pago");
        return;
      }
      // El carrito se limpia recién cuando volvemos con el pago hecho, así que
      // si el comprador abandona MercadoPago no pierde la selección.
      window.location.href = data.checkoutUrl;
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const porEvento = cart.items.reduce<Record<string, typeof cart.items>>((acc, item) => {
    (acc[item.eventTitle] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem] items-start">
      <div className="space-y-8">
        {Object.entries(porEvento).map(([titulo, items]) => (
          <section key={titulo}>
            <h2 className="etiqueta text-muted mb-3">{titulo}</h2>
            <ul className="grid gap-3 grid-cols-3 sm:grid-cols-4">
              {items.map((item) => (
                <li key={item.photoId} className="relative group">
                  <div className="aspect-[3/2] bg-surface rounded-md overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbUrl}
                      alt={`Foto ${item.code}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => cart.remove(item.photoId)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-ground/85 backdrop-blur-sm text-muted hover:text-danger transition-colors grid place-items-center text-lg leading-none"
                    aria-label={`Quitar la foto ${item.code}`}
                  >
                    ×
                  </button>
                  <span className="etiqueta text-[0.6rem] text-muted mt-1 block">
                    #{item.code}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <button
          onClick={cart.clear}
          className="etiqueta text-muted hover:text-danger transition-colors"
        >
          Vaciar el carrito
        </button>
      </div>

      <aside className="border border-line rounded-lg p-5 lg:sticky lg:top-24">
        <h2 className="etiqueta text-muted mb-4">Resumen</h2>

        <dl className="space-y-2 text-sm tabular-nums border-b border-line pb-4 mb-4">
          <div className="flex justify-between">
            <dt className="text-muted">
              {cart.count} {cart.count === 1 ? "foto" : "fotos"}
            </dt>
            <dd className="cifra">{precio(cart.subtotal)}</dd>
          </div>
          {cart.cuenta.porcentaje > 0 && (
            <div className="flex justify-between text-accent">
              <dt>Descuento por {cart.count} fotos ({cart.cuenta.porcentaje}%)</dt>
              <dd className="cifra">−{precio(cart.cuenta.ahorro)}</dd>
            </div>
          )}
        </dl>

        <div className="flex justify-between items-baseline mb-4">
          <span className="etiqueta text-muted">Total</span>
          <span className="cifra text-3xl">{precio(cart.total)}</span>
        </div>

        {faltan && (
          <p className="text-xs text-muted border border-dashed border-line rounded-md px-3 py-2.5 mb-5">
            Agregá {plural(faltan.cuantas, "foto más", "fotos más")} y te llevás{" "}
            <span className="text-accent">{faltan.escalon.porcentaje}% de descuento</span>.
          </p>
        )}

        <form onSubmit={pagar} className="space-y-3">
          <label htmlFor="email" className="etiqueta text-muted block">
            Tu email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@email.com"
            className="w-full bg-surface border border-line rounded-md px-3 py-2.5 text-sm focus:border-accent outline-none"
          />
          <p className="text-xs text-muted">
            Ahí te mandamos el link para descargar las fotos.
          </p>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-accent-solid text-accent-ink etiqueta rounded-md py-3.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {enviando ? "Abriendo el pago…" : "Pagar con MercadoPago"}
          </button>
        </form>

        <ul className="mt-5 space-y-2 text-xs text-muted">
          <li>Tarjeta, débito, Rapipago, Pago Fácil o dinero en cuenta.</li>
          <li>Descarga inmediata apenas se acredita.</li>
          <li>Resolución completa, sin marca de agua.</li>
        </ul>
      </aside>
    </div>
  );
}
