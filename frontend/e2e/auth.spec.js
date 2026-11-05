import { test, expect } from '@playwright/test';

const sellerEmail = process.env.E2E_SELLER_EMAIL;
const sellerPassword = process.env.E2E_SELLER_PASSWORD;

test.describe('sesión del vendedor', () => {
  test.skip(
    !sellerEmail || !sellerPassword,
    'Configura E2E_SELLER_EMAIL y E2E_SELLER_PASSWORD para probar el login.'
  );

  test('inicia sesión y abre el panel de bodega', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').fill(sellerEmail);
    await page.locator('input[type="password"]').fill(sellerPassword);
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page).toHaveURL(/\/bodega\/dashboard/);
    await expect(
      page.getByRole('heading', { name: 'Panel de Bodega' })
    ).toBeVisible();
  });
});
