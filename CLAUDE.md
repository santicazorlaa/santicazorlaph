@AGENTS.md

# santicazorlaph — venta de fotos deportivas

Sitio de Santiago Nieva Cazorla (Santi Cazorla Photography), fotógrafo deportivo
en Tucumán, para vender las fotos que saca en los partidos.

**En producción:** https://www.santicazorlaph.com · repo `santicazorlaa/santicazorlaph`

Santi no programa. Las decisiones técnicas son nuestras; él decide sobre el
negocio y sobre cómo se ve su trabajo. Prefiere que avancemos y le mostremos
resultados antes que consultarle cada detalle. **Todo se le explica en español y
sin jerga**, diciendo por qué importa cada cosa, no solo qué se hizo.

## Por qué existe

Las plataformas que usan sus colegas (Renzu, Fullfoto, Levelpic) cobran
AR$ 25.000–40.000 por mes **más** comisión, sobre un precio de mercado de
AR$ 2.500 por foto que es igual en las tres. Con infraestructura propia el costo
fijo arranca cerca de cero y sólo queda la comisión de MercadoPago.

**Al proponer cambios, cuidar que no reintroduzcan un costo fijo mensual alto.**
Es la razón de ser del proyecto. Cloudflare R2 se eligió sobre S3 justamente por
no cobrar transferencia de salida, que en un sitio de fotos es el gasto que se
dispara.

## Servicios

| Qué | Dónde | Detalle |
|---|---|---|
| Sitio | Vercel | proyecto `santicazorlaph`, rama `main` |
| Base | Neon Postgres | región São Paulo |
| Fotos | Cloudflare R2 | dos buckets, ver abajo |
| CDN de fotos | `fotos.santicazorlaph.com` | dominio propio sobre el bucket público |
| Pagos | MercadoPago | Checkout Pro, cuenta real `238509129` |
| Mails | Resend | dominio `santicazorlaph.com` verificado |
| Dominio | Cloudflare | `www` es el canónico; el apex redirige |

Las credenciales están en `.env` (local) y en las variables de Vercel. El archivo
`.env.vercel` es la copia para pegar en Vercel; ninguno de los dos va a git.

**`.env` y `.env.vercel` apuntan a bases distintas, a propósito.** `.env` usa
`santicazorlaph_dev`; `.env.vercel` usa `neondb`, la real. Es el mismo proyecto
de Neon, así que no suma costo. Antes de esto las dos apuntaban a la misma base,
y trabajar en local tocaba clientes y ventas de verdad — pasó una vez, sin
consecuencias porque se notó a tiempo, pero fue la razón de separarlas.

## Decisiones que conviene no revisitar sin motivo

**El original nunca llega al navegador.** Vive en el bucket privado
(`santicazorlaph-originales`) y sólo sale por URL firmada que caduca a los 5
minutos, después de que la orden está pagada. El bucket público
(`santicazorlaph-previews`) sólo tiene versiones con marca de agua.

**Una orden pasa a pagada únicamente desde el servidor**, verificando la firma
del aviso de MercadoPago y consultando el pago por su ID. Nunca desde lo que
diga el navegador al volver del checkout.

**Hay una red de seguridad además del webhook.** Si la orden figura pendiente
cuando el comprador abre su página, el sitio le pregunta a MercadoPago si hay un
pago aprobado y la acredita. Los avisos se pierden por muchas razones; esto es lo
que evita que un pago cobrado quede sin entregar.

**Los originales se suben directo al bucket desde el navegador**, en dos pasos
(autorizar → subir → procesar). Vercel rechaza cualquier petición de más de
4,5 MB y las fotos de Santi pesan ~19 MB. Esto **no** se puede simplificar a una
subida común.

**Sin cuentas de comprador.** La orden se identifica con un token secreto en la
URL, que también va por mail. Fue a propósito: una cuenta menos es un obstáculo
menos antes de pagar.

**En local se usan las credenciales de PRUEBA de MercadoPago**, aunque el sitio
publicado use las reales. Trabajar contra la cuenta real significa que un script
mal apuntado mueve plata de verdad.

**Prisma fijado en v6.** La v8 reestructuró la CLI y la ata a su plataforma.

**Una migración que borra algo va con `IF EXISTS`.** Las dos bases no están en
el mismo punto: lo que se prueba en desarrollo puede tardar semanas en
publicarse, así que una migración que borra una columna creada y borrada entre
medio se encuentra en producción con que esa columna nunca existió. Pasó al
publicar el portfolio: la migración se cayó a mitad y dejó la base real
atascada, sin poder aplicar ninguna otra. Se desatasca con
`npx tsx --env-file=.env.vercel scripts/migrar-produccion.ts resolve --rolled-back <nombre>`
y se vuelve a aplicar.

**Un cambio de esquema (`prisma/schema.prisma`) se aplica dos veces, a mano.**
`npx prisma migrate dev` contra `.env` lo prueba en la base de desarrollo. Antes
de publicar, `npm run migrar:produccion` aplica el mismo historial contra la
base real, usando `.env.vercel`. Publicar código sin este segundo paso deja el
sitio funcionando contra un esquema viejo. Storage (R2) y el mail (Resend) en
cambio siguen compartidos entre local y producción: separarlos no valía la
complejidad, y lo peor que puede pasar por eso son archivos de sobra en el
bucket, que ya está aceptado como riesgo menor en otro lado de este documento.

