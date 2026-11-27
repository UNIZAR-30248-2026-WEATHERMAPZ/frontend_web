# WeatherMapZ Frontend

Frontend de WeatherMapZ con React + Vite.

## Requisitos

- Node.js 22 o superior
- npm

## Instalación

```bash
npm install
cp .env.example .env
```

## Desarrollo

```bash
npm run dev
```

El servidor de desarrollo se sirve en <http://localhost:5173>. Desde la PBI-4 la aplicación pide
iniciar sesión, así que el backend tiene que estar arrancado (con `JWT_SECRET` y las migraciones
aplicadas) para poder entrar.

## Tests

```bash
npm test
```

## Test de extremo a extremo (#161)

Un test con Playwright recorre el flujo principal en un Chromium real: crear una cuenta, responder
«Evitar el viento» y +10 minutos, cerrar sesión y volver a entrar y encontrarlas (PBI-18), elegir
origen y destino con el autocompletado, calcular la ruta más rápida (todo en «Me da igual») y
después la de «Según el tiempo», con su motivo y la comparación «Tu ruta» / «La más rápida». Decisión: ADR-034 del `docs/DECISIONS.md`
del workspace.

```bash
npm run e2e:install   # una vez: descarga Chromium para Playwright
npm run e2e           # prepara la base de datos y ejecuta el test
npm run e2e:check     # ESLint y Prettier de la carpeta e2e/
```

Qué se levanta (todo en `e2e/`):

- **Backend real**, desde `../backend` (o la ruta de `BACKEND_DIR`), en el puerto 3100. Necesita
  `npm ci` en el backend y PostGIS arrancado (`docker compose up -d db` en el backend).
- **Base de datos propia**, `weathermapz_e2e`, que `prepare-database.js` borra y crea en cada
  ejecución: migraciones, un mini-dataset de 5 tramos, un edificio, 3 árboles y un parque
  (`scenario.js`) y los mismos precálculos que producción (`associate`, `compute:vegetation` y
  `compute:openness`). Usa el usuario y la contraseña del `.env` del backend, o `E2E_DATABASE_URL`.
  Las bases de datos de desarrollo y de test no se tocan.
- **Frontend real** con Vite en el puerto 5174.
- **Servicios externos falsos** (`fake-services.js`, puerto 4010): OpenRouteService (rutas y
  autocompletado) y Open-Meteo, con un tiempo templado y cierzo fuerte para que el motivo de la ruta
  recomendada no dependa de la hora. El backend corre sin clave del asistente, así que no llama al
  modelo de lenguaje. En el navegador, las teselas del mapa se sirven vacías y cualquier otra
  petición fuera del frontend hace fallar el test.

Ninguna clave real llega al test: el backend arranca con `ORS_API_KEY` falsa y el resto de claves
vacías, aunque el `.env` del backend tenga las reales. El backend debe admitir
`OPEN_METEO_BASE_URL`; si no, el test para antes de arrancarlo.

En GitHub Actions lo ejecuta el workflow **E2E** (`.github/workflows/e2e.yml`) en cada pull
request hacia `main`, contra el `main` del backend de la organización y un contenedor
`postgis/postgis:17-3.5`. Si falla, el informe de Playwright con la traza queda como artefacto
durante 7 días.

## Lint

```bash
npm run lint
```

ESLint revisa el proyecto con una configuración plana compatible con Airbnb para las versiones
actuales de ESLint, incluidas las reglas de React Hooks.

## Formato

Formatea el proyecto automáticamente con Prettier:

```bash
npm run format
```

Comprueba el formato sin modificar archivos:

```bash
npm run format:check
```

## Build de producción

```bash
npm run build
```

## Previsualizar el build de producción

```bash
npm run preview
```

## Integración continua

Para ejecutar en local las mismas comprobaciones que GitHub Actions:

```bash
npm run ci
```

Este comando ejecuta ESLint, comprueba el formato con Prettier, lanza todos los tests de Jest y
genera el build de producción. El workflow de GitHub Actions se ejecuta automáticamente en cada
pull request hacia `main`.

## Variables de entorno

- `VITE_API_BASE_URL`: URL base de la API del backend; por defecto `/api`. Vite redirige las
  peticiones locales a `/api` hacia `http://localhost:3000`; `API_PROXY_TARGET` cambia ese destino
  en desarrollo (Compose usa `http://backend:3000`). En producción, el servidor debe redirigir
  `/api` al backend o hay que indicar una URL pública de la API al hacer el build. Nunca pongas una
  clave de un proveedor en una variable `VITE_`.

El inicio de sesión con Google no necesita ninguna variable en el frontend: sus credenciales están
solo en el backend.

## Estructura de carpetas

- `src/app/`: arranque de la aplicación (`App`, proveedores y router).
- `src/components/`: componentes de presentación reutilizables (layout y UI).
- `src/features/`: funcionalidades (mapa, búsqueda de origen/destino, rutas, autenticación...).
- `src/services/`: comunicación con la API del backend y almacenamiento de la sesión.
- `src/styles/`: estilos globales.
- `src/tests/`: configuración y mocks compartidos de Jest.

## Comprobaciones de la PBI-1

- Selecciona origen y destino con el mapa, con las sugerencias de direcciones o con el GPS; mezcla
  métodos.
- Al editar un campo se borra el marcador anterior hasta que se elige otro lugar.
- Clear borra un borrador o un punto; Reset además cancela el GPS pendiente y borra los mensajes.
- El autocompletado empieza a partir de 3 caracteres y 350 ms, con estados de carga, vacío y error.
- Usa las flechas y Enter para elegir una sugerencia; Escape o perder el foco cierra la lista.
- Enter sin ninguna sugerencia resaltada elige la primera (p. ej. «plaza españa» y Enter). Si aún
  se están buscando, espera a que lleguen; si no hay ninguna, sale "No se han encontrado lugares" y
  no se marca nada. Escribir otra cosa, Escape o salir del campo cancelan esa espera.
