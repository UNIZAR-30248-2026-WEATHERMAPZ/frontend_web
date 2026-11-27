// Happy path of WeatherMapZ (#161): sign up with «Según el tiempo de hoy» on (PBI-21), which marks
// the answers with the weather and says why, change the minutes (PBI-18), log out and log in again and
// find them, choose the origin and the destination with the autocomplete, calculate the fastest route
// and then the one the weather marks, with the comparison. External services are fake
// (fake-services.js).
import { expect, test } from '@playwright/test';

import { FAKE_SERVICES_URL, FRONTEND_PORT } from './environment.js';
import { FASTEST_ROUTE_TEXT, PLACES } from './scenario.js';

// 1×1 transparent PNG for the OpenStreetMap tiles: the map is drawn without internet.
const EMPTY_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

async function blockExternalRequests(page) {
  const blocked = [];
  await page.route('**/*', (route) => {
    const { hostname, port } = new URL(route.request().url());
    if (hostname === '127.0.0.1' && Number(port) === FRONTEND_PORT) return route.continue();
    blocked.push(route.request().url());
    return route.abort();
  });
  // Registered later, so it wins over the route above for the tiles.
  await page.route(/^https:\/\/[abc]\.tile\.openstreetmap\.org\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: EMPTY_TILE })
  );
  return blocked;
}

async function choosePlace(page, field, text, place) {
  const input = page.getByRole('combobox', { name: field });
  await input.fill(text);
  await page.getByRole('option', { name: place.label }).click();
  await expect(input).toHaveValue(place.label);
}

