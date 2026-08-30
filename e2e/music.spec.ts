/**
 * The big screen is the room's only speaker, so if it does not play there is
 * no music at all. Regression: the stage is taken before the screen view
 * arrives, so the first cue found no tracks and loaded nothing — and never
 * ran again, because the cue had not changed.
 */
import { expect, test } from '@playwright/test';

test('the menu theme plays once the stage is taken', async ({ browser }) => {
  const facilitator = await browser.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  expect(code).toBeTruthy();

  const screen = await browser.newPage();
  const tracks: string[] = [];
  screen.on('request', (r) => {
    if (r.url().includes('.mp3')) tracks.push(r.url());
  });
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code!);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await expect(screen.getByText(/Join on your phone/)).toBeVisible();

  await expect.poll(() => tracks.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(tracks[0]).toContain('menu-music.mp3');
});
