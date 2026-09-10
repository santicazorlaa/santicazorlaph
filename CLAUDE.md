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

**La cinta se acerca bajo el mouse en vez de frenarse.** La foto que está abajo
del puntero crece y las vecinas un poco menos, cada vez menos con la distancia:
responde sin apagar el movimiento, que era lo que hacía la pausa. El cálculo
toca los estilos directamente, sin pasar por el estado de React —corre en cada
cuadro— y lee todas las posiciones antes de escribir ninguna escala, porque
mezclar lecturas y escrituras obliga al navegador a recalcular la página una vez
por foto. Se pinta en el propio evento del puntero además de por cuadro, así el
efecto no depende de que el próximo cuadro llegue a tiempo.

**El `<noscript>` va dentro del `<body>`.** Suelto como hijo de `<html>` rompe
la hidratación: ahí sólo pueden ir `head` y `body`.

**La cinta del portfolio no lleva `will-change`.** Sería lo esperable para algo
que se mueve, pero la pista mide varios miles de píxeles de ancho y dejarla
permanentemente en una capa de la placa de video es reservar mucha memoria para
nada; una animación de `transform` ya se compone sola. Sus fotos se cargan de
entrada aunque estén fuera de pantalla —al revés de lo habitual— porque van a
entrar solas en segundos y esperar a que sean visibles dejaría huecos blancos
mientras avanza. Por eso el portfolio está acotado a 16 fotos: el tope es de
peso, no estético.

**La grilla de fotos reparte siempre desde la primera.** Cada foto va a la
columna más corta mirando sólo las anteriores, así al traer más fotos las que ya
estaban caen en el mismo lugar. Si se dejara balancear las columnas al navegador
(`columns` de CSS), cada "Cargar más" movería de lugar todo lo de arriba justo
cuando el comprador lo está mirando.

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

1. **El portfolio de producción está vacío.** Es lo único que falta para que el
   sitio nuevo se vea entero: Santi tiene que subir sus mejores fotos desde
   `/admin/portfolio`. Sin eso, la cinta de la portada y la página `/portfolio`
   no aparecen. En la base de desarrollo hay siete fotos sintéticas de prueba
   para mirar cómo queda. Falta también elegir la portada de cada partido.

   Los textos del sitio ya se copiaron a la base real con
   `scripts/copiar-contenido.ts`, que es el camino cada vez que Santi escriba
   algo probando en local.
2. **Por qué se crearon seis partidos duplicados.** Ya se borraron, pero la
   causa sigue ahí: lo más probable es que el formulario de "Nuevo partido" no
   dé señal de que ya se envió y se pueda apretar dos veces.
3. **La galería arrastra 12 avisos de lint** por leer un `useRef` durante el
   render (`filtrando` en `src/components/gallery.tsx`). Es viejo, no rompe
   nada, pero conviene limpiarlo.

Sobre los descuentos, para tener presente: los porcentajes que eligió Santi
(14 / 20 / 31 / 37) salen de pensar en **precios redondos por pack**, no en
porcentajes. Con la foto a $3.500 dan packs de $9.030, $14.000, $24.150 y
$33.075. Por eso el panel muestra, al lado de cada escalón, cuánto sale el pack:
es la cifra en la que se piensa. Al cambiar el precio por foto los packs se
mueven, así que conviene pasar por el panel después.

4. Ideas para más adelante: búsqueda por selfie o por dorsal, "mis compras" con
   cuenta, aviso al jugador cuando se suben sus fotos, y la tarjeta de "pack
   completo" que quedó afuera del documento de ofertas porque depende de esos
   filtros.