**La estética se cambia desde `globals.css`, no pantalla por pantalla.** Los
colores, las tipografías y hasta el peso y la caja de los títulos son variables
CSS declaradas en un solo lugar. Cambiarlas ahí cambia el sitio entero y queda
coherente. Hay un banco de pruebas en `/estilo` (no se publica: en producción
esa ruta no existe) que muestra el mismo pedazo de sitio en varias direcciones
visuales, con fotos reales, para elegir mirando.

**Hay dos azules a propósito.** `--color-accent` es el claro, para textos y
bordes sobre el fondo oscuro; `--color-accent-solid` es el fuerte, para el
relleno de los botones con texto blanco encima. Ningún tono único hace bien los
dos trabajos sin perder contraste. Cambiar uno sin el otro rompe la legibilidad.

**El hover se marca con la variante `con-mouse`.** Un teléfono no tiene "pasar
el mouse por encima": lo que se revele con hover y no lleve esa variante queda
escondido para siempre en el celular. Ya pasó una vez —el botón "Agregar" de la
galería no aparecía nunca en el teléfono— y por eso existe la variante.

**La miniatura se mide por el ancho y la foto grande por el lado más largo.**
No es un descuido: la grilla le da a cada foto una columna del mismo ancho, así
que ahí igualar el ancho es lo que las deja parejas de nitidez; el lightbox, en
cambio, muestra la foto entera dentro de la pantalla, y midiendo por el ancho
una vertical se llevaba más del doble de píxeles que una horizontal para ocupar
menos lugar. Misma idea —que ninguna reciba más que otra para cómo se muestra—,
distinta forma de mostrar.

**Los escalones del descuento se configuran desde el panel** y se guardan en
`Ajuste` como `"3:14,5:20,10:31,15:37"`. Los lee el layout una sola vez y se los
pasa al carrito, porque el carrito vive en todas las pantallas. Si esa fila
falta o quedó ilegible salen los valores por defecto: el sitio nunca se queda
sin una tabla válida. Al guardar se normaliza —se ordena, se sacan repetidos y
se acota el porcentaje a 70— así lo guardado y lo usado para cobrar pasan por el
mismo filtro.

**El descuento por cantidad se calcula en un solo archivo,
`src/lib/descuentos.ts`, sin `server-only`.** Lo usa el navegador para mostrar
cuánto se ahorra y el servidor para cobrar: si fueran dos cuentas distintas, un
día no coincidirían. Lo que se cobra lo decide igual el servidor, con los
precios de la base. A MercadoPago se le manda una línea por foto, así que el
descuento se reparte entre esas líneas y la diferencia de redondeo se acomoda en
la última para que el total cierre al peso.

**Un partido con fotos vendidas no se borra.** El renglón de la orden apunta a
la foto con `onDelete: Restrict`, así que la base lo impide sola; el panel lo
chequea antes nada más que para explicarlo en vez de reventar. Alguien pagó esa
foto y su link de descarga tiene que seguir andando. Se puede despublicar.

**Al borrar un partido va primero la base y después los archivos.** Al revés, si
la base fallara, quedaría un partido con las fotos rotas. En este orden lo peor
que puede pasar es que sobren archivos en el bucket, que no molestan a nadie.

**La portada va sin marca de agua, a propósito.** Es lo que invita a entrar y
con la marca encima no invita. El riesgo se acota por tamaño: sale a 500 px y
con la misma compresión que una miniatura, o sea una sola foto chica por
partido. Agrandarla o mejorarle la calidad sería regalar una foto de verdad.

**Hay cuatro imágenes limpias, y cada una tiene su medida por un motivo.** La
portada del partido (500 px), las del portfolio (900 px), la tapa del sitio
(1920 px, calidad 60) y el retrato de Santi (1400 px), todas en
`src/lib/watermark.ts`. La medida sale de para qué sirve cada una, no de un
número parejo: la portada es una miniatura que invita a entrar; el portfolio le
tiene que demostrar el nivel a un organizador, y a 500 px no demostraba nada; la
tapa se ve de lado a lado de la pantalla, y a 1000 px se estiraba al doble y
salía borrosa en cualquier monitor de escritorio —una tapa borrosa es peor que
no tener tapa—; el retrato es la única sin límite real, porque no está a la
venta. Subirle el tamaño a la portada o al portfolio sí es regalar una foto.

**La tapa se publica dos veces, con dos recortes distintos de la misma foto.**
Una franja apaisada (1920×800) para escritorio y un rectángulo alto (1080×1440)
para el celular. No son dos tamaños de lo mismo: dejando recortar al navegador
—que corta siempre por el centro— en el teléfono aparecía el pasto y la jugada
quedaba afuera. Santi acomoda cada recorte en `/admin/contenido`, arrastrando y
acercando la foto dentro de un recuadro que tiene el degradado y el título
encima, así que ve exactamente lo que se va a publicar.

