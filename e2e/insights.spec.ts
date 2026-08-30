/**
 * The results page is session data, so it does not exist unless a key is
 * configured. Locally TMV_INSIGHTS_KEY is unset, which is exactly the state
 * that must not leak anything.
 */
import { expect, test } from '@playwright/test';

test('the endpoint does not exist without a key on the server', async ({ request }) => {
  for (const url of ['/api/insights', '/api/insights?key=', '/api/insights?key=guess']) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(404);
    expect(await res.text()).toBe('');
  }
});

test('the page asks for a key rather than showing an empty dashboard', async ({ page }) => {
  await page.goto('/insights');
  await expect(page.getByText('This page needs a key.')).toBeVisible();
});

test('a wrong key says what to check, and shows no data', async ({ page }) => {
  await page.goto('/insights?key=wrong');
  await expect(page.getByText(/TMV_INSIGHTS_KEY is set on the server/)).toBeVisible();
  await expect(page.locator('.headline-figure')).toHaveCount(0);
});
