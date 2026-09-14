"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PinGate({
  slug,
  title,
  clientName,
}: {
  slug: string;
  title: string;
  clientName: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/entrega/${slug}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "PIN incorrecto. Revisá el código del equipo.");
        setPin("");
      } else {
        router.refresh();
      }
    } catch {
      setError("Error de conexión. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm border border-line bg-surface p-8 rounded-xl text-center shadow-xl">
        <span className="etiqueta text-accent mb-3 block">{clientName}</span>

        <h1 className="titulo text-2xl mb-2">{title}</h1>
        <p className="text-xs text-muted mb-6">
          Esta galería privada está protegida. Ingresá el PIN asignado a tu equipo para acceder a las fotos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pin-input" className="sr-only">
              PIN de acceso
            </label>
            <input
              id="pin-input"
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Ingresá el PIN"
              className="w-full text-center text-xl tracking-[0.3em] font-mono bg-ground border border-line rounded-lg px-4 py-3 focus:border-accent outline-none text-ink placeholder:text-muted placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 py-2 px-3 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !pin.trim()}
            className="w-full bg-accent text-ground font-medium text-sm py-3 rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? "Verificando…" : "Acceder a las fotos →"}
          </button>
        </form>

        <p className="text-[0.7rem] text-muted mt-6">
          ¿No tenés el PIN? Consultale al delegado, capitán o a Santi Cazorla.
        </p>
      </div>
    </div>
  );
}