Las cuentas del encuadre viven en `src/lib/encuadre.ts`, **sin `server-only`**,
por el mismo motivo que los descuentos: las usa el editor del panel para dibujar
la previsualización y el servidor para recortar de verdad. Si fueran dos
cuentas, un día dejarían de coincidir y lo que Santi acomoda no sería lo que
sale. El recorte se guarda en fracciones (0 a 1), no en píxeles, para que siga
valiendo si la foto se reprocesa con otra medida.

**El alto del encabezado es un mínimo, no una proporción fija.** Sale de la
misma proporción con la que se encuadró (`min-h-[133.33vw]` en el celular,
`md:min-h-[41.67vw]`), pero como mínimo: con una proporción fija, un titular
largo no agrandaba la sección sino que se salía por arriba y quedaba cortado
abajo del logo. Que el recorte muestre un poco más de foto no se nota; un
título cortado, sí.

**La tapa y el retrato guardan su archivo de origen en el bucket privado**
(`sitio-originales/`, anotado en `hero.origenKey` y `sobre.origenKey`). Sin eso,
cambiar la medida obligaba a pedirle a Santi que volviera a subir la imagen,
porque de lo subido sólo quedaba la versión ya achicada. Pasó una vez, al
corregir la tapa borrosa. Cuando la tapa se elige desde una foto de un partido,
el origen es el original de esa foto. Es además lo que permite acomodar el
recorte sin volver a subir nada: el panel se la pide al servidor por
`GET /api/admin/contenido/imagen?campo=tapa`, que la sirve desde el bucket
privado y sólo a Santi.

**Los textos del sitio los escribe Santi desde el panel, no viven en el
código.** Están en `src/lib/contenido.ts`, guardados en la tabla `Ajuste` —una
fila por texto—, y se editan en `/admin/contenido`. La regla que ordena todo
eso: **lo que está vacío no se muestra**. La sección entera desaparece en vez de
salir con relleno, así el sitio nunca promete algo que Santi no dijo. Sumar una
sección nueva es sumar una clave en `CLAVES` y un `<textarea>` con ese nombre;
no hay que migrar la base ni tocar el home.

**La sección para organizadores y marcas es una puerta que Santi quiere abrir,
no un servicio que ya presta.** Por eso sale vacía de fábrica y la escribe él:
el sitio no puede prometer una cobertura con entrega en tiempo real que nunca se
hizo. Es, igual, el camino para dejar de depender de vender foto por foto.

**La tapa y el retrato se suben achicados desde el navegador.** El mismo motivo
que las fotos de los partidos: Vercel rechaza cualquier petición de más de
4,5 MB. Como acá es una sola imagen, alcanza con achicarla en el navegador antes
de mandarla (`subir-imagen.tsx`); el servidor la vuelve a procesar igual, porque
es lo único que garantiza con qué medida sale al aire.

**El panel es un tablero de tarjetas, no una página larga.** `/admin` sólo tiene
las tarjetas —partidos, ventas, contenido, ajustes— con el número que importa de
cada una; cada apartado vive en su propia pantalla (`/admin/partidos`,
`/admin/ventas`, `/admin/ajustes`). Antes era todo una sola página y había que
scrollear a ciegas. Al sumar un apartado nuevo, va como pantalla propia y tarjeta
en el tablero, no apilado abajo de lo que ya está.

**El Instagram del comprador es opcional y tiene que seguir siéndolo.** Se pide
en el carrito aclarando que las fotos llegan por mail igual, y sirve sólo para
etiquetarlo al publicar. La razón es la misma por la que no hay cuentas de
comprador: cada campo obligatorio antes de pagar es un motivo más para no pagar.

**Nada del sitio se desplaza en horizontal:** `html` y `body` van con
`overflow-x: clip`. La cinta del portfolio se dibuja con el ancho de la ventana
y ese ancho incluye la barra de scroll, así que sobraban siete píxeles por lado
y la portada entera se corría. Va `clip` y no `hidden` porque `hidden` convierte
al body en un contenedor de scroll y rompe todo lo que se queda pegado.

**Las animaciones siguen una regla corta: lo que entra o sale va con
`ease-out`, lo que se mueve en pantalla con `ease-in-out`, un color con `ease`,
y lo que se repite todo el día no se anima.** Las de interfaz duran menos de
300ms; la aparición al scrollear dura 500ms porque acompaña al scroll en vez de
responder a un clic. Todo lo animado es `transform` u `opacity` —lo demás obliga
al navegador a recalcular la página en cada cuadro— y todo tiene su salida por
`prefers-reduced-motion`.

**La aparición al scrollear (`aparecer.tsx`) también revela lo que el scroll se
saltea.** Un `IntersectionObserver` solo no alcanza: entrando con un ancla o
recargando a media página, una sección pasa de estar abajo a estar arriba sin
haber sido visible nunca, y quedaba invisible para siempre. Por eso además
escucha el scroll y muestra lo que ya quedó por encima. Y como el estado
escondido se manda desde el servidor, `layout.tsx` lleva un `<noscript>` que
revela todo: sin JavaScript el sitio se lee igual.

