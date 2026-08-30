/**
 * The opening must run to the end with no narration at all — no key locally
 * means every beat falls back to its hold, and the room must never be left
 * looking at a frozen frame.
 */
import { expect, test } from '@playwright/test';

test('the facilitator plays the opening, and it runs and ends', async ({ browser }) => {
  test.setTimeout(180_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  // The control is offered only once a screen is actually there to play it on.
  await expect(con.getByRole('button', { name: 'Play the opening' })).toBeDisabled();

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1600, height: 900 });
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code!);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await expect(screen.getByText(/Join on your phone/)).toBeVisible();

  await expect(con.getByRole('button', { name: 'Play the opening' })).toBeEnabled();
  await con.getByRole('button', { name: 'Play the opening' }).click();

  await expect(screen.getByText(/The road over the moor closed at dusk/)).toBeVisible();
  await screen.screenshot({ path: '/tmp/tmv-shots/P1-prologue-open.png' });
  await expect(con.getByRole('button', { name: 'Stop the opening' })).toBeVisible();

  // it advances on its own
  await expect(screen.getByText(/eleven miles from the nearest constable/)).toBeVisible({
    timeout: 15_000,
  });
  await screen.screenshot({ path: '/tmp/tmv-shots/P2-prologue-beat2.png' });

  // the facilitator can cut it short, and the screen returns to the lobby
  await con.getByRole('button', { name: 'Stop the opening' }).click();
  await expect(screen.getByText(/Join on your phone/)).toBeVisible();
});

test('the screen hands back to the lobby when the opening finishes', async ({ browser }) => {
  test.setTimeout(180_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  const screen = await browser.newPage();
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code!);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await con.getByRole('button', { name: 'Play the opening' }).click();

  // eight beats at the fallback hold; the last line lands, then the lobby returns
  await expect(screen.getByText(/And so are you/)).toBeVisible({ timeout: 90_000 });
  await expect(screen.getByText(/Join on your phone/)).toBeVisible({ timeout: 30_000 });
  await expect(con.getByRole('button', { name: 'Play the opening' })).toBeVisible();
});
