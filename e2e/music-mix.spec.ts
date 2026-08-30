/**
 * The score is a bed under the narration, not a cue over it. Regression: two
 * independent owners duck the music — the opening for its narrator, the suspect
 * queue for a reply — and a plain boolean let whichever ran last win. Child
 * effects run before parent effects, so the idle voice queue cleared the
 * opening's duck the instant it was set and the narration played over an
 * undipped score.
 */
import { expect, test } from '@playwright/test';

/** Read the level off the score element itself, not off our own bookkeeping. */
const level = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLAudioElement>('audio[data-role="score"]');
    return el ? { volume: el.volume, paused: el.paused, src: el.currentSrc } : null;
  });

test('the score sits under the opening, not over it', async ({ browser }) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1600, height: 900 });
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code!);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await expect(screen.getByText(/Join on your phone/)).toBeVisible();

  // the lobby theme carries the room on its own
  await expect.poll(async () => (await level(screen))?.volume ?? 0).toBeGreaterThan(0.4);

  await con.getByRole('button', { name: 'Play the opening' }).click();
  await expect(screen.getByText(/The road over the moor closed at dusk/)).toBeVisible();

  // and under the opening it drops right back, and stays there
  await expect
    .poll(async () => (await level(screen))?.volume ?? 1, { timeout: 15_000 })
    .toBeLessThan(0.1);
  await screen.waitForTimeout(4000);
  const settled = await level(screen);
  expect(settled?.volume ?? 1, 'the duck was lifted by the idle voice queue').toBeLessThan(0.1);
  expect(settled?.src).toContain('prologue');
});
