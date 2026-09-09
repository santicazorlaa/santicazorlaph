import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-5 py-24">
      <h1 className="titulo text-3xl mb-8">Panel</h1>
      <form method="POST" action="/api/admin/login" className="space-y-4">
        <label htmlFor="password" className="etiqueta text-muted block">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="w-full bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none"
        />
        {error && <p className="text-sm text-danger">Contraseña incorrecta.</p>}
        <button
          type="submit"
          className="w-full bg-accent-solid text-accent-ink etiqueta rounded-md py-3"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
