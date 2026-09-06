import { expect, test } from '@playwright/test';

test.describe('BMarket public smoke', () => {
  test('login page renders and validates required fields', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Masuk ke BMarket')).toBeVisible();
    await expect(page.getByPlaceholder('nama@binus.ac.id')).toBeVisible();
    await expect(page.getByPlaceholder('Masukkan password')).toBeVisible();

    await page.getByText('Masuk', { exact: true }).last().click();

    await expect(page.getByText('Email BINUS wajib diisi.')).toBeVisible();
    await expect(page.getByText('Password wajib diisi.')).toBeVisible();
  });

  test('register page is reachable and validates the form', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Daftar', { exact: true }).click();

    await expect(page.getByText('Buat akun BMarket')).toBeVisible();
    await page.getByText('Buat akun', { exact: true }).click();

    await expect(page.getByText('Nama lengkap wajib diisi.')).toBeVisible();
    await expect(page.getByText('NIM wajib diisi.')).toBeVisible();
    await expect(page.getByText('Email BINUS wajib diisi.')).toBeVisible();
    await expect(page.getByText('Gunakan minimal 8 karakter.')).toBeVisible();
  });
});
