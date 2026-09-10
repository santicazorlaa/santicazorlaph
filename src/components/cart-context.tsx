"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { calcularConPack, type Cuenta, type Escalon, type ItemConEvento } from "@/lib/descuentos";

const STORAGE_KEY = "sc_carrito";

export type CartItem = {
  photoId: string;
  code: string;
  eventSlug: string;
  eventTitle: string;
  thumbUrl: string;
  priceArs: number;
  /// Cuántas fotos tiene el evento en total. Con esto el carrito sabe si lo
  /// que juntó es el pack completo, sin tener que volver a preguntarle al
  /// servidor.
  totalFotosEvento: number;
  /// Precio del pack completo de ese evento, si el fotógrafo cargó uno.
  packPriceArs: number | null;
};

type CartValue = {
  items: CartItem[];
  count: number;
  /// Lo que suman las fotos sin descuento.
  subtotal: number;
  /// Lo que se paga, ya con el descuento por cantidad aplicado. Es el número
  /// que tiene que ver el comprador en cualquier pantalla.
  total: number;
  /// El detalle de esa cuenta, para poder mostrar cuánto se ahorró.
  cuenta: Cuenta;
  /// La tabla de descuentos vigente, para poder invitar al próximo escalón.
  escalones: Escalon[];
  has: (photoId: string) => boolean;
  add: (item: CartItem) => void;
  remove: (photoId: string) => void;
  toggle: (item: CartItem) => void;
  clear: () => void;
  ready: boolean;
};

const Ctx = createContext<CartValue | null>(null);

/// Los escalones llegan desde el servidor, que es donde están configurados. El
/// navegador los usa sólo para mostrar; lo que se cobra se recalcula al pagar.
export function CartProvider({
  escalones,
  children,
}: {
  escalones: Escalon[];
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // El carrito vive sólo en este navegador. El precio real se recalcula en el
  // servidor al pagar, así que si alguien lo edita a mano no sirve de nada.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Modo incógnito o storage bloqueado: seguimos con el carrito vacío.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Si no se puede guardar, el carrito igual funciona en esta pestaña.
    }
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) =>
      prev.some((i) => i.photoId === item.photoId) ? prev : [...prev, item],
    );
  }, []);

  const remove = useCallback((photoId: string) => {
    setItems((prev) => prev.filter((i) => i.photoId !== photoId));
  }, []);

  const toggle = useCallback((item: CartItem) => {
    setItems((prev) =>
      prev.some((i) => i.photoId === item.photoId)
        ? prev.filter((i) => i.photoId !== item.photoId)
        : [...prev, item],
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartValue>(() => {
    const itemsConEvento: ItemConEvento[] = items.map((i) => ({
      precio: i.priceArs,
      eventKey: i.eventSlug,
      totalFotosEvento: i.totalFotosEvento,
      packPriceArs: i.packPriceArs,
    }));
    const cuenta = calcularConPack(itemsConEvento, escalones);
    return {
      items,
      count: items.length,
      subtotal: cuenta.subtotal,
      total: cuenta.total,
      cuenta,
      escalones,
      has: (photoId: string) => items.some((i) => i.photoId === photoId),
      add,
      remove,
      toggle,
      clear,
      ready,
    };
  }, [items, escalones, add, remove, toggle, clear, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart tiene que usarse dentro de CartProvider");
  return ctx;
}