**El portfolio es una selección propia, no un marcado de fotos de partidos.**
Vive en su tabla (`PortfolioPhoto`), se sube aparte desde `/admin/portfolio` y
**no está a la venta**. Por eso es la única parte del sitio donde la foto se
publica grande (1600 px) y sin marca de agua: su trabajo es mostrarle el nivel a
un organizador, y una marca encima no muestra nada. Antes salía de marcar fotos
de un partido con una estrella; se cambió porque un portfolio se arma eligiendo,
no reciclando. Sube por el mismo camino en dos pasos que las fotos de un partido
—el original nunca pasa por el servidor— y guarda su original en el bucket
privado para poder rehacer las versiones publicadas.

**La cinta la mueve el JavaScript, y la animación de CSS quedó de respaldo.**
Antes el desplazamiento era CSS puro —más barato, corre sin molestar al resto de
la página—. Se cambió porque el desplazamiento, la lupa y el arrastre con el
dedo tienen que salir de la misma cuenta: si el CSS corre la cinta por su lado y
el JavaScript acomoda las fotos por el suyo, agarrar la cinta con la mano pelea
contra la animación en vez de reemplazarla. La clase `cinta-portfolio` sigue
puesta en el HTML que manda el servidor y el motor se la saca al arrancar, así
que **sin JavaScript la cinta se mueve igual**, como siempre.

El motor está en `cinta-portfolio.tsx`, con las cuentas separadas en
`src/lib/fisheye.ts` (la lupa) y `src/lib/arrastre.ts` (la mano). Ninguno lleva
`server-only`: es aritmética pura y eventos del navegador, sin nada del servidor
adentro.

**La cinta se acerca bajo el mouse en vez de frenarse, y las vecinas se corren
para hacerle lugar.** La foto bajo el puntero crece y las de al lado un poco
menos, cada vez menos con la distancia: responde sin apagar el movimiento, que
era lo que hacía la pausa. Son dos cuentas distintas y las dos salen de la misma
campana: **cuánto crece** cada una es la campana misma; **cuánto se corre** es su
integral, que es la función error (`erf`). Antes sólo estaba la primera y las
fotos se montaban unas sobre otras al crecer; por eso el acercamiento tenía que
quedarse corto, y ahora puede ser el doble.

**El aire de arriba y abajo de la cinta sale del acercamiento.** La foto crece
para los cuatro lados, no sólo a los costados: si el marco no tiene lugar para
lo que crece a lo alto, el borde le corta la cabeza y los pies justo a la foto
que se está mirando. El `paddingBlock` de la fila se calcula del mismo número
que la lupa (`--alto-cinta * ACERCAMIENTO / 2`), así que están atados: subir el
acercamiento agranda el aire solo. Pasó una vez —el acercamiento se duplicó y el
aire quedó con la medida vieja— y por eso ahora es una cuenta y no un número
puesto a mano.

**El empuje está calculado, no elegido a ojo.** Es el único número de todo esto
que no se puede tantear: si se queda corto las fotos se montan y si se pasa
salen disparadas. `empujeSinSolapes()` lo deriva del ancho de las fotos, de qué
tan apretadas están y del ancho de la lente —la cuenta está escrita ahí—, así
que sale bien solo en cualquier tamaño de pantalla. El componente del que salió
esta cinta usaba un número fijo, y con él las fotos se montaban unos treinta
píxeles.

**El motor mide una sola vez.** Guarda dónde nace cada foto en la fila y cuánto
mide, y después cada cuadro es sólo aritmética. La versión anterior le
preguntaba al navegador la posición de cada foto en cada cuadro, que lo obliga a
recalcular la página treinta veces por cuadro. Se vuelve a medir sólo si cambia
el tamaño de la ventana, porque el alto de las fotos cambia por breakpoint y con
él cambia todo lo demás.

**El desplazamiento se escribe contra la posición que la foto ya tiene en la
fila**, no contra el principio de la cinta. Por eso, con la cinta quieta en
cero, el motor no escribe nada y lo que se ve es exactamente lo que mandó el
servidor: no hay salto al hidratar.

**Cuidado con apoyarse en una transición de CSS para algo que la lógica
necesita.** `globals.css` le pone `transition-duration: 0.01ms !important` a
*todo* cuando el sistema pide menos movimiento. El apagado de la capa del vuelo
usaba una transición y ahí se cumplía de golpe: la foto desaparecía antes de que
React dibujara lo de abajo y quedaba el cuadro vacío. Por eso ese apagado va
escrito a mano, cuadro a cuadro. **El síntoma es cruel de encontrar**: en una
máquina sin la preferencia puesta no pasa nunca, así que se ve en la Mac o el
teléfono de quien la tiene y no en el navegador donde uno prueba.

**La cinta es la única parte del sitio que ignora la preferencia de menos
movimiento.** Se desplaza, se acerca bajo el puntero y la foto vuela igual,
aunque el sistema pida lo contrario. Lo pidió Santi el 10 de septiembre de 2026,
después de que se le explicara que quien activa esa preferencia muchas veces lo
hace porque el movimiento le provoca mareo, y que la cinta es lo más grande que
se mueve en el sitio. Queda anotado para que el que lo encuentre sepa que **no
es un olvido**: el resto del sitio sí la respeta.

Son dos lugares y hay que tocar los dos: el motor de `cinta-portfolio.tsx`, que
directamente no consulta la preferencia, y una regla en `globals.css` que le
devuelve la duración a la animación de respaldo —el bloque global le pone
`animation-duration: 0.01ms !important` a todo, así que sin esa excepción la
cinta daba una vuelta entera en una centésima de segundo—.

