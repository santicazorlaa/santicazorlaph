/**
 * El encuadre de la tapa: qué pedazo de la foto se ve arriba de todo en el
 * home.
 *
 * Hay dos, no uno, y ese es el punto. En una pantalla de escritorio la tapa es
 * una franja bien apaisada; en un celular es un rectángulo alto. De la misma
 * foto salen dos recortes muy distintos, y dejar que el navegador elija por su
 * cuenta —recortando siempre por el centro— es lo que hace que en el teléfono
 * aparezca un pedazo de pasto y la jugada quede afuera.
 *
 * Este archivo no lleva `server-only` a propósito: las cuentas las usa el
 * editor del panel para dibujar la previsualización y el servidor para recortar
 * de verdad. Si fueran dos cuentas distintas, un día no coincidirían y lo que
 * Santi ve al encuadrar dejaría de ser lo que sale publicado.
 */

/// Un recorte, en fracciones del ancho y del alto de la foto (0 a 1). Se guarda
/// así, y no en píxeles, para que siga valiendo aunque la foto de origen se
/// vuelva a procesar con otra medida.
export type Encuadre = { x: number; y: number; ancho: number; alto: number };

/// Las dos medidas con las que se publica la tapa. La de escritorio es una
/// franja ancha; la de celular, un rectángulo vertical.
export const TAPA_ESCRITORIO = { ancho: 1920, alto: 800 };
export const TAPA_CELULAR = { ancho: 1080, alto: 1440 };

export type Formato = { ancho: number; alto: number };

/// El recorte más grande con esta proporción que entra en una foto de W×H,
/// centrado. Es lo que se usa cuando Santi todavía no encuadró nada.
export function encuadreCompleto(W: number, H: number, formato: Formato): Encuadre {
  const proporcion = formato.ancho / formato.alto;
  const anchoPx = Math.min(W, H * proporcion);
  const altoPx = anchoPx / proporcion;
  return {
    x: (W - anchoPx) / 2 / W,
    y: (H - altoPx) / 2 / H,
    ancho: anchoPx / W,
    alto: altoPx / H,
  };
}

/// Mete el recorte adentro de la foto. Un recorte que se sale del borde le
/// haría dibujar a sharp una franja negra, así que se acota siempre: al
/// arrastrar en el editor y otra vez antes de recortar en el servidor.
export function acotar(e: Encuadre): Encuadre {
  const ancho = Math.min(1, Math.max(0.01, e.ancho));
  const alto = Math.min(1, Math.max(0.01, e.alto));
  return {
    ancho,
    alto,
    x: Math.min(1 - ancho, Math.max(0, e.x)),
    y: Math.min(1 - alto, Math.max(0, e.y)),
  };
}

/// Se guarda como texto porque los ajustes del sitio son una tabla de texto:
/// una fila por dato, sin migrar la base cada vez que aparece uno nuevo.
export function escribirEncuadre(e: Encuadre): string {
  return [e.x, e.y, e.ancho, e.alto].map((n) => n.toFixed(5)).join(",");
}

export function leerEncuadre(texto: string): Encuadre | null {
  const partes = texto.split(",").map(Number);
  if (partes.length !== 4 || partes.some((n) => !Number.isFinite(n))) return null;
  const [x, y, ancho, alto] = partes;
  return acotar({ x, y, ancho, alto });
}

/// El recorte en píxeles enteros sobre una foto de W×H, listo para sharp.
export function enPixeles(e: Encuadre, W: number, H: number) {
  const ancho = Math.max(1, Math.round(e.ancho * W));
  const alto = Math.max(1, Math.round(e.alto * H));
  return {
    left: Math.min(W - ancho, Math.max(0, Math.round(e.x * W))),
    top: Math.min(H - alto, Math.max(0, Math.round(e.y * H))),
    width: ancho,
    height: alto,
  };
}