- Comprueba anchos de 375, 390, 768, 1366 y 1920 px, etiquetas largas y el zoom del navegador.
- El GPS necesita HTTPS o localhost. En un móvil, HTTP normal por la red local mostrará el error de
  contexto no seguro; usa HTTPS para probar el permiso y la ubicación.
- Los marcadores de GPS tienen un círculo de referencia fijo de 50 metros, no una estimación de
  precisión. Corregir un punto en el mapa, Clear y Reset eliminan su círculo.
- El cálculo de rutas queda fuera de la PBI-1 a propósito.
- El mapa no se aleja más que Zaragoza ni se puede arrastrar fuera. Un punto fuera del término
  municipal (del buscador o del GPS) no se marca y sale el aviso "WeatherMapZ solo funciona dentro
  de Zaragoza". Los límites están en `src/features/map/zaragozaArea.js`.

## Comprobaciones de «Mi ubicación» (weathermapz-gestion #178)

El GPS ya no tiene un botón en cada campo: la ubicación se elige con «Mi ubicación», la primera
opción de la lista de cada campo.

- Al enfocar el origen o el destino, también vacíos, se abre la lista con «Mi ubicación» y el icono
  de GPS. Elegirla pide la ubicación como antes; el campo muestra «Mi ubicación» y sale "Se ha
  puesto tu ubicación como origen" (o destino).
- Si un campo ya usa «Mi ubicación», el otro no la ofrece (y al revés). En un campo con un punto
  elegido, enfocarlo vuelve a ofrecer la opción sin buscar su nombre.
- Con el permiso denegado sale "Se ha denegado el acceso a la ubicación... y vuelve a elegir «Mi
  ubicación»" y no se marca nada; los demás errores (sin HTTPS, sin GPS, tiempo agotado, fuera de
  Zaragoza) son los de antes.
- Mientras se obtiene la ubicación la opción aparece desactivada.
- Con 3 caracteres o más la lista pasa a las sugerencias del autocompletado, como antes.
- Teclado: flecha abajo resalta «Mi ubicación» y Enter la elige; Enter sin nada resaltado y sin
  texto no pide la ubicación; Escape cierra la lista.

## Comprobaciones de la Ruta Sombreada en pantallas pequeñas

- La comparación sale compacta; "Ver más" muestra la distancia y la explicación.
- Abrir "Ruta" recoge la comparación y "Ver más" pliega el panel: nunca se pisan.
- Comprueba también el móvil en horizontal (844 x 390).

## Comprobaciones de la meteorología actual (PBI-17)

- Al abrir el mapa, el panel muestra temperatura, velocidad y dirección del viento, condición del
  cielo y hora observada; la atribución enlaza a Open-Meteo.
- Durante la petición aparece un estado de carga. Si falla el endpoint, el aviso explica que el mapa
  y las rutas siguen disponibles.
- Comprueba el panel y la hoja inferior con origen/destino en 375, 390, 768, 1366 y 1920 px, además
  de 844 x 390 en horizontal: no debe aparecer scroll horizontal ni tapar los controles de ruta.
- El endpoint requiere sesión y se consume mediante `src/services/api/weatherApi.js`; si el proveedor
  no entrega `weatherCode`, el panel indica que el estado del cielo no está disponible.

## Comprobaciones del diseño móvil (preguntas en la hoja inferior)

Como en los bocetos del equipo: en pantallas pequeñas (< 900 px) el panel superior solo lleva el
buscador y «Favoritos», y «¿Cómo prefieres ir?» (con «Según el tiempo de hoy» en la misma fila), los
minutos y la fecha van en la hoja inferior, encima de «Limpiar» y «Calcular ruta». En escritorio no
cambia nada.

- Entre el panel y la hoja se ve el mapa (390 × 844: el panel acaba a 242 px y la hoja empieza a
  395 px; 320 × 640: 240 y 348 px). Sin scroll horizontal.
- La hoja se desplaza por dentro y los botones se quedan fijos al pie.
- Un asa arriba de la hoja pliega y despliega las preguntas y la fecha («Ocultar preferencias» /
  «Mostrar preferencias» para lectores de pantalla). Al calcular se pliegan solas.
- «Favoritos» es solo una estrella en la cabecera, entre el nombre y «Ocultar» (el nombre sigue para
  lectores de pantalla). A 320 px se oculta el logo para que quepa todo.
- Al calcular, el panel se pliega y la hoja solo enseña el resultado; «Ruta» vuelve a mostrar las
  preguntas.

## Comprobaciones de la PBI-19 (explicación en lenguaje claro)

El resultado sigue los bocetos «Resultado explicado» y «Ver detalle» (propuesta de la GUI), en móvil
y escritorio, con el `explanation` del backend (ADR-038). Código: `RouteResult.jsx`,
`comfortLevels.js`, `explanationTexts.js` y `LevelBar.jsx` en `src/features/route-comparison/`.

- Cabecera «Tu ruta · 16 min» y «1 min más que la más rápida · 1,3 km».
- Por qué, con un icono por motivo y el principio en negrita: «**Vas a la sombra** por Calle Alfonso
  I…», «**Evitas el viento de cara** de…», «**Pasas junto a estas zonas verdes**: …». Sin calles
  verificables (o con una ruta del asistente) compara en palabras.
- Dos tarjetas («Más rápida · 15 min» y «Tu ruta · 16 min») con lo pedido: «Sombra ●●● Mucha»,
  «Viento ●○○ Poco»… sin números (tercios de 0-100, provisionales). Tocar una la enseña en el mapa.