Un tiempo hubo en el motor un `return` cuando la preferencia estaba puesta, y
eso dejaba la cinta completamente muerta: no se movía, no respondía al puntero y
tampoco se podía recorrer, porque el `overflow-hidden` del marco tapaba el
scroll que el CSS dejaba de respaldo. Media docena de fotos congeladas y sin
salida.

**Con la cinta fuera de pantalla el bucle se apaga entero.** En la portada la
cinta está bien abajo: sin esto, todo el rato que alguien pasa leyendo arriba
serían sesenta cuadros por segundo calculando algo que nadie ve.

**El puntero se captura recién cuando el gesto se confirma como arrastre, no
al apoyar el dedo.** Es la trampa más cara de toda esta parte: capturando en el
`pointerdown`, el `click` que viene después ya no le llega al botón de la foto
—se lo queda la cinta, que es quien capturó— y **tocar una foto dejaba de
abrirla**. Cuesta encontrarlo porque un `.click()` disparado por código se
saltea todo eso y anda perfecto: sólo falla el clic de una mano de verdad. Así
que la captura se pide en el primer `pointermove` que pasa el umbral, que es
además cuando sirve: para que el gesto siga siendo nuestro aunque el dedo se
vaya de la cinta. **Si algo de esto se toca, hay que probarlo clickeando de
verdad, no con `.click()`.**

**La cinta se puede arrastrar con el dedo o con el mouse, y sigue de largo al
soltar.** Frena por fricción y espera un segundo antes de volver a andar sola,
porque sin esa pausa arranca encima del dedo que la acaba de acomodar. Un tirón
no abre ninguna foto: por debajo de seis píxeles de recorrido es un toque, por
encima es un arrastre. Va con Pointer Events —un solo juego de eventos para
dedo, mouse y lápiz— y el marco lleva `touch-action: pan-y`, que le dice al
navegador "el movimiento horizontal lo manejo yo, el vertical es tuyo": con eso
se puede arrastrar la cinta de costado y seguir scrolleando la página con el
mismo dedo.

**La foto vuela entre la cinta y el visor en vez de aparecer en el centro.** Es
la técnica que se llama FLIP y está en `vuelo-foto.tsx`. El recorrido es lo que
dice *cuál* de todas las fotos se abrió, que en una cinta en movimiento no es
obvio. Tres decisiones que importan:

- **Al cerrar, el destino se relee en cada cuadro.** La cinta se pone a andar de
  nuevo apenas empieza el cierre —a propósito—, así que la tarjeta a la que hay
  que volver se está moviendo. Esto es lo único que no se puede hacer con una
  transición de CSS, que necesita saber el punto final desde el principio.
- **Vuelve a la copia visible más cercana al centro, no a la tarjeta que se
  tocó.** Esa puede haberse ido de pantalla mientras la foto estaba abierta.
  Como todas las copias muestran la misma imagen, volver a cualquiera es igual
  de cierto. Y si **ninguna** se ve —una vuelta de la cinta es varias veces más
  ancha que la pantalla, así que es lo normal—, la foto se apaga en el lugar en
  vez de irse hacia un punto fuera de la pantalla, que se leería como que se
  escapó. El corte de "se ve" va bajo a propósito, un octavo de la foto: volver
  a una medio salida sigue siendo mejor que apagarse en el aire, porque se
  entiende adónde fue. Con un corte de un tercio, la mitad de los cierres
  terminaban sin vuelo y esa mitad se veía como que la foto se esfumaba.
- **Mientras la foto está afuera, su lugar en la cinta queda vacío.** La
  tarjeta se esconde al abrir y se devuelve recién cuando la foto terminó de
  volver. Sin esto se ven las dos a la vez —la que vuela y la que sigue en la
  fila—, y eso es lo que se lee como un parpadeo: dos copias de la misma foto,
  una moviéndose y otra quieta. En el escritorio era peor, porque al abrir se
  apaga la lupa y la de la fila se desinflaba justo mientras la otra crecía. Va
  con `visibility` y no con `opacity` porque no cambia el lugar que ocupa: el
  vuelo de vuelta le sigue preguntando dónde está, cuadro a cuadro.
- **A qué copia vuelve se decide una sola vez, al empezar el cierre.** Lo que se
  relee en cada cuadro es dónde está esa copia, que es lo que se mueve. Si se
  recalculara cuál, un empate entre dos copias la haría saltar de una a la otra
  en pleno viaje.
