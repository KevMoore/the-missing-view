/**
 * The results page is session data, so it does not exist unless a key is
 * configured. Locally TMV_INSIGHTS_KEY is unset, which is exactly the state
 * that must not leak anything.
 */
import { expect, test } from '@playwright/test';

test('the results are reachable without a key', async ({ request }) => {
  // A special URL protecting one page while the console beside it is wide open
  // was not protection, it was friction. Gating the console is the real answer,
  // and it is not this change.
  const res = await request.get('/api/insights');
  expect(res.status()).toBe(200);
  expect(await res.json()).toHaveProperty('sessions');
});

test('with no database it says so rather than showing zeroes', async ({ page }) => {
  await page.goto('/insights');
  await expect(page.getByText(/Nothing yet|No results yet/)).toBeVisible();
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
