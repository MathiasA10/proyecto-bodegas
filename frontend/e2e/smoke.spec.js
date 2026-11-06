import { test, expect } from '@playwright/test';

const apiURL = process.env.E2E_API_URL || 'http://127.0.0.1:8000/api/';

test('muestra la pantalla de inicio de sesión', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Iniciar Sesión' })
  ).toBeVisible();
  await expect(page.getByPlaceholder('ejemplo@correo.com')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
});

test('abre la recuperación de contraseña', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();

  await expect(page).toHaveURL(/\/recuperar-password$/);
  await expect(
    page.getByRole('heading', { name: 'Recuperar contraseña' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar código' })).toBeVisible();
});

test('muestra el mapa público de bodegas', async ({ page }) => {
  await page.goto('/mapa');

  await expect(page.locator('.leaflet-container').first()).toBeVisible();
});

test('abre el catálogo de una bodega pública', async ({ page, request }) => {
  const respuesta = await request.get(`${apiURL}public/bodegas/`);
  expect(respuesta.ok()).toBeTruthy();

  const bodegas = await respuesta.json();
  test.skip(bodegas.length === 0, 'No hay bodegas públicas para probar.');

  const bodega = bodegas[0];
  await page.goto(`/tienda/${bodega.id}`);

  await expect(
    page.getByRole('heading', { name: bodega.nombre_comercial })
  ).toBeVisible();
});