- **El relevo nunca puede dejar un instante sin foto.** Es *la* regla del
  vuelo, y es la que costó tres intentos. En este baile hay tres fotos que se
  pasan la posta —la tarjeta de la cinta, la capa que vuela y la foto del
  visor—, y en cada cambio de mano hay que **destapar la que entra antes de
  tapar la que sale**. Al revés queda un cuadro con ninguna a la vista, y
  dieciséis milésimas de segundo en negro se ven perfectamente: se lee como si
  la imagen bajara a opacidad cero y volviera. Los tres relevos:
  - **La capa aparece antes de que se escondan las otras.** Un `<img>` recién
    puesto en la página no pinta hasta que el navegador lo decodifica, aunque el
    archivo ya esté en su memoria. Así que la capa avisa cuando dibujó su primer
    cuadro, y recién ahí se esconden la tarjeta (al abrir) o la foto del visor
    (al cerrar). Como la capa arranca justo encima de la que reemplaza, la
    superposición de un cuadro no se ve.
  - **Lo de abajo se destapa al aterrizar, no cuando la capa termina de irse.**
    La capa se queda unos 110ms apagándose sobre el destino, y ese apagado tiene
    que caer encima de algo que ya se vea: al abrir, la foto del visor; al
    cerrar, la tarjeta de la cinta. Destapando al final, la capa llegaba a
    opacidad cero sobre un hueco.
  - **El visor se desmonta al aterrizar, mientras la capa todavía tapa.** Su
    fondo desenfocado es lo más caro de sacar, y ese ratito de apagado es el que
    tapa el momento.
- **Las flechas de anterior y siguiente no se ven en el celular.** La pantalla
  es angosta y caen justo encima de la foto, tapándole los costados. Ahí se pasa
  de foto cerrando y abriendo otra.
- **De ida vuela la miniatura y de vuelta la grande.** La miniatura ya está
  cargada, así que el vuelo arranca en el mismo instante del clic; con la grande,
  un clic sobre una foto todavía sin descargar volaría un rectángulo vacío. Al
  cerrar es al revés: la grande ya estuvo en pantalla todo ese rato, y cambiarla
  por la chica se vería como un bajón de calidad en el primer cuadro.

El vuelo es una interpolación pura de posición y tamaño porque las dos cajas
tienen la misma proporción: en el portfolio nada se recorta, ni en la cinta ni
en el visor. Si una recortara y la otra no, habría que interpolar además el
encuadre.

**El motor de la cinta se generalizó a fotos de anchos distintos.** El
componente de referencia asumía tarjetas todas iguales y posicionaba cada una en
`índice × paso`. Acá cada foto conserva su proporción y ninguna se recorta, así
que las posiciones son acumuladas. Es la misma matemática; lo que no se puede es
volver a asumir un ancho fijo sin romper esa regla del portfolio.

**El `<noscript>` va dentro del `<body>`.** Suelto como hijo de `<html>` rompe
la hidratación: ahí sólo pueden ir `head` y `body`.

**La cinta del portfolio no lleva `will-change`.** Sería lo esperable para algo
que se mueve, pero son treinta y pico de fotos moviéndose a la vez y dejarlas a
todas permanentemente en una capa de la placa de video es reservar mucha memoria
para nada; una animación de `transform` ya se compone sola. Medido en
desarrollo, la cinta con la lupa activa corre a la velocidad del monitor sin
perder un solo cuadro, así que no hace falta. Sus fotos se cargan de
entrada aunque estén fuera de pantalla —al revés de lo habitual— porque van a
entrar solas en segundos y esperar a que sean visibles dejaría huecos blancos
mientras avanza. Por eso el portfolio está acotado a 16 fotos: el tope es de
peso, no estético.

**La grilla de fotos reparte siempre desde la primera.** Cada foto va a la
columna más corta mirando sólo las anteriores, así al traer más fotos las que ya
estaban caen en el mismo lugar. Si se dejara balancear las columnas al navegador
(`columns` de CSS), cada "Cargar más" movería de lugar todo lo de arriba justo
cuando el comprador lo está mirando.

**Toda acción contesta enseguida, aunque el resultado tarde.** Es la regla que
salió de que Santi sintiera el sitio "colgado": un botón que no cambia al
apretarlo, o un cambio de pantalla sin ninguna marca, se vive como una demora
aunque tarde exactamente lo mismo que antes. Nada de lo que sigue acelera nada;
todo contesta. Son tres piezas:

- **`loading.tsx` en cada pantalla que consulta la base** (la portada, el
  partido, el carrito, la compra, el portfolio, los legales y todo el panel).
  Con esto la pantalla cambia en el acto y muestra la silueta de lo que viene
  —los bloques grises de `huecos.tsx`— mientras el servidor trabaja. Es lo que
  más se nota de todo esto. **Un hueco tiene que tener la forma de lo que va a
  llegar**: si es de cualquier tamaño, al entrar el contenido real todo salta de
  lugar y se lee peor que una pantalla en blanco. Por eso los legales tienen su
  propia espera y no la de la portada, que dibuja la foto grande del encabezado.
- **`senal-link.tsx`** para el instante anterior, en tres formas: un punto que
  late al lado del texto (`SenalDeLink`), un velo sobre la tarjeta entera
  (`VeloDeLink`) o el propio contenido latiendo sin agregar nada
  (`LatidoDeLink`). Usan `useLinkStatus` de Next, así que tienen que ir
  **adentro** de un `<Link>`. Las tres arrancan invisibles y con 120ms de
  retraso puesto en el CSS: si la pantalla ya estaba traída de antemano el
  cambio es instantáneo y la señal no llega a verse, que es lo que corresponde.
  **`SenalDeLink` reserva su lugar aunque no se vea** —si no, aparecería de la
  nada y empujaría el texto—, así que dentro de una caja con el padding parejo
  descentra lo que hay adentro. Ahí va `LatidoDeLink`, que no ocupa lugar.