- En el móvil, «Línea verde: tu ruta · Línea gris discontinua: la más rápida».
- «Ver detalle» despliega «Los datos calculados»: sombra, viento (0-100), verde, duración y distancia
  de las dos rutas.
- Sin ruta mejor: «No hay ningún camino con más sombra sin andar más de 5 min.» y el botón «Probar con
  +10 min», que cambia los minutos y vuelve a calcular; otra hora u otra preferencia, en palabras.

## Comprobaciones de la PBI-21 («Según el tiempo de hoy»)

El tiempo de ahora marca las preguntas de la PBI-18 y explica por qué (ADR-037: ver DECISIONS.md en
la carpeta docs del Drive del equipo). Sustituye a la «Recomendada» de la PBI-9.1: la ruta se calcula
con `POST /api/routes/preferred`, las respuestas marcadas y los minutos de la barra. Código:
`src/features/route-preferences/` y `getWeatherSuggestion` en `src/services/api/routePreferencesApi.js`.

- Botón «Según el tiempo de hoy» (icono de sol con nube) junto a «¿Cómo prefieres ir?». Activado,
  pide `GET /api/route-preferences/weather` y marca «Sombra» con calor, «Sol» con frío y «Evitar el
  viento» con viento fuerte; con tiempo templado o de noche deja «Me da igual» (la ruta más rápida).
  «Por parques» nunca se marca solo.
- Debajo del botón, el motivo: «Hace calor (sensación de 31 °C) y sopla cierzo de 35 km/h: he
  marcado «Sombra» y «Evitar el viento».». Mientras consulta: «Consultando el tiempo de hoy…».
- Las opciones marcadas se ven marcadas y se pueden cambiar. Elegir a mano sombra, sol o el viento
  lo apaga (el motivo desaparece); «Por parques» y los minutos no.
- Viene activado para los usuarios nuevos y se guarda en la cuenta (`byWeather` en
  `PUT /api/route-preferences`): al volver a entrar, en cualquier dispositivo, se recuerda la última
  elección y, si está activado, se vuelve a consultar el tiempo.
- Sin datos del tiempo (o si falla la petición) se avisa y no se cambia ninguna respuesta.
- Con él activado no se piden fecha y hora: es el tiempo de ahora.
- El tiempo extra es el de la barra (+2 … +15 min), no el 25 % de la antigua «Recomendada», cuya
  tarjeta se ha retirado.
- Prueba real del 2026-11-23 (20:05, 10 °C, viento de 1 km/h, de noche) con un usuario nuevo: entra
  activado, con «Me da igual» y «Es de noche y hay poco viento (1 km/h): no hace falta desviarse, así
  que te propongo la ruta más rápida.»; al elegir «Sombra» se apaga.

## Comprobaciones de la PBI-18 (preferencias sencillas)

Las rutas guardadas se sustituyen por preguntas sencillas con los textos y los iconos de los bocetos
del equipo (Mejoras_S4). El backend traduce las respuestas a pesos (ADR-036: ver DECISIONS.md en la
carpeta docs del Drive del equipo); en la interfaz no se ven pesos ni porcentajes. Código:
`src/features/route-preferences/` y `src/services/api/routePreferencesApi.js`.

- Bajo origen y destino, «¿Cómo prefieres ir?» con:
  - «Sombra o sol»: Sombra (paraguas) / Sol / Me da igual, excluyentes; «Me da igual» por defecto.
  - «Viento y parques»: «Evitar el viento» (ráfagas) y «Por parques» (árbol), cada uno sí o no.
  - «¿Cuánto más estás dispuesto a andar?»: Nada / +2 / +5 / +10 / +15, con el valor a la derecha
    («+5 min» por defecto). Solo aparece si hay alguna preferencia.
- Con todo en «Me da igual» «Calcular ruta» pide solo la ruta más rápida (`POST /api/routes/fastest`);
  con alguna preferencia, `POST /api/routes/preferred` con las respuestas. La fecha y la hora solo se
  piden con Sombra o Sol.
- Las respuestas se guardan en la cuenta en cuanto cambian (`PUT /api/route-preferences`) y vuelven
  al entrar en cualquier dispositivo (`GET /api/route-preferences`). Si no se pueden cargar se usan
  las de por defecto y no se guardan; si un cambio no se puede guardar se avisa y se usa igualmente.
- Con una ruta calculada, las preguntas se pliegan en un resumen («Sol · Por parques · +10 min») con
  «Cambiar preferencias». Cambiar una respuesta borra la ruta calculada.
- «Según el tiempo de hoy»: ver «Comprobaciones de la PBI-21» (sustituye al botón provisional
  «Según el tiempo» de la PBI-18).
- La ruta elegida se llama «Tu ruta» y la otra «La más rápida» (comparación, resumen y leyenda). Sin
  ruta mejor dentro del tiempo: «Hay caminos que encajan mejor con tus preferencias, pero ninguno
  sin andar más de 5 min extra: te enseño la más rápida.».
- Cierzo trabaja con las mismas respuestas y «Usar como mis preferencias» las guarda en la cuenta.
- Teclado: Tab entra en cada grupo, las flechas mueven entre Sombra / Sol / Me da igual y entre los
  minutos, espacio marca las casillas; el foco se ve. Todas las opciones miden al menos 44 px.
- Comprobado con Playwright a 320, 390 y 1366 px (2026-11-23, entorno del e2e): ninguna opción se
  sale del panel y todas miden 44 px o más. A 390 px y en el escritorio cada fila cabe en una línea;
  a 320 px «Me da igual» y «Evitar el viento» ocupan dos líneas. En el móvil, el panel superior
  abierto se desplaza por dentro si no cabe encima de la hoja inferior (320 × 640).

## Comprobaciones de la PBI-6

