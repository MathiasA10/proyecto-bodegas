import { test, expect } from '@playwright/test';

const clientEmail = process.env.E2E_CLIENT_EMAIL;
const clientPassword = process.env.E2E_CLIENT_PASSWORD;

test.describe('compra como cliente', () => {
  test.skip(
    !clientEmail || !clientPassword,
    'Configura E2E_CLIENT_EMAIL y E2E_CLIENT_PASSWORD para probar el checkout.'
  );

  test('realiza un pedido de recojo', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').fill(clientEmail);
    await page.locator('input[type="password"]').fill(clientPassword);
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page).toHaveURL(/\/mapa/);

    await page.goto('/tienda/1');
    await expect(
      page.getByRole('heading', { name: 'Bodega E2E' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Agregar' }).first().click();
    await expect(page.getByText('Producto agregado al carrito.')).toBeVisible();

    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByPlaceholder('Tu nombre completo').fill('Cliente E2E');
    await page.getByPlaceholder('Teléfono / WhatsApp (9 dígitos)').fill('999999999');

    await page.getByRole('button', { name: 'Confirmar pedido' }).click();

    await expect(page.getByRole('heading', { name: 'Pedido enviado' })).toBeVisible();
  });
});
