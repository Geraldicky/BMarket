import { expect, test } from '@playwright/test';

const apiBase = (process.env.E2E_API_URL || '').replace(/\/$/, '');

test('production API health is healthy and returns a request id', async ({ request }) => {
  test.skip(!apiBase, 'Set E2E_API_URL to run the API health smoke.');

  const response = await request.get(`${apiBase}/health`, {
    headers: { 'X-Request-ID': 'bmarket-e2e-health' },
  });

  expect(response.ok()).toBeTruthy();
  expect(response.headers()['x-request-id']).toBeTruthy();

  const body = await response.json();
  expect(body?.success).toBe(true);
  expect(body?.data?.status).toBe('ok');
});
