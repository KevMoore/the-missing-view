/**
 * Opening the big screen used to mean switching tabs, reading six characters
 * off the console and typing them into the screen. And in a right-aligned row a
 * face placed before the name floats wherever the name happens to start, so a
 * column of them staggers.
 */
import { expect, test, type Page } from '@playwright/test';

test('the console hands the screen its room code', async ({ browser }) => {
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  // The link on the page carries it, so it can be read out or opened either way.
  await expect(con.getByText(`/screen?code=${code!}`)).toBeVisible();

  const screen = await browser.newPage();
  await screen.goto(`/screen?code=${code!}`);
  await expect(screen.getByLabel('Room code')).toHaveValue(code!);

  // Prefilled but never auto-joined: this click is the only gesture the screen
  // gets, and on iOS it is what buys permission to make a sound all night.
  await expect(screen.getByText(/Join on your phone/)).toHaveCount(0);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await expect(screen.getByText(/Join on your phone/)).toBeVisible();
});

test('the faces line up against the edge rather than staggering', async ({ browser }) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1440, height: 900 });
  await screen.goto(`/screen?code=${code!}`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  // Names of deliberately different lengths — the stagger only shows up then.
  const phones: Page[] = [];
  for (const n of ['Al', 'Bernadette', 'Cy', 'Dominique']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(`/?code=${code!}`);
    await p.getByLabel('Your first name').fill(n);
    await p.getByRole('button', { name: 'Step inside' }).click();
    await expect(p.getByText('You’re in.')).toBeVisible();
    phones.push(p);
  }
  await con.getByRole('button', { name: /Start Act 1/ }).click();
  for (const p of phones) {
    await expect(p.getByText('Your private clues')).toBeVisible();
    for (let i = 0; i < 2; i++) {
      const b = p.getByRole('button', { name: 'Table it' }).first();
      if ((await b.count()) === 0) break;
      await b.click({ timeout: 5000 }).catch(() => undefined);
      await p.waitForTimeout(150);
    }
  }
  await screen.waitForTimeout(1200);

  const rights = await screen
    .locator('.card-slim .who-face')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
  expect(rights.length, 'no slim rows to measure').toBeGreaterThan(2);
  expect(new Set(rights).size, `faces sit at ${rights.join(', ')} — they stagger`).toBe(1);
});