> **Desde la PBI-18** ya no hay rutas guardadas: se eligen con las preguntas de «¿Cómo prefieres
> ir?». Ver "Comprobaciones de la PBI-18". Esta sección se conserva como histórico.

- Bajo origen y destino aparecen tus rutas como tarjetas con icono: Rápida, Sombreada, Soleada y las
  que crees. Sombra y sol son una sola escala (ADR-030): la tarjeta muestra el árbol o el sol, nunca
  los dos.
- Si alguna tarjeta queda cortada aparece una flecha en ese lado, que mueve la fila; desde 4 rutas,
  "Ver todas" abre un pop-up con todas y un buscador que no distingue tildes ni mayúsculas.
- Los iconos ＋ y lápiz abren un pop-up con el nombre, una barra "Sombra o sol" (ver abajo) y el tiempo
  extra máximo (0 a 40 %, desactivado si sombra y sol están en neutro y el viento a 0); en el móvil sube desde abajo. Escape o tocar fuera lo cierran.
- Un nombre que ya tiene otra de tus rutas (sin mayúsculas ni espacios al principio o al final; las
  tildes cuentan) se avisa mientras escribes, o tras un `409` del backend, con "Reemplazar" (pide
  confirmación y guarda los pesos sobre la existente; si renombrabas otra ruta, la borra) y "Cambiar
  nombre" (sugiere "X (2)"). "Recomendada" está reservado. Ver "Comprobaciones de los nombres de ruta
  repetidos (#165)".
- Con sombra o sol por encima de 0 se piden fecha y hora; la comparación y la leyenda usan el nombre
  de la ruta elegida.
- La papelera pide confirmación en otro pop-up y solo borra de tu cuenta; siempre queda al menos una
  ruta.

## Comprobaciones de la PBI-8.2 (viento en las rutas)

- El pop-up de una ruta tiene otra barra, "Evitar viento" (0 a 100 %), con su icono. Las rutas
  guardadas antes tienen el viento a 0; la tarjeta de una ruta con viento muestra "Evitar viento N %".
- Con sombra, sol y viento a 0 la barra de tiempo extra se desactiva; con solo viento se compara con
  la ruta rápida, pero no se piden fecha y hora: se usa el viento actual de Open-Meteo.
- Las tarjetas de la comparación muestran el "% de exposición al viento" de cada ruta. En una ruta
  solo con viento no aparece la sombra (no se calcula) y funciona también de noche.
- Con una ruta elegida, el resumen dice cuánto cambian la sombra y la exposición al viento.
- Con viento flojo (menos de 10 km/h) la exposición es 0 y la ruta elegida es la rápida.

## Comprobaciones de la PBI-9.2 (asistente de rutas)

> **Desde la PBI-18** Cierzo trabaja con las respuestas del panel en lugar de pesos, enseña los
> cambios en palabras («Sol → Sombra», «+5 min → +10 min») y «Guardar como ruta» pasa a ser «Usar
> como mis preferencias». Lo que sigue sobre pesos y «Guardar como ruta» es histórico.

El asistente traduce lo que escribe el usuario a los pesos de la ruta y el backend la recalcula
(`POST /api/routes/assistant`, ADR-033). El frontend no habla con el modelo ni conoce su clave: solo
envía los puntos, el texto, los pesos actuales y, si la ruta pide fecha y hora, las elegidas. No hay
variables de entorno nuevas en el frontend. Código: `src/features/route-assistant/` y
`src/services/api/routeAssistantApi.js`.

- Tras calcular una ruta aparece "Asistente" bajo el resumen, con el campo "Pide un ajuste de la
  ruta", el aviso "no escribas datos personales" y el contador de caracteres (máximo 300). Antes de
  calcular no aparece.
  - Desde weathermapz-gestion #179 el asistente ya no está en el panel: se abre con el botón
    flotante "Asistente" sobre el mapa (ver "Comprobaciones del asistente flotante").
- "prefiero la sombra aunque tarde más" con "Rápida" → "Ajustando..." mientras tanto; después, la
  explicación y solo los pesos que han cambiado, antes → después, con los iconos y escalas del editor
  (la barra única sombra-sol, "Neutro → Sombra 50 %"). En el mapa y en la leyenda la ruta pasa a
  llamarse "Ajustada".
- Una segunda petición ("y evita el viento") parte de los pesos que aplicó el asistente y solo
  cambia lo que menciona: la sombra de antes se queda.
- Una petición que no entiende ("cuéntame un chiste"), un error, un tiempo agotado o el límite
  ("Has hecho muchas peticiones seguidas al asistente. Espera un minuto.") muestran el aviso y la
  ruta y los pesos que había siguen en el mapa y en el panel, también tras un ajuste anterior.
- Sin clave en el backend: "El asistente no está disponible en este servidor. Puedes ajustar la
  ruta a mano."
- "Guardar como ruta" abre el editor con los pesos del asistente y el nombre "Asistente" (o
  "Asistente (2)" si ya existe). Con un nombre repetido sale el aviso de siempre; "Reemplazar" solo
  cambia los pesos de esa ruta y no borra ninguna. Tras guardar: "Guardada en tus rutas como «…»".
- Elegir otro tipo de ruta, otros puntos u otra hora deja atrás la respuesta del asistente.
- Comprobado con Playwright a 390, 320 y 1366 px (2026-11-15): sin scroll horizontal, campo y botones
  de 44 px de alto, todo con el teclado (Enter envía) y los avisos anunciados (`aria-live`).
- Con todo real (geocodificación, ruta y Groq, 390 px, 2026-11-15): Plaza del Pilar → Plaza San
  Francisco, "quiero ir por parques" → ruta "Ajustada" de 31 min con 50 % verde y "Verde 0 % → 50 %";
  "Guardar como ruta" la guarda como «Asistente»; "cuéntame un chiste" avisa y la ruta sigue.

## Comprobaciones del asistente flotante (weathermapz-gestion #179)

> **Desde weathermapz-gestion #181** el asistente se llama **Cierzo**: el botón es redondo, solo con
> su logo, y va encima de la leyenda (no bajo el zoom). Ver "Comprobaciones de Cierzo (#181)".

El asistente de la PBI-9.2 se abre desde un botón flotante sobre el mapa en lugar de una sección del
panel. Hace lo mismo que antes. Código: `src/features/route-assistant/AssistantFab.jsx`.

- El botón (morado, con el icono del asistente) solo aparece con una ruta calculada: no antes, no
  mientras se calcula y no durante "Iniciar ruta". Su nombre accesible es "Abrir el asistente de
  rutas" y, si la ruta en pantalla es la que ajustó el asistente, "(ruta ajustada)", con un punto
  verde.
- Móvil (320 y 390 px): botón redondo de 48 px a la derecha, justo encima de la hoja inferior y de
  la atribución; sube con la hoja al abrir "Ver recorrido". Queda por debajo del panel "Ruta"
  desplegado, del tiempo y del menú de usuario.
- Escritorio (1366 px): botón "Asistente" bajo el zoom, en la columna de los controles del mapa; no
  tapa la leyenda, el tiempo ni el menú de usuario.
- Se abre como hoja inferior en el móvil y como ventana centrada en el escritorio. El foco va al
  campo "Pide un ajuste de la ruta"; Escape, "Cerrar" o tocar fuera lo cierran y el foco vuelve al
  botón.
- Cerrar y volver a abrir conserva el texto que se estaba escribiendo, la explicación, los pesos
  antes → después y "Guardar como ruta"; la ruta ajustada sigue en el mapa.
- "Guardar como ruta" muestra el editor en el mismo pop-up (no abre otro encima) con el foco en el
  nombre; "Cancelar" o guardar vuelven al asistente con el foco en "Guardar como ruta".
- Comprobado con Playwright a 320, 390 y 1366 px (2026-11-16): botón de al menos 44 px sin tapar el
  zoom, la leyenda, la atribución, el tiempo, el menú, el panel ni la hoja inferior; sin scroll
  horizontal; aviso de "no disponible" con el backend sin clave y la ruta sigue.

## Comprobaciones de Cierzo (weathermapz-gestion #181)

El asistente de rutas se llama **Cierzo**, con un logo propio: las ráfagas del icono del viento
llevando una hoja. Código: `src/features/route-assistant/CierzoLogo.jsx` (nombre y logo),
`AssistantFab.jsx` y la esquina del mapa en `src/features/map/MapView.jsx`. El backend le dice su
nombre al modelo (ver README del backend).

- **El botón** es redondo de verdad, de 48 × 48 px y con `border-radius: 50%`, morado, con solo el
  logo. Su nombre accesible es "Abrir Cierzo, el asistente de rutas" y, con la ruta ajustada,
  "(ruta ajustada)" con un punto verde. En el escritorio, al pasar el ratón o con el foco del
  teclado, sale el tooltip "Cierzo".
- **Posición:** va en la misma esquina que la leyenda (`.map-corner`), justo encima y alineado a la
  derecha con ella. Cuando la leyenda crece (con la ruta rápida y la alternativa) el botón sube solo
  y nunca la tapa. En el móvil, donde la leyenda no se ve, queda a la derecha justo encima de la hoja
  inferior y de la atribución. No tapa el zoom, el menú de usuario, el tiempo, el panel ni la hoja.
- **El pop-up** se titula "Cierzo · Asistente de rutas", con el logo. El campo es "Pide a Cierzo un
  ajuste de la ruta", mientras trabaja sale "Cierzo está ajustando tu ruta..." y la lista es "Pesos
  cambiados por Cierzo". Los avisos que vienen del backend ("El asistente no está disponible…") no
  cambian.
- **Actualización:** los avisos del backend y los mensajes de error del frontend también dicen
  "Cierzo" ("Cierzo no está disponible ahora mismo. Tu ruta no ha cambiado.", "Has hecho muchas
  peticiones seguidas a Cierzo…"), y la ruta guardada desde el asistente se llama por defecto "Ruta
  de Cierzo" (o "Ruta de Cierzo (2)" si ya existe).
- **"Cierzo, busca sombra"** solo sube la sombra: llamarle por su nombre no cuenta como pedir evitar
  el viento.
- **Comprobado con Playwright a 320, 390 y 1366 px** (2026-11-16, entorno del e2e):
  - con la leyenda corta (ruta rápida) y la larga (rápida y "Sombreada");
  - botón de 48 × 48 px redondo, sin solaparse con la leyenda, el zoom, el menú, el tiempo, la
    atribución, el panel ni la hoja;
  - en el escritorio, de 4 a 16 px encima de la leyenda y alineado con ella; sube 23 px al crecer la
    leyenda;
  - en el móvil, justo encima de la hoja;
  - tooltip solo en el escritorio; foco al abrir y al cerrar.

## Comprobaciones de la PBI-9.1 (ruta recomendada)

> **Desde la PBI-21** el frontend ya no usa `POST /api/routes/recommended` ni muestra el bloque de
> la recomendación: «Según el tiempo de hoy» marca las preguntas con la misma regla (ver
> «Comprobaciones de la PBI-21»). Lo que sigue es histórico.

La ruta recomendada la decide el backend con el tiempo actual: `POST /api/routes/recommended` solo
recibe `origin` y `destination` y devuelve la comparación de siempre más `recommendation` (criterio,
pesos aplicados, tiempo extra, motivo, tiempo usado y reglas). La regla está en el ADR-029: ver
DECISIONS.md y ROUTING.md en la carpeta docs del Drive del equipo, y el contrato en el README del
backend.

- La tarjeta "Recomendada" (icono de termómetro, "Según el tiempo") es la primera de la fila, pero al
  entrar sigue elegida "Rápida". No se guarda con tus rutas, no cuenta para el máximo de 20 y no se
  puede editar ni borrar: al elegirla desaparecen el lápiz y la papelera (el ＋ sigue).
- Con "Recomendada" no se piden fecha y hora: se calcula para ahora.
- Tras calcular aparece el bloque "Recomendada: <criterio>" con el motivo, los pesos aplicados con
  los mismos iconos y escala de 0 a 100 % que el editor (sombra, sol y evitar viento), el tiempo extra
  máximo ("Sin rodeo" si todo está a 0) y el tiempo usado (temperatura, sensación, viento con su
  dirección y rachas, hora del dato y "Datos del tiempo: Open-Meteo").
- Si el tiempo recomienda la ruta rápida (p. ej. templado, de noche o sin datos de Open-Meteo), la
  comparación dice "Con el tiempo actual, la ruta recomendada es la más rápida." y se puede iniciar.
- En el móvil, con la comparación plegada solo se ven el criterio y el motivo; "Ver más" muestra los
  pesos y el tiempo. Con el recorrido abierto el bloque se oculta, como la comparación.
- En el móvil (390 y 320 px) todos los botones y campos del panel miden al menos 44×44 px, no hay
  scroll horizontal y a 320 px no se muestra el título "Tipo de ruta" para que quepan los botones.
  Todo se puede hacer con el teclado: Tab hasta "Recomendada" y Enter, flechas y Enter en las
  sugerencias, y Enter en "Calcular ruta" y "Ver más".
- Prueba real del 2026-11-12 (11:23, 18 °C, sensación 17,5 °C, viento de 13 km/h): Plaza España →
  Parque Grande da "Tiempo templado", pesos a 0 y la misma ruta que "Rápida" (33 min, 2,8 km).

## Comprobaciones de la barra Sombra ↔ Sol

> **Desde la PBI-18** el editor, las tarjetas y «Ver todas» se han retirado, y desde la PBI-21
> también la tarjeta de la recomendación: la barra ya no aparece.

Sombra y sol son los dos extremos de una sola escala (ADR-030: ver DECISIONS.md en la carpeta docs
del Drive del equipo). La API no cambia: sigue enviando `weights.shade` y `weights.sun`, pero nunca los
dos por encima de 0.

- En el pop-up de una ruta hay una sola barra "Sombra o sol": "Sombra" a la izquierda, "Sol" a la
  derecha y una marca en el centro. En el centro es "Neutro" (sombra 0, sol 0); hacia la izquierda
  sube la sombra y hacia la derecha el sol, de 5 en 5 hasta 100 % por cada lado. El valor se lee al
  lado ("Sombra 50 %", "Neutro", "Sol 30 %") y el tirador toma el color del lado elegido.
- Con el teclado: Tab hasta la barra y flechas izquierda/derecha. Un lector de pantalla lee el mismo
  texto (`aria-valuetext`). En el móvil la barra mide al menos 44 px de alto.
- Una ruta guardada antes con sombra y sol a la vez se abre con el mayor de los dos (el neutro si son
  iguales); al guardar se envía solo ese. Si el backend la rechaza, el mensaje sale bajo la barra.
- Las tarjetas y "Ver todas" muestran una sola línea ("Sombra N %" o "Sol N %") con un solo icono, y
  la tarjeta del motivo de la ruta recomendada usa la misma escala, rellena desde el centro.
- Comprobado con Playwright y Chrome a 390, 320 y 1366 px (2026-11-12): sin scroll horizontal,
  controles del pop-up de al menos 44×44 px en el móvil y uso completo con el teclado.

## Comprobaciones de los nombres de ruta repetidos (#165)

> **Desde la PBI-18** ya no hay rutas guardadas: se eligen con las preguntas de «¿Cómo prefieres
> ir?». Ver "Comprobaciones de la PBI-18". Esta sección se conserva como histórico.

Con el backend de la rama de #165 (migración `20261112000003-unique-route-profile-names` aplicada) y
sesión iniciada. Los nombres se comparan sin mayúsculas ni espacios al principio o al final, pero
las tildes cuentan ("Rapida" no repite "Rápida").

- [ ] En "Nueva ruta", escribir " sombreada " muestra al momento, debajo del nombre, "Ya tienes una
      ruta llamada «Sombreada»." con "Reemplazar" y "Cambiar nombre"; el campo lo anuncia
      (`aria-describedby`) y "Guardar" no guarda: lleva el foco a "Reemplazar".
- [ ] "Cambiar nombre" pone "sombreada (2)" (o el primer número libre) y el foco en el nombre.
- [ ] "Reemplazar" pregunta "Se sustituirán los pesos de «Sombreada»." con el foco en "Reemplazar
      «Sombreada»"; "No reemplazar" vuelve a "Reemplazar". Al confirmar, Sombreada queda elegida
      con los pesos nuevos y no hay dos Sombreada.
- [ ] Editar otra ruta y renombrarla a "SOLEADA": la pregunta añade "y se borrará «…»"; al confirmar
      se actualiza Soleada (PUT) y se borra la editada (DELETE). Si el DELETE falla se cierra la
      ventana con "Se ha actualizado «Soleada», pero no se ha podido borrar «…»." y se recarga la lista.
- [ ] Si el backend responde `409` (la ruta se creó en otra pestaña), aparece el mismo aviso con
      "Reemplazar" sobre la ruta de `existingId`.
- [ ] "recomendada" muestra "«Recomendada» es la ruta automática: elige otro nombre." y no se guarda.
- [ ] Funciona igual con las predefinidas copiadas al usuario (Rápida, Sombreada, Soleada).
- [ ] A 390 y 320 px los botones miden al menos 44 px y no hay scroll horizontal; todo se puede hacer
      con el teclado.

## Comprobaciones de la PBI-10 fase B (el verde en las rutas)

> **Desde la PBI-18** el verde se pide con «Por parques» (árbol); el % verde de cada ruta se sigue
> viendo en la comparación y en el desglose.

El backend calcula el porcentaje de trayecto verde de cada ruta (árboles y parques, ADR-026) y lo
usa con el peso de vegetación (ADR-031: ver DECISIONS.md en la carpeta docs del Drive del equipo).

- El pop-up de una ruta tiene una barra "Verde" (0 a 100 %, de 5 en 5) con una hoja, independiente de
  la barra "Sombra o sol": se pueden pedir a la vez un paseo con sombra y verde. Las rutas guardadas
  antes la tienen a 0.
- Con solo verde se puede elegir el tiempo extra y no se piden fecha y hora: el verde no depende
  del Sol, así que también funciona de noche.
- La tarjeta de la ruta muestra la hoja y "Verde N %"; también en "Ver todas".
- Al calcular, cada tarjeta de la comparación muestra su "N % verde" (cuando pesan el verde, la
  sombra o el sol), el desglose del confort (PBI-11) explica el verde en porcentajes y el resumen
  de la ruta tiene una métrica "Verde".
- La tarjeta del motivo de la ruta recomendada tiene la fila "Verde", a 0 %: la recomendación aún
  no pesa el verde.
- Prueba real del 2026-11-12 con Playwright y Chrome a 390, 320 y 1366 px: una ruta "Parques" solo
  con verde al 100 %, de Plaza del Pilar a Plaza San Francisco, elige una alternativa de 31 min con
  el 50 % verde frente a la rápida de 31 min con el 31 % ("añade 1 min y tiene 19 puntos más de
  verde"). Sin scroll horizontal, barra de 44 px en el móvil y todo con el teclado.

## Comprobaciones de la PBI-12 (recientes y favoritos)

> **Desde weathermapz-gestion #180** los recientes son lugares, no trayectos, y se ofrecen en los
> campos de origen y destino; el botón pasa a llamarse "Favoritos". Ver "Comprobaciones de los
> lugares recientes (#180)". Lo que sigue sobre los favoritos sigue valiendo.

El historial y los favoritos se guardan en la cuenta (backend, ADR-032): se ven igual en el móvil y
en el ordenador.

- Bajo los campos de origen y destino hay un botón "Recientes y favoritos" que abre un pop-up con
  dos apartados: Favoritos y Recientes.
- Cada ruta que se calcula bien aparece arriba en Recientes con "Hoy, HH:MM" o la fecha; una ruta
  que falla no. El mismo trayecto no se repite y solo se guardan las 10 últimas búsquedas.
- La estrella de un reciente abre un campo para ponerle nombre (opcional; sin nombre, "Origen →
  Destino"). Guardado, sale en Favoritos y su estrella queda llena y desactivada.
- Tocar un favorito o un reciente pone los dos puntos con sus nombres, cierra el pop-up y calcula la
  ruta con el tipo de ruta elegido y la hora de ahora (también se actualiza el selector de hora).
- La papelera de un favorito lo quita. "Borrar historial" pide confirmación y deja los favoritos.
- Sin conexión con el backend, el pop-up lo dice y la app sigue funcionando; si falla apuntar una
  búsqueda, no se avisa: el historial no interrumpe la ruta.
- Prueba real del 2026-11-14 con Playwright y Chrome a 1366 y 390 px: Plaza del Pilar → Plaza de los
  Sitios con "Rápida" aparece en Recientes, se guarda como "Paseo al Pilar", el historial se borra
  conservando el favorito y al tocarlo se calcula otra vez (15 min, 1,2 km). Sin scroll horizontal y
  con botones de 44 px en el móvil.

## Comprobaciones de los lugares recientes (weathermapz-gestion #180)

Cambia la PBI-12: en lugar de las últimas búsquedas de trayectos, se guardan los últimos 6 lugares
usados como origen o destino, en la cuenta (`/api/recent-places`, ADR-035). Necesita el backend con
el mismo cambio: los dos PR se despliegan juntos. Código: `src/features/route-history/`,
`src/services/api/routeHistoryApi.js` y la lista de `RouteSearchPanel`.

- Cuando una ruta se calcula bien, su origen y su destino pasan a los lugares recientes (el destino,
  el más reciente). «Mi ubicación» no se guarda. Una ruta que falla no guarda nada y, si falla
  guardarlos, no se avisa.
- Al enfocar el origen o el destino: «Mi ubicación» y, debajo, el grupo "Recientes" con el icono del
  reloj, la misma lista en los dos campos, del más reciente al más antiguo, sin repetir y como mucho 6. El lugar elegido en el otro campo no aparece (así no se puede poner el mismo origen y destino).
- Al escribir (3 caracteres o más): primero hasta 3 recientes cuyo nombre contiene el texto, sin
  distinguir mayúsculas ni tildes ("san jose" encuentra "Plaza San José"); después las sugerencias
  del autocompletado como antes, sin las que coinciden con un reciente. Los recientes aparecen
  mientras se buscan las sugerencias y Enter elige la primera opción de la lista.
- Teclado: las flechas recorren «Mi ubicación» y los recientes; Enter elige; sin texto, Enter solo no
  elige nada.
- El botón "Favoritos" (antes "Recientes y favoritos") abre un pop-up con:
  - los trayectos favoritos: tocar uno lo calcula de nuevo con la hora de ahora; la papelera lo
    quita;
  - "Guardar este trayecto", con nombre opcional, cuando hay origen y destino. No se ofrece si uno
    es «Mi ubicación» y avisa si ya está en favoritos;
  - "Borrar lugares recientes", con confirmación; los favoritos se mantienen.
- Comprobado con Playwright a 320, 390 y 1366 px (2026-11-16, entorno del e2e): recientes en los dos
  campos sin el del otro, coincidencias al escribir sin duplicados, guardar el trayecto como
  favorito, borrar los recientes (el favorito sigue tras recargar), opciones de 44 px de alto en el
  móvil y sin scroll horizontal.

## Comprobaciones de la PBI-11 (desglose del confort)

Tras calcular una ruta con pesos o la recomendada, debajo de la comparación aparece "Confort de la
ruta …". Solo presenta lo que devuelve el backend; no calcula nada.

- Barras con su texto (no solo color): "Sombra N % · Sol N %" (si se ha calculado la sombra),
  "Exposición al viento N %" con la explicación de la escala, y "Junto a árboles o parques N %".
  Son las de la ruta que se está viendo: al pulsar "Más rápida" o la alternativa, cambian.
- "Por qué esta ruta" explica la alternativa frente a la más rápida con los dos porcentajes
  ("«Sombreada» va a la sombra el 91 % del recorrido, frente al 72 % de la más rápida") y nunca en
  "puntos". Lo pedido (los pesos de la ruta o de la recomendada) va primero y en negrita; con sol
  se explica el sol en vez de la sombra; un factor que no cambia no se menciona.
- El tiempo extra va en segundos si es menos de un minuto ("tarda 44 s más"); los minutos de cada
  ruta solo se dan si son distintos. La frase de la comparación queda en "X añade 44 s.".
- Sin alternativa que mejore, explica que la mejor opción es la más rápida; sin datos, lo dice.
- En el móvil el desglose se pliega con la comparación ("Ver más") y se oculta con el recorrido
  abierto; en escritorio se ve siempre.
- Prueba real del 2026-11-14 con Playwright y Chrome a 1366 y 390 px: "Sombreada" a las 12:00 de
  Puerta del Carmen a Plaza del Pilar: 91 % de sombra frente al 72 %, 22 % verde frente al 28 % y
  44 s más.

## Comprobaciones de Iniciar ruta

- Tras calcular una ruta, "Iniciar ruta" pide la ubicación y sustituye el buscador por la indicación.
- Al avanzar cambian la indicación y lo que queda; a más de 40 m de la ruta aparece el aviso.
- A 20 m del destino dice que has llegado; "Terminar" vuelve al buscador con la ruta calculada.
- Lejos de la ruta o fuera de Zaragoza el mapa sigue mostrando la ruta y se puede arrastrar.
- Al arrastrar el mapa ya en la ruta deja de seguirte; "Centrar" vuelve a tu posición.
- Para probarla sin salir de casa: Chrome DevTools > Sensors > Location.

## Comprobaciones del recorrido

- Tras calcular una ruta, "Ver recorrido" muestra las calles por las que pasa y el paso a paso.
- Tocar un paso resalta su tramo en el mapa y lo centra, sin que lo tapen los paneles.
- Al cambiar entre la ruta rápida y la sombreada, la lista cambia y se pierde la selección.
- En tramos sin nombre en OpenStreetMap solo sale la indicación ("Gire a la derecha").

## Comprobaciones de la PBI-4

- Sin sesión iniciada solo se ve la pantalla de inicio de sesión; el mapa no aparece.
- Registrarse con un correo no válido o una contraseña de menos de 8 caracteres muestra el error
  debajo del campo que falla, y el foco va a ese campo.
- Registrarse con un correo que ya existe muestra "Ya existe una cuenta con este correo
  electrónico".
- Un registro o inicio de sesión correcto entra al mapa con el nombre y "Cerrar sesión" en la
  cabecera.
- Al recargar la página se sigue dentro sin volver a iniciar sesión (la sesión dura 7 días).
- "Cerrar sesión" vuelve a la pantalla de inicio de sesión.
- "Continuar con Google" abre el selector de cuentas de Google y vuelve a la app con la sesión
  iniciada. Si se cancela, o Google no está configurado en el backend, vuelve al inicio de sesión
  con un aviso.
- El botón del ojo muestra y oculta la contraseña.
- Todo se puede usar con el teclado (Tab, Enter) y a 375 px no hay scroll horizontal.

## Comprobaciones de PBI-5.4

- Selecciona **Más rápida** y comprueba que conserva el flujo y endpoint anteriores.
- Selecciona **Con sombra**, cambia fecha/hora y calcula; la petición usa `Europe/Madrid`.
- Si existe alternativa, aparecen dos métricas y dos trazados: rápida discontinua y sombreada
  continua. Las tarjetas permiten alternar el recorrido destacado sin recalcular.
- Comprueba duración, porcentaje de sombra y tiempo adicional; un dato ausente se muestra como
  no disponible, nunca como cero inventado.
- Si no existe una alternativa adecuada, aparece un mensaje y no se dibuja una segunda copia de
  la ruta rápida.
- Repite a 375, 390, 768, 1366 y 1920 px: selector, fecha/hora y comparación siguen accesibles sin
  aplicaciones ni controles duplicados.
- Editar origen/destino o fecha/hora cancela peticiones pendientes y elimina trazados obsoletos.

## Despliegue

Cada push a `main` ejecuta el workflow `Deploy`: pasa `npm run ci`, construye la imagen del
`Dockerfile` (build de Vite servido con nginx en el puerto 8080) y la despliega en la máquina virtual
de Azure. Caddy, la configuración de Compose y los pasos para preparar el servidor están en el
`deploy/README.md` del repositorio backend.
