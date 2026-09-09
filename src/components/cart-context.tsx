"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "sc_carrito";

export type CartItem = {
  photoId: string;
  code: string;
  eventSlug: string;
  eventTitle: string;
  thumbUrl: string;
  priceArs: number;
};

type CartValue = {
  items: CartItem[];
  count: number;
  total: number;
  has: (photoId: string) => boolean;
  add: (item: CartItem) => void;
  remove: (photoId: string) => void;
  toggle: (item: CartItem) => void;
  clear: () => void;
  ready: boolean;
};

const Ctx = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
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

  const value = useMemo<CartValue>(
    () => ({
      items,
      count: items.length,
      total: items.reduce((s, i) => s + i.priceArs, 0),
      has: (photoId) => items.some((i) => i.photoId === photoId),
      add,
      remove,
      toggle,
      clear,
      ready,
    }),
    [items, add, remove, toggle, clear, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart tiene que usarse dentro de CartProvider");
  return ctx;
}