test('sign up, keep the preferences, choose the points and compare the routes', async ({
  page,
  request,
}) => {
  const blocked = await blockExternalRequests(page);
  const user = {
    name: 'Prueba E2E',
    email: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`,
    password: `e2e-${Math.random().toString(36).slice(2)}`,
  };

  // Sign up: the account starts the session.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Regístrate' }).click();
  await page.getByLabel('Nombre').fill(user.name);
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  const userMenu = page.getByRole('button', { name: `Menú de usuario de ${user.name}` });
  await expect(userMenu).toBeVisible();

  // La PBI-20 abre el tutorial automáticamente al registrar un usuario.
  // Lo cerramos porque este test comprueba las rutas, no el tutorial.
  const tutorial = page.getByRole('dialog', {
    name: 'Origen y destino',
  });

  await expect(tutorial).toBeVisible();
  await tutorial.getByRole('button', { name: 'Saltar tutorial' }).click();
  await expect(tutorial).toBeHidden();

  // A new account starts with «Según el tiempo de hoy» on (PBI-21): the fake weather is mild with a
  // strong cierzo, so it marks «Evitar el viento», leaves «Me da igual» and says why.
  const byWeather = page.getByRole('button', { name: 'Según el tiempo de hoy', exact: true });
  await expect(byWeather).toHaveAttribute('aria-pressed', 'true');
  const reason = page.getByText(/cierzo de 40 km\/h/);
  await expect(reason).toContainText('he marcado «Evitar el viento»');
  const indifferent = page.getByRole('radio', { name: 'Me da igual' });
  await expect(indifferent).toBeChecked();
  const avoidWind = page.getByRole('checkbox', { name: 'Evitar el viento' });
  await expect(avoidWind).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Por parques' })).not.toBeChecked();
  // With a preference the minutes are asked (PBI-18); changing them keeps the weather on.
  const minutes = page.getByRole('group', { name: '¿Cuánto más estás dispuesto a andar?' });
  await expect(minutes).toBeVisible();
  await expect(minutes.getByRole('radio', { name: '+5 minutos' })).toBeChecked();
  await minutes.getByText('+10').click();
  await expect(minutes.getByRole('radio', { name: '+10 minutos' })).toBeChecked();
  await expect(byWeather).toHaveAttribute('aria-pressed', 'true');

  // Log out and log in with the new account: the preferences come back from the account.
  await userMenu.click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(userMenu).toBeVisible();
  await expect(byWeather).toHaveAttribute('aria-pressed', 'true');
  await expect(avoidWind).toBeChecked();
  await expect(minutes.getByRole('radio', { name: '+10 minutos' })).toBeChecked();
  // Unchecking the wind by hand turns the weather off: everything indifferent, the fastest route.
  await avoidWind.uncheck();
  await expect(byWeather).toHaveAttribute('aria-pressed', 'false');
  await expect(reason).toBeHidden();
  await expect(indifferent).toBeChecked();
  await expect(minutes).toBeHidden();

  // Focusing a field offers «Mi ubicación» first, also without text (#178).
  await page.getByRole('combobox', { name: 'Origen' }).click();
  await expect(page.getByRole('option').first()).toHaveText('Mi ubicación');

  // Origin and destination with the autocomplete.
  await choosePlace(page, 'Origen', 'Prueba Norte', PLACES.origin);
  await choosePlace(page, 'Destino', 'Prueba Sur', PLACES.destination);

  // Fastest route: with every answer indifferent.
  await page.getByRole('button', { name: 'Calcular ruta', exact: true }).click();
  const summary = page.getByRole('region', { name: 'La más rápida' });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(FASTEST_ROUTE_TEXT.distance);
  await expect(summary).toContainText(FASTEST_ROUTE_TEXT.duration);

  // The places of the route go to the recent places (#180): focusing the destination offers «Mi
  // ubicación» and the recent places, but not the place chosen as origin.
  await page.getByRole('combobox', { name: 'Destino' }).click();
  const recentPlaces = page.getByRole('group', { name: 'Recientes' });
  await expect(recentPlaces.getByRole('option')).toHaveText([PLACES.destination.label]);
  await expect(page.getByRole('option').first()).toHaveText('Mi ubicación');
  await page.keyboard.press('Escape');
  await expect(recentPlaces).toBeHidden();

  // «Según el tiempo de hoy» on again: it marks the wind again and the route of those answers is
  // compared with the fastest one, with the minutes of the bar. With a route on screen the questions
  // are the dropdown «Cambiar preferencias» of the result (PBI-19).
  await page.getByRole('button', { name: 'Cambiar preferencias', exact: true }).click();
  await byWeather.click();
  await expect(reason).toContainText('he marcado «Evitar el viento»');
  await expect(avoidWind).toBeChecked();
  await page.getByRole('button', { name: 'Calcular ruta', exact: true }).click();
  // The result as in the sketches (PBI-19). With the fake routes no alternative has less wind: the
  // fastest one is shown with the reason, and its data are under «Ver detalle».
  const comparison = page.getByRole('region', { name: /^La más rápida · / });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole('heading')).toContainText(FASTEST_ROUTE_TEXT.duration);
  await expect(comparison.getByRole('status')).toContainText(
    'No hay ningún camino con menos viento de cara'
  );
  // Both cards, in words: the second one has no alternative.
  await expect(comparison.getByRole('button', { name: /^Más rápida/ })).toContainText(
    /Viento\s*(Poco|Algo|Mucho)/
  );
  await expect(comparison.getByRole('button', { name: /^Tu ruta/ })).toContainText(
    'Sin alternativa'
  );
  await comparison.getByText('Ver detalle').click();
  const detail = comparison.getByRole('table');
  await expect(detail).toContainText(FASTEST_ROUTE_TEXT.distance);
  // The wind exposure comes from the street segments and their openness in PostGIS: the backend
  // found the mini-dataset along the route.
  await expect(
    detail.getByRole('row', { name: /^Exposición al viento/ }).getByRole('cell')
  ).toHaveText(/^\d+$/);

  // The assistant opens from its floating button over the map (#179): focus in the request field,
  // Escape closes it and the focus goes back to the button. Nothing is asked to the model.
  const assistantButton = page.getByRole('button', { name: 'Abrir Cierzo, el asistente de rutas' });
  await expect(assistantButton).toBeVisible();
  await assistantButton.click();
  const assistant = page.getByRole('dialog', { name: 'Cierzo · Asistente de rutas' });
  await expect(assistant.getByLabel('Pide a Cierzo un ajuste de la ruta')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(assistant).toBeHidden();
  await expect(assistantButton).toBeFocused();

  // Nothing left the machine: the browser only reached the frontend and the backend only reached
  // the fake services, which saw the expected calls and nothing else.
  expect(blocked).toEqual([]);
  const calls = await (await request.get(`${FAKE_SERVICES_URL}/__requests`)).json();
  expect(calls.autocomplete).toBeGreaterThan(0);
  expect(calls.directions).toBeGreaterThanOrEqual(2);
  expect(calls.weather).toBeGreaterThan(0);
  expect(calls.llm).toBe(0);
  expect(calls.unexpected).toEqual([]);
});
