/**
 * Five portraits and one voice. Without a mark on the speaker the room has to
 * work out which of the five it is listening to, which is a thing to be doing
 * while also listening.
 */
import { expect, test } from '@playwright/test';

test('the answering suspect is lit, and only while they answer', async ({ browser }) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  for (let i = 0; i < 3; i++) await con.getByRole('button', { name: 'Add an AI player' }).click();

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1440, height: 900 });
  // Hold the reply open long enough to observe the highlight while it plays.
  await screen.route('**/voice/**', async (route) => {
    if (!route.request().url().includes('/ask-')) await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await screen.goto(`/screen?code=${code!}`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctx.newPage();
  await phone.goto(`/?code=${code!}`);
  await phone.getByLabel('Your first name').fill('Kev');
  await phone.getByRole('button', { name: 'Step inside' }).click();
  await expect(phone.getByText('You’re in.')).toBeVisible();
  await con.getByRole('button', { name: /Start Act 1/ }).click();

  // Nobody is speaking yet.
  await expect(screen.locator('.suspect.speaking')).toHaveCount(0);

  await phone.getByRole('button', { name: 'suspects' }).click();
  await phone.getByLabel('Choose a suspect').selectOption({ label: 'Mr Thomas Reeves' });
  await phone.getByLabel('Your question').fill('Were the doors bolted all night?');
  await phone.getByRole('button', { name: 'Put it to them' }).click();

  // Exactly one, and it is the suspect who was asked.
  const lit = screen.locator('.suspect.speaking');
  await expect(lit).toHaveCount(1, { timeout: 30_000 });
  await expect(lit).toContainText('Mr Thomas Reeves');

  // And it goes out again when they stop.
  await expect(screen.locator('.suspect.speaking')).toHaveCount(0, { timeout: 30_000 });
});
