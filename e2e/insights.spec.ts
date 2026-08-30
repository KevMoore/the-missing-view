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

test('the page states its window rather than implying it is everything', async ({ page }) => {
  await page.route('**/api/insights**', (route) =>
    route.fulfill({
      json: {
        sessions: 3,
        answers: 12,
        surprisedPct: 75,
        suspectedPct: 17,
        knewPct: 8,
        sawSomethingPct: 92,
        playAgainPct: 83,
        completionPct: 100,
        solvedPct: 67,
        medianMinutes: 51,
        medianMomentsReached: 6,
        medianDominance: 0.2,
        totalPassedOver: 2,
        medianPlayers: 6,
        changes: [],
        since: '2026-08-31T00:00:00.000Z',
      },
    }),
  );
  await page.goto('/insights?key=demo');
  await expect(page.getByText(/counting from 2026-08-31/)).toBeVisible();
  // and a way back to the full record, because nothing was deleted
  await expect(page.getByRole('link', { name: 'show everything' })).toBeVisible();
});

test('an empty window says the earlier sessions still exist', async ({ page }) => {
  await page.route('**/api/insights**', (route) =>
    route.fulfill({ json: { sessions: 0, answers: 0, since: '2027-01-01T00:00:00.000Z' } }),
  );
  await page.goto('/insights?key=demo');
  await expect(page.getByText(/nothing was deleted/i)).toBeVisible();
});