- **`boton-envio.tsx` y `boton-envio-nativo.tsx`** para los formularios. El
  primero usa `useFormStatus` y sirve para las acciones de servidor; el segundo
  escucha el evento de envío del formulario y es para los que van derecho a la
  API (`method="POST" action="/api/..."`), donde React no se entera de nada y
  `useFormStatus` devuelve siempre "quieto". El nativo **no** usa `disabled`:
  apagar el botón dentro del mismo evento que lo envía puede llegar a impedir el
  envío según el navegador, así que le saca el puntero y le baja la opacidad.

Al sumar un botón o un link nuevo, la pregunta es qué muestra entre el clic y el
resultado. Si la respuesta es "nada", falta la señal.

**El carrito del encabezado es un ícono, no la palabra.** Un carrito se
reconoce de un vistazo, que es lo que hace falta en una barra que está en todas
las pantallas, y la caja le queda pareja de los dos lados: con la palabra
adentro, el punto de espera le comía el lugar de un costado y el texto quedaba
corrido. La palabra sigue estando en el `aria-label`, junto con cuántas fotos
hay, para quien no ve el dibujo. El número al lado es lo único que cambia de
ancho, y el saltito al cambiar es a propósito: es lo que confirma, desde la otra
punta de la pantalla, que la foto entró.

## Cosas que muerden

- **En Windows, `npm run build` falla si el dev server está corriendo**: tiene
  tomado el binario de Prisma. Hay que pararlo primero.
- Los scripts de `scripts/` necesitan `npx tsx --conditions=react-server
  --env-file=.env`. Sin `--conditions` el paquete `server-only` corta la
  ejecución.
- La dirección de aviso a MercadoPago **no puede redirigir**: no siguen
  redirecciones y el aviso se pierde en silencio.
- **Las fotos públicas se suben con caché de un año y marcadas `immutable`.** Es
  lo correcto para algo que no cambia nunca, pero significa que pisar el mismo
  archivo no sirve de nada: Cloudflare y los navegadores siguen mostrando la
  versión vieja durante meses. Ya pasó al bajar la calidad de las
  previsualizaciones. Por eso el reprocesado escribe en una dirección nueva,
  mueve la base y recién ahí borra la vieja. No hay token de Cloudflare en el
  proyecto, así que purgar el caché no es una opción.

## Comandos

```bash
npm run dev                                                    # levantar en local
npx tsx --conditions=react-server --env-file=.env scripts/revision-general.ts
```

Cuando se cambia algo del procesamiento de fotos —la intensidad de la marca, el
tamaño o la calidad de la previsualización— eso sólo se aplica a las fotos que se
suban después. Para las que ya están online:

```bash
npx tsx --conditions=react-server --env-file=.env scripts/rehacer-previsualizaciones.ts
```

Sin `--aplicar` es un ensayo y no escribe nada. Acepta `--partido=<slug>`.

Lo mismo, pero para las imágenes limpias del sitio (la tapa, el retrato y las
fotos del portfolio), cuando se cambia alguna de sus medidas:

```bash
npx tsx --conditions=react-server --env-file=.env scripts/rehacer-imagenes-del-sitio.ts
```

`scripts/cambiar-direccion.ts` cambia la dirección de un partido. Sin argumentos
lista las actuales. La dirección vieja deja de responder en el acto, así que no
se usa con un partido ya compartido.

`scripts/resetear-ventas-de-prueba.ts` borra **todas** las órdenes, para dejar
el contador en cero antes de vender de verdad. Sirve además para desbloquear el
borrado de un partido de prueba: una foto comprada no se puede borrar, y por eso
tampoco su partido. No correrlo si ya hay ventas reales.

`revision-general.ts` verifica todo el sistema en producción de una: sitio, CDN,
que los originales no se filtren, avisos firmados y sin firmar, panel protegido,
descarga de una compra pagada, y en qué cuenta de MercadoPago está cobrando.
Hay más scripts en `scripts/`, cada uno con su explicación arriba.

`scripts/datos-de-prueba.ts` crea un partido ("CAT vs Lastenia") con 14 fotos
sintéticas generadas en el momento, para tener algo con qué probar el sitio en
la base de desarrollo. Se puede correr las veces que haga falta: primero borra
el partido anterior con ese mismo nombre, si existe.

Cuando el esquema de la base cambia (un campo nuevo, una tabla nueva), después
de publicar el código hace falta avisarle a la base real:

```bash
npm run migrar:produccion
```

## Estado

**El sitio está en producción y vendiendo.** Santi confirmó que la plata entra a
su cuenta. Funciona de punta a punta: subir fotos, marca de agua, galería,
carrito, pago, acreditación automática, descarga y mail al comprador.

Ya subió su primer partido real ("Bayern vs Drink", 60 fotos). El partido de
prueba "CAT vs Lastenia", con fotos sintéticas, quedó despublicado — no se puede
borrar porque tiene fotos vendidas en órdenes de prueba, y el esquema protege eso
a propósito.

