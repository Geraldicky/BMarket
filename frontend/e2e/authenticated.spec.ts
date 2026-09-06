import { expect, test, type Page } from '@playwright/test';

const studentEmail = process.env.E2E_STUDENT_EMAIL;
const studentPassword = process.env.E2E_STUDENT_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('nama@binus.ac.id').fill(email);
  await page.getByPlaceholder('Masukkan password').fill(password);
  await page.getByText('Masuk', { exact: true }).last().click();
}

test.describe('Authenticated smoke', () => {
  test('student can sign in and reach marketplace home', async ({ page }) => {
    test.skip(!studentEmail || !studentPassword, 'Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD to run authenticated student smoke.');

    await login(page, studentEmail!, studentPassword!);
    await expect(page.getByText(/Halo, .+!/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('MARKETPLACE KAMPUS')).toBeVisible();
    await expect(page.getByText('Kategori')).toBeVisible();
  });

  test('admin can sign in and reach admin dashboard', async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated admin smoke.');

    await login(page, adminEmail!, adminPassword!);
    await expect(page.getByText('Admin BMarket')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ringkasan kesehatan marketplace')).toBeVisible();
  });
});
