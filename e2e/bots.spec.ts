/**
 * AI players, end to end: a solo facilitator seats three bots, starts the game,
 * and the evidence board fills without a second human touching a phone.
 *
 * The server runs with TMV_BOT_TICK_MS=2000 here (see playwright.config.ts) —
 * at the production 25s pace this would be a two-minute test.
 */
import { expect, test } from '@playwright/test';

test('AI players fill the room and play it without a second human', async ({ browser }) => {
  test.setTimeout(90_000);

  const facilitator = await browser.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  expect(code).toBeTruthy();

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1600, height: 900 });
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code!);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  // One human, playing solo.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctx.newPage();
  await phone.goto('/');
  await phone.getByLabel('Room code').fill(code!);
  await phone.getByLabel('Your first name').fill('Kev');
  await phone.getByRole('button', { name: 'Step inside' }).click();
  await expect(phone.getByText('You’re in.')).toBeVisible();

  // Three AI players make up the four-player minimum.
  for (let i = 0; i < 3; i++) {
    await facilitator.getByRole('button', { name: 'Add an AI player' }).click();
  }
  await expect(facilitator.getByText('AI').first()).toBeVisible();
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();

  // The board fills on its own, credited to the bots by name.
  await expect(screen.locator('.card').first()).toBeVisible({ timeout: 30_000 });
  await expect(screen.getByText(/tabled by (Hobbes|Prudence|Ellery)/).first()).toBeVisible();

  // A bot must never end the game for the human.
  await expect(screen.getByText(/The house accuses/)).toBeHidden();
});
