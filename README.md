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

## Comprobaciones de la PBI-6

- Bajo origen y destino aparecen tus rutas como tarjetas con icono: Rápida, Sombreada, Soleada y las
  que crees. Con sombra y sol a la vez salen los dos iconos.
- Si alguna tarjeta queda cortada aparece una flecha en ese lado, que mueve la fila; desde 4 rutas,
  "Ver todas" abre un pop-up con todas y un buscador que no distingue tildes ni mayúsculas.
- Los iconos ＋ y lápiz abren un pop-up con el nombre, dos barras de 0 a 100 % (sombra y sol) y el tiempo
  extra máximo (0 a 40 %, desactivado si sombra y sol están a 0); en el móvil sube desde abajo. Un nombre repetido se marca en el campo; Escape o tocar fuera lo cierran.
- Con sombra o sol por encima de 0 se piden fecha y hora; la comparación y la leyenda usan el nombre
  de la ruta elegida.
- La papelera pide confirmación en otro pop-up y solo borra de tu cuenta; siempre queda al menos una
  ruta.

## Comprobaciones de la PBI-8.2 (viento en las rutas)

- El pop-up de una ruta tiene una tercera barra, "Evitar viento" (0 a 100 %), con su icono. Las rutas
  guardadas antes tienen el viento a 0; la tarjeta de una ruta con viento muestra "Evitar viento N %".
- Con sombra, sol y viento a 0 la barra de tiempo extra se desactiva; con solo viento se compara con
  la ruta rápida, pero no se piden fecha y hora: se usa el viento actual de Open-Meteo.
- Las tarjetas de la comparación muestran el "% de exposición al viento" de cada ruta. En una ruta
  solo con viento no aparece la sombra (no se calcula) y funciona también de noche.
- Con una ruta elegida, el resumen dice cuánto cambian la sombra y la exposición al viento.
- Con viento flojo (menos de 10 km/h) la exposición es 0 y la ruta elegida es la rápida.

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
