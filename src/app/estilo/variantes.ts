import {
  Anton,
  Archivo,
  Barlow,
  Barlow_Condensed,
  Fraunces,
  Inter,
  Inter_Tight,
} from "next/font/google";

import type { CSSProperties } from "react";

/// Las tres direcciones visuales que se comparan en /estilo.
///
/// Cada una es sólo un puñado de variables CSS. Ese es justamente el punto del
/// muestrario: elegida una, se copian estos valores a `globals.css` y cambia el
/// sitio entero, sin tocar una sola pantalla.

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--f-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--f-inter",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--f-anton",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--f-archivo",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--f-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--f-barlow-cond",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--f-inter-tight",
  display: "swap",
});

export type Variante = {
  id: string;
  nombre: string;
  /// Qué sensación busca dar, en criollo.
  idea: string;
  tipografias: string;
  /// Clases de next/font que hay que colgar del contenedor.
  fuentes: string;
  vars: CSSProperties;
};

export const variantes: Variante[] = [
  {
    id: "anterior",
    nombre: "El diseño anterior",
    idea:
      "Condensada en mayúsculas sobre negro, con naranja. Queda de referencia para comparar contra lo que había antes de septiembre de 2026.",
    tipografias: "Barlow Condensed + Barlow",
    fuentes: `${barlow.variable} ${barlowCondensed.variable}`,
    vars: {
      "--font-display": "var(--f-barlow-cond), \"Arial Narrow\", sans-serif",
      "--font-sans": "var(--f-barlow), system-ui, sans-serif",
      "--color-ground": "#0b0c0e",
      "--color-surface": "#141619",
      "--color-surface-2": "#1c1f24",
      "--color-ink": "#f4f3f1",
      "--color-muted": "#8c919b",
      "--color-line": "#24272d",
      "--color-accent": "#e9a13b",
      "--color-accent-solid": "#e9a13b",
      "--color-accent-ink": "#14161a",
      "--caja-titulo": "uppercase",
      "--peso-titulo": "600",
      "--track-titulo": "0.01em",
      "--interlinea-titulo": "1",
      "--track-etiqueta": "0.12em",
    } as CSSProperties,
  },
  {
    id: "galeria",
    nombre: "Galería",
    idea:
      "Serif de revista, negro cálido y dorado. Baja el volumen del diseño para que la foto sea lo único que grita. Es el look que justifica un precio más alto.",
    tipografias: "Fraunces + Inter",
    fuentes: `${fraunces.variable} ${inter.variable}`,
    vars: {
      "--font-display": "var(--f-fraunces), Georgia, serif",
      "--font-sans": "var(--f-inter), system-ui, sans-serif",
      "--color-ground": "#100e0c",
      "--color-surface": "#1a1714",
      "--color-surface-2": "#221e1a",
      "--color-ink": "#f4efe7",
      "--color-muted": "#a09689",
      "--color-line": "#2c2620",
      "--color-accent": "#d9a441",
      "--color-accent-solid": "#d9a441",
      "--color-accent-ink": "#1a1610",
      "--caja-titulo": "none",
      "--peso-titulo": "600",
      "--track-titulo": "-0.02em",
      "--interlinea-titulo": "1.05",
      "--track-etiqueta": "0.16em",
    } as CSSProperties,
  },
  {
    id: "cancha",
    nombre: "Cancha",
    idea:
      "Título pesado en mayúsculas y un verde flúor de transmisión deportiva. Es lo más cercano a lo de hoy, pero más fuerte y más joven. Habla el idioma del jugador.",
    tipografias: "Anton + Archivo",
    fuentes: `${anton.variable} ${archivo.variable}`,
    vars: {
      "--font-display": "var(--f-anton), Impact, sans-serif",
      "--font-sans": "var(--f-archivo), system-ui, sans-serif",
      "--color-ground": "#07080a",
      "--color-surface": "#101317",
      "--color-surface-2": "#171b21",
      "--color-ink": "#ffffff",
      "--color-muted": "#8b95a3",
      "--color-line": "#1e242c",
      "--color-accent": "#ccff33",
      "--color-accent-solid": "#ccff33",
      "--color-accent-ink": "#0b0f05",
      "--caja-titulo": "uppercase",
      "--peso-titulo": "400",
      "--track-titulo": "0.005em",
      "--interlinea-titulo": "0.95",
      "--track-etiqueta": "0.14em",
    } as CSSProperties,
  },
  {
    id: "estudio",
    nombre: "Estudio oscuro · el elegido",
    idea:
      "Las tipografías de la opción clara, pero sobre fondo oscuro y con botones azules. Es lo que está aplicado hoy en el sitio; queda acá para poder compararlo contra el resto.",
    tipografias: "Inter Tight + Inter",
    fuentes: `${interTight.variable} ${inter.variable}`,
    vars: {
      "--font-display": "var(--f-inter-tight), system-ui, sans-serif",
      "--font-sans": "var(--f-inter), system-ui, sans-serif",
      "--color-ground": "#0b0d10",
      "--color-surface": "#14171c",
      "--color-surface-2": "#1c2027",
      "--color-ink": "#f2f4f7",
      "--color-muted": "#8b929d",
      "--color-line": "#23272e",
      "--color-accent": "#5b93ff",
      "--color-accent-solid": "#2b6ae8",
      "--color-accent-ink": "#ffffff",
      "--caja-titulo": "none",
      "--peso-titulo": "700",
      "--track-titulo": "-0.035em",
      "--interlinea-titulo": "1",
      "--track-etiqueta": "0.1em",
    } as CSSProperties,
  },
];
