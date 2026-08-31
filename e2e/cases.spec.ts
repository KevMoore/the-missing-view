/**
 * Drafting a case writes a file; appearing in the published registry is what
 * makes it playable, and that stays a human act (D14). The console offers
 * whatever is published.
 */
import { expect, test } from '@playwright/test';

test('the console names the published case and opens it', async ({ page }) => {
  await page.goto('/console');
  // One case is the common state and gets a sentence, not a dropdown.
  await expect(page.getByText(/Death at Blackwood Hall — 4–8 players/)).toBeVisible();
  await page.getByRole('button', { name: 'Open the house' }).click();
  await expect(page.getByText(/Room [0-9A-F]{6}/)).toBeVisible();
});
