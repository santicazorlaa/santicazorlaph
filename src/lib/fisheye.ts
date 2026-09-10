/**
 * La matemática de la cinta: el efecto lupa que sigue al puntero.
 *
 * Va sin `server-only` porque es aritmética pura sin nada del navegador
 * adentro: se puede probar suelta y no arrastra dependencias. La usa
 * `cinta-portfolio.tsx`.
 *
 * La idea es una lente puesta sobre la fila de fotos. La que está justo abajo
 * del puntero crece del todo, las vecinas un poco menos y así hasta que el
 * efecto se apaga. Dos cuentas separadas:
 *
 * - **Cuánto crece cada una** sale de una campana de Gauss:
 *   `exp(-dist² / 2σ²)`. Es la curva que no tiene esquinas en ningún lado, así
 *   que el crecimiento entra y sale sin escalones. `σ` es el ancho de la lente.
 *
 * - **Cuánto se corre cada una** sale de la integral de esa campana, que es la
 *   función error (`erf`). Este es el paso que faltaba antes: al crecer una
 *   foto, las de al lado tienen que hacerle lugar o se le montan encima. Como
 *   `erf` es justamente cuánta "campana" quedó de un lado, dice exactamente
 *   cuánto empujó el crecimiento acumulado hasta ahí. Las de la izquierda se
 *   corren a la izquierda, las de la derecha a la derecha, y la del centro no
 *   se mueve.
 */

/// La función error, con la aproximación clásica de Abramowitz y Stegun
/// (7.1.26): siete multiplicaciones y una exponencial, con un error menor a
/// 1,5·10⁻⁷. `erf` de verdad es una integral sin forma cerrada y calcularla
/// bien en cada cuadro, para cada foto, no tendría sentido: acá lo que se
/// necesita es la forma de la curva, no el séptimo decimal.
export function erf(x: number): number {
  const signo = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return signo * y;
}

/// Arranca rápido y frena al final. Es la curva de todo lo que entra o sale en
/// el sitio; acá la usa el vuelo de la foto al abrirse y al cerrarse.
export function suavizar(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/// Deja un número dentro de una vuelta completa de la cinta, siempre positivo.
/// El `%` de JavaScript devuelve negativo con entradas negativas, y una foto en
/// la posición -50 tiene que reaparecer al final de la fila, no antes del
/// principio.
export function envolver(valor: number, total: number): number {
  return ((valor % total) + total) % total;
}

/**
 * La lente, ya armada para un ancho y una intensidad dados.
 *
 * Se arma una vez y se consulta por foto en cada cuadro. Los precálculos —los
 * dos denominadores— viven acá adentro justamente para no rehacerlos sesenta
 * veces por segundo por cada foto.
 */
export function crearLente({
  radio,
  acercamiento,
  empuje,
}: {
  /// A qué distancia del puntero, en píxeles, el efecto ya casi no se siente.
  radio: number;
  /// Cuánto crece la foto que está justo abajo del puntero. 0,3 es un 30%.
  acercamiento: number;
  /// Cuánto llega a correrse, en píxeles, una foto lejos del puntero para
  /// hacerle lugar a las que crecieron.
  empuje: number;
}) {
  const dosRadioAlCuadrado = 2 * radio * radio;
  const radioPorRaizDeDos = Math.SQRT2 * radio;

  return {
    /// Cuánto tiene que crecer y correrse una foto cuyo centro está a
    /// `distancia` píxeles del puntero (con signo: negativo si la foto está a
    /// la izquierda).
    calcular(distancia: number) {
      const cerca = Math.exp(-(distancia * distancia) / dosRadioAlCuadrado);
      return {
        escala: 1 + acercamiento * cerca,
        corrimiento: empuje * erf(distancia / radioPorRaizDeDos),
        cerca,
      };
    },
  };
}

/**
 * Cuánto tiene que correrse una foto lejana para que ninguna quede montada
 * sobre otra cuando la lupa está en su punto máximo.
 *
 * El componente del que salió esta cinta usaba un número elegido a ojo, y con
 * él las fotos se montaban unos treinta píxeles. Se puede calcular:
 *
 * Cada foto en la posición `u` crece `ancho · acercamiento · g(u)`, con `g` la
 * campana. Ese crecimiento sale mitad para cada lado, así que empuja a todo lo
 * que tiene a la derecha en la mitad de lo que creció, y a todo lo de la
 * izquierda en la misma mitad para el otro lado. El corrimiento de la foto que
 * está en `x` es entonces la suma de las mitades de un lado menos la del otro:
 *
 *     s(x) = [ ∫ desde -∞ hasta x  −  ∫ desde x hasta +∞ ] / (2 · paso)
 *
 * Las dos integrales de la campana se resuelven con la función error, y la
 * resta deja justo `erf`. El total de la campana es `σ·√(2π)`, así que:
 *
 *     s(x) = ancho · acercamiento · σ · √(2π) · erf(x / σ√2) / (2 · paso)
 *
 * Lo de adelante del `erf` es este número: cuánto llega a correrse una foto que
 * está del todo afuera de la lente. El `paso` es de foto a foto —ancho más el
 * hueco—, porque lo que importa es qué tan apretadas están: la misma lupa sobre
 * fotos más separadas necesita empujar menos.
 */
export function empujeSinSolapes({
  ancho,
  paso,
  radio,
  acercamiento,
}: {
  /// El ancho típico de una foto, en píxeles.
  ancho: number;
  /// De dónde empieza una foto a dónde empieza la siguiente: ancho más hueco.
  paso: number;
  /// El ancho de la lente, la `σ` de la campana.
  radio: number;
  acercamiento: number;
}): number {
  return (ancho * acercamiento * radio * Math.sqrt(2 * Math.PI)) / (2 * paso);
}

/// Acerca un valor a otro un poco por cuadro. Es lo que hace que el efecto
/// tenga peso: la foto no salta al tamaño nuevo, va llegando. Con 0,12 tarda
/// unos cinco cuadros en hacer la mitad del camino, que a 60 cuadros por
/// segundo se lee como algo que responde al instante pero no de golpe.
export const SUAVIDAD = 0.12;

export function acercar(actual: number, objetivo: number, suavidad = SUAVIDAD): number {
  return actual + (objetivo - actual) * suavidad;
}
