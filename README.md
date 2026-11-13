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

## Comprobaciones de la PBI-6

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

## Comprobaciones de la PBI-9.1 (ruta recomendada)

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

El backend calcula el porcentaje de trayecto verde de cada ruta (árboles y parques, ADR-026) y lo
usa con el peso de vegetación (ADR-031: ver DECISIONS.md en la carpeta docs del Drive del equipo).

- El pop-up de una ruta tiene una barra "Verde" (0 a 100 %, de 5 en 5) con una hoja, independiente de
  la barra "Sombra o sol": se pueden pedir a la vez un paseo con sombra y verde. Las rutas guardadas
  antes la tienen a 0.
- Con solo verde se puede elegir el tiempo extra y no se piden fecha y hora: el verde no depende
  del Sol, así que también funciona de noche.
- La tarjeta de la ruta muestra la hoja y "Verde N %"; también en "Ver todas".
- Al calcular, cada tarjeta de la comparación muestra su "N % verde" (cuando pesan el verde, la
  sombra o el sol), el resumen añade "N puntos más de verde" y el resumen de la ruta, una métrica
  "Verde".
- La tarjeta del motivo de la ruta recomendada tiene la fila "Verde", a 0 %: la recomendación aún
  no pesa el verde.
- Prueba real del 2026-11-12 con Playwright y Chrome a 390, 320 y 1366 px: una ruta "Parques" solo
  con verde al 100 %, de Plaza del Pilar a Plaza San Francisco, elige una alternativa de 31 min con
  el 50 % verde frente a la rápida de 31 min con el 31 % ("añade 1 min y tiene 19 puntos más de
  verde"). Sin scroll horizontal, barra de 44 px en el móvil y todo con el teclado.

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
