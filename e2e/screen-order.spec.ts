/** The newest thing must be at the top: nobody can scroll a television. */
import { expect, test, type Page } from '@playwright/test';

test('the screen leads with the newest theory, question and clue', async ({ browser }) => {
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

  const phones: Page[] = [];
  for (const name of ['Ana', 'Ben', 'Cat', 'Dev']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(`/?code=${code!}`);
    await p.getByLabel('Your first name').fill(name);
    await p.getByRole('button', { name: 'Step inside' }).click();
    await expect(p.getByText('You’re in.')).toBeVisible();
    phones.push(p);
  }
  await con.getByRole('button', { name: /Start Act 1/ }).click();

  // Everyone tables everything they hold, so the board fills past the two full
  // cards. Bounded on purpose: another spec severs every socket on this server,
  // and an open-ended click loop would spin on a re-rendering list forever.
  for (const p of phones) {
    await expect(p.getByText('Your private clues')).toBeVisible();
    const held = await p.getByRole('button', { name: 'Table it' }).count();
    for (let i = 0; i < held; i++) {
      const button = p.getByRole('button', { name: 'Table it' }).first();
      if ((await button.count()) === 0) break;
      await button.click({ timeout: 5000 }).catch(() => undefined);
      await p.waitForTimeout(150);
    }
  }

  // three theories, oldest to newest
  for (const [i, p] of phones.slice(0, 3).entries()) {
    await p.getByRole('button', { name: 'theories' }).click();
    await p.getByLabel('Propose a theory').fill(`Theory number ${String(i + 1)}`);
    await p.getByRole('button', { name: 'Table the theory' }).click();
    await p.waitForTimeout(200);
  }

  await screen.waitForTimeout(1000);
  await screen.screenshot({ path: '/tmp/tmv-shots/S1-busy-screen.png' });

  // the newest theory sits above the oldest one on the screen
  const newest = await screen.getByText('Theory number 3').boundingBox();
  const oldest = await screen.getByText('Theory number 1').boundingBox();
  expect(newest!.y).toBeLessThan(oldest!.y);

  // the newest clue reads in full; older ones stay on the board as titles only
  const board = screen.locator('.board-list');
  const full = board.locator('.card').first();
  await expect(full.locator('h3')).toBeVisible();
  await expect(board.locator('.card-slim').first()).toBeVisible();

  // and the newest tabled clue sits above the older, slim ones
  const newestCard = await full.boundingBox();
  const slim = await board.locator('.card-slim').first().boundingBox();
  expect(newestCard!.y).toBeLessThan(slim!.y);
});
