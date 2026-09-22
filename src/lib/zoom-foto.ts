/**
 * Las cuentas del zoom de una foto en el visor.
 *
 * Están acá y no adentro del componente por el mismo motivo que los descuentos
 * o el encuadre de la tapa: es aritmética pura, se puede leer sola y se puede
 * probar sola. El componente se queda con los dedos y el mouse; acá está qué
 * pasa con la foto. **Sin `server-only`**: esto corre en el navegador.
 *
 * El modelo es uno solo y todo sale de él. La foto se dibuja con
 * `translate(x, y) scale(escala)` desde el centro de su marco, así que un punto
 * de la foto que sin zoom estaba a `p` del centro termina en `p * escala + t`.
 * Dar vuelta esa cuenta es lo que permite acercar justo abajo de los dedos.
 */

export type Encuadre = { escala: number; x: number; y: number };
export type Punto = { x: number; y: number };
export type Caja = { ancho: number; alto: number };

/// La foto entera, sin acercar y centrada.
export const SIN_ZOOM: Encuadre = { escala: 1, x: 0, y: 0 };

/// Hasta dónde se deja acercar. Cuatro veces es más de lo que aguanta la
/// previsualización —que sale a 1600 px de ancho— pero el límite no es la
/// nitidez: es que más que eso se pierde de vista en qué parte de la foto está
/// uno. Abajo de 1 no se va nunca: alejar más que la foto entera deja aire
/// alrededor y no sirve para nada.
export const ESCALA_MAXIMA = 4;

/// A cuánto lleva el doble toque. Suficiente para leer un número de camiseta,
/// que es para lo que se acerca una foto de un partido.
export const ESCALA_DOBLE_TOQUE = 2.5;

/// Cuánto se deja estirar contra el borde antes de que vuelva sola. Es el mismo
/// cuarto que usa el visor al llegar a la primera o la última foto: la forma de
/// decir "hasta acá" sin un cartel, escrita una sola vez en los dos lugares.
export const RESISTENCIA = 0.25;

export function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

export function distancia(a: Punto, b: Punto): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function medio(a: Punto, b: Punto): Punto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Con qué medida se dibuja una foto dentro de su marco.
 *
 * El visor mete la foto entera adentro sin recortarla (`object-contain`), así
 * que salvo que la foto y el marco tengan exactamente la misma forma, sobra
 * aire arriba y abajo o a los costados. Esa medida —la de la foto, no la del
 * marco— es la que manda para saber hasta dónde se puede correr: midiendo
 * contra el marco se podría arrastrar la foto hacia el aire vacío, que se ve
 * como si la foto se escapara.
 */
export function medidaDentroDelMarco(caja: Caja, proporcion: number): Caja {
  if (caja.ancho <= 0 || caja.alto <= 0) return { ancho: 0, alto: 0 };
  const p = proporcion > 0 ? proporcion : 1.5;
  // El marco es más apaisado que la foto: el alto es el que se llena.
  if (caja.ancho / caja.alto > p) return { ancho: caja.alto * p, alto: caja.alto };
  return { ancho: caja.ancho, alto: caja.ancho / p };
}

/**
 * Hasta dónde se puede correr la foto sin que aparezca un borde vacío.
 *
 * Acercada, la foto es más grande que el marco: lo que sobra para cada lado es
 * la mitad de esa diferencia. Si de un eje no sobra nada —una foto parada en
 * una pantalla ancha, apenas acercada— el límite es cero y la foto se queda
 * quieta en ese eje, porque de ese lado no hay nada escondido para mostrar.
 */
export function limites(caja: Caja, proporcion: number, escala: number): Punto {
  const foto = medidaDentroDelMarco(caja, proporcion);
  return {
    x: Math.max(0, (foto.ancho * escala - caja.ancho) / 2),
    y: Math.max(0, (foto.alto * escala - caja.alto) / 2),
  };
}

function conResistencia(valor: number, limite: number, resistencia: number): number {
  if (valor > limite) return limite + (valor - limite) * resistencia;
  if (valor < -limite) return -limite + (valor + limite) * resistencia;
  return valor;
}

/**
 * Mete un encuadre adentro de sus límites.
 *
 * Con `resistencia` en cero corta seco, que es lo que se quiere mientras se
 * pellizca: si el borde cediera, la cuenta del acercamiento del cuadro
 * siguiente arrancaría de un lugar que no es. Con resistencia, el borde cede
 * un poco y vuelve solo al soltar, que es lo que se quiere arrastrando con un
 * dedo.
 */
export function acomodar(
  encuadre: Encuadre,
  caja: Caja,
  proporcion: number,
  resistencia = 0,
): Encuadre {
  const limite = limites(caja, proporcion, encuadre.escala);
  return {
    escala: encuadre.escala,
    x: conResistencia(encuadre.x, limite.x, resistencia),
    y: conResistencia(encuadre.y, limite.y, resistencia),
  };
}

/**
 * Acerca dejando quieto lo que está abajo de los dedos.
 *
 * Es lo que separa un zoom que se siente de uno que marea. Acercando desde el
 * centro del marco, lo que uno estaba mirando se le va de la pantalla y hay que
 * salir a buscarlo; acercando desde donde están los dedos, la foto crece
 * alrededor de eso y no hay que buscar nada.
 *
 * `desde` y `hasta` son el mismo punto cuando el gesto sólo acerca (la rueda
 * del mouse, el doble toque). Son distintos cuando además se mueve la mano
 * mientras se pellizca, y por eso es una sola cuenta y no dos: acercar y correr
 * son el mismo movimiento.
 *
 * Los dos puntos van medidos desde el centro del marco, que es de donde sale la
 * transformación.
 */
export function anclar(
  encuadre: Encuadre,
  desde: Punto,
  hasta: Punto,
  escalaNueva: number,
): Encuadre {
  // El punto de la foto que hoy cae abajo de los dedos, dado vuelta el dibujo.
  const enLaFoto = {
    x: (desde.x - encuadre.x) / encuadre.escala,
    y: (desde.y - encuadre.y) / encuadre.escala,
  };
  // Dónde hay que poner la foto para que ese mismo punto quede abajo de ellos.
  return {
    escala: escalaNueva,
    x: hasta.x - enLaFoto.x * escalaNueva,
    y: hasta.y - enLaFoto.y * escalaNueva,
  };
}

/// Cómo se escribe el acercamiento para mostrarlo: "2,5×".
export function textoEscala(escala: number): string {
  return `${escala.toFixed(1).replace(".", ",")}×`;
}