El 10 de septiembre de 2026 se le puso al sitio entero la señal de "ya te
escuché": pantallas de espera con la forma de lo que viene, punto de espera en
los links, y todos los botones y formularios contestando el clic. El mismo día
se rehizo la cinta del portfolio con el motor nuevo: lupa con repulsión,
arrastre con el dedo e inercia, y la foto volando entre la cinta y el visor.
Las dos cosas se publicaron ese día. Santi subió además las fotos del portfolio
y escribió los textos del sitio, todo desde el panel de producción.

En septiembre de 2026 se publicó además el sitio de fotógrafo: encabezado con
foto encuadrable por pantalla, cómo funciona, quién soy, servicios para
organizadores, portfolio propio con página aparte, WhatsApp y legales; el panel
partido en tarjetas; las ventas mostrando qué fotos se compraron; el Instagram
opcional del comprador; y las animaciones de entrada al scrollear.

Antes de eso se rediseñó y se publicó: fondo oscuro con azul,
tipografías Inter Tight e Inter, grilla sin recortes, visor con deslizamiento,
marca de agua e intensidad regulables, portada elegible, precio editable,
descuento por cantidad configurable y borrado de partidos.

Las ventas de prueba se borraron y el partido de prueba también, así que la base
quedó con un solo partido —el real— y el contador en cero. **Lo que entre desde
ahora es plata de verdad.**

Una orden pendiente **no es una alarma**: casi siempre es un checkout abandonado.
Lo grave es la que esconde un pago aprobado. Para distinguirlas:

```bash
npx tsx --conditions=react-server --env-file=.env scripts/revisar-pendientes.ts
```

## Qué falta

Ya está todo publicado. Lo que queda:

1. **Lo bueno está en producción, no en desarrollo.** El 10 de septiembre de
   2026 Santi subió las fotos del portfolio y escribió los textos del sitio
   **directamente desde el panel de producción**. La base de desarrollo sigue
   con las siete fotos sintéticas y los textos viejos.

   De eso sale una advertencia: **`scripts/copiar-contenido.ts` copia de
   desarrollo a producción, así que correrlo ahora le pisaría a Santi todo lo
   que escribió.** Servía cuando él probaba en local y había que subir el
   resultado; ahora el flujo es al revés. Antes de usarlo, preguntar.

   Lo mismo vale para cualquier script que escriba en la base real: la copia de
   verdad del contenido y del portfolio vive ahí y no hay otra.
2. **Por qué se crearon seis partidos duplicados.** Ya se borraron, pero la
   causa sigue ahí: lo más probable es que el formulario de "Nuevo partido" no
   dé señal de que ya se envió y se pueda apretar dos veces.
3. **Queda un solo aviso de lint**, en `cart-context.tsx`: el carrito lee el
   `localStorage` dentro de un efecto y llama a `setState` ahí mismo. Es un caso
   legítimo —leer un almacén del navegador al montar—, pero la regla nueva de
   React lo marca igual. Arreglarlo bien es pasarlo a `useSyncExternalStore`, y
   eso toca el carrito, que es lo más delicado del sitio: no vale la pena
   hacerlo de apuro. Los 12 avisos de la galería, en cambio, ya no están:
   `filtrando` pasó de `useRef` a estado, que era lo que correspondía porque de
   eso depende lo que se dibuja.

Sobre los descuentos, para tener presente: los porcentajes que eligió Santi
(14 / 20 / 31 / 37) salen de pensar en **precios redondos por pack**, no en
porcentajes. Con la foto a $3.500 dan packs de $9.030, $14.000, $24.150 y
$33.075. Por eso el panel muestra, al lado de cada escalón, cuánto sale el pack:
es la cifra en la que se piensa. Al cambiar el precio por foto los packs se
mueven, así que conviene pasar por el panel después.

4. **Los reembolsos no existen en el sitio.** Si Santi devuelve la plata desde
   MercadoPago, la orden sigue figurando pagada y el link de descarga sigue
   andando para siempre. Falta atender el aviso de `refunded` / `charged_back`
   y decidir qué pasa con la descarga de una orden devuelta. Todavía no pasó
   ninguna devolución.

5. **Falta medir lo que tarda de verdad.** Santi dijo el 10 de septiembre de
   2026 que el sitio se sentía más lento y que no avisaba que lo escuchó. Eran
   dos cosas distintas. La segunda ya está hecha: todo el sitio contesta el
   clic (ver "Toda acción contesta enseguida" más arriba). Queda la primera, y
   **hay que medir antes de tocar nada**: qué pantallas tardan y en qué se va
   el tiempo. Sospechosos conocidos: `/compra/[token]` le pregunta a
   MercadoPago antes de dibujar nada cuando la orden está pendiente —eso ahora
   al menos se ve, porque su pantalla de espera lo explica, pero sigue
   tardando—; el home es `force-dynamic` en varios lados y consulta la base en
   cada visita; la cinta del portfolio carga sus fotos de entrada a propósito.
   El `layout.tsx` hace dos consultas antes de dibujar nada, y **eso ningún
   `loading.tsx` lo tapa**: en la primera carga de una pantalla la navegación
   espera a que el layout termine. Es el primer lugar donde mirar.

6. Ideas para más adelante: búsqueda por selfie o por dorsal, "mis compras" con
   cuenta, aviso al jugador cuando se suben sus fotos, y la tarjeta de "pack
   completo" que quedó afuera del documento de ofertas porque depende de esos
   filtros.
