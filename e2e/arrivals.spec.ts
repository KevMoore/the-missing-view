/**
 * The screen is handed a whole new view several times a second, so "a clue has
 * arrived" is not otherwise something it knows — every card looks equally new.
 * These assert that only what actually moved lights up, and that a reconnecting
 * screen does not announce the entire board at once.
 */
import { expect, test, type Page } from '@playwright/test';

const room = async (browser: import('@playwright/test').Browser) => {
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const text = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  return { con, code: /Room ([0-9A-F]{6})/.exec(text ?? '')?.[1] ?? '' };
};

const seat = async (browser: import('@playwright/test').Browser, code: string, name: string) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(`/?code=${code}`);
  await p.getByLabel('Your first name').fill(name);
  await p.getByRole('button', { name: 'Step inside' }).click();
  await expect(p.getByText('You’re in.')).toBeVisible();
  return p;
};

test('a clue lights up as it lands, and only that clue', async ({ browser }) => {
  test.setTimeout(120_000);
  const { con, code } = await room(browser);
  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1440, height: 900 });
  await screen.goto(`/screen?code=${code}`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  const phones: Page[] = [];
  for (const n of ['Ana', 'Ben', 'Cat', 'Dev']) phones.push(await seat(browser, code, n));
  await con.getByRole('button', { name: /Start Act 1/ }).click();
  await expect(phones[0]!.getByText('Your private clues')).toBeVisible();

  await phones[0]!.getByRole('button', { name: 'Table it' }).first().click();
  await expect(screen.locator('.card.just-in')).toHaveCount(1);

  // and it settles again rather than staying lit
  await expect(screen.locator('.just-in')).toHaveCount(0, { timeout: 5000 });

  // a second clue lights only itself
  await phones[1]!.getByRole('button', { name: 'Table it' }).first().click();
  await expect(screen.locator('.just-in')).toHaveCount(1);
});

test('a backed theory flashes without pretending to be new', async ({ browser }) => {
  test.setTimeout(120_000);
  const { con, code } = await room(browser);
  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1440, height: 900 });
  await screen.goto(`/screen?code=${code}`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  const phones: Page[] = [];
  for (const n of ['Ana', 'Ben', 'Cat', 'Dev']) phones.push(await seat(browser, code, n));
  await con.getByRole('button', { name: /Start Act 1/ }).click();

  await phones[0]!.getByRole('button', { name: 'theories' }).click();
  await phones[0]!.getByLabel('Propose a theory').fill('The ledger is the thread');
  await phones[0]!.getByRole('button', { name: 'Table the theory' }).click();
  await expect(screen.locator('.card.just-in')).toHaveCount(1);
  await expect(screen.locator('.just-in')).toHaveCount(0, { timeout: 5000 });

  await phones[1]!.getByRole('button', { name: 'theories' }).click();
  await phones[1]!.getByRole('button', { name: 'Challenge' }).click();
  // it moved, but it did not arrive
  await expect(screen.locator('.card.just-moved')).toHaveCount(1);
  await expect(screen.locator('.card.just-in')).toHaveCount(0);
});

test('a screen joining mid-act does not announce the whole board', async ({ browser }) => {
  test.setTimeout(120_000);
  const { con, code } = await room(browser);
  const first = await browser.newPage();
  await first.goto(`/screen?code=${code}`);
  await first.getByRole('button', { name: 'Take the stage' }).click();

  const phones: Page[] = [];
  for (const n of ['Ana', 'Ben', 'Cat', 'Dev']) phones.push(await seat(browser, code, n));
  await con.getByRole('button', { name: /Start Act 1/ }).click();
  for (const p of phones.slice(0, 3)) {
    await expect(p.getByText('Your private clues')).toBeVisible();
    await p.getByRole('button', { name: 'Table it' }).first().click();
    await p.waitForTimeout(200);
  }

  // a fresh screen arrives to a board that is already full
  const late = await browser.newPage();
  await late.setViewportSize({ width: 1440, height: 900 });
  await late.goto(`/screen?code=${code}`);
  await late.getByRole('button', { name: 'Take the stage' }).click();
  await expect(late.locator('.card').first()).toBeVisible();
  expect(await late.locator('.just-in').count(), 'the whole board lit up at once').toBe(0);
});
