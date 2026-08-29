/**
 * The production failure of 2026-08-29: a proxy (or sleep/wake) drops the
 * WebSocket; the client reconnects the socket but never re-joins the room.
 * Every surface must resume its seat after a connection loss.
 */
import { expect, test } from '@playwright/test';

test('console, screen and phone all resume after a dropped connection', async ({ browser }) => {
  // --- facilitator opens the house ---
  const facCtx = await browser.newContext();
  const facilitator = await facCtx.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')![1]!;

  // --- screen up, one phone in ---
  const screenCtx = await browser.newContext();
  const screen = await screenCtx.newPage();
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  const phoneCtx = await browser.newContext();
  const phone = await phoneCtx.newPage();
  await phone.goto('/');
  await phone.getByLabel('Room code').fill(code);
  await phone.getByLabel('Your first name').fill('Ana');
  await phone.getByRole('button', { name: 'Step inside' }).click();
  await expect(facilitator.getByText('Ana')).toBeVisible();

  // --- the proxy severs EVERY socket (what Render does to idle connections) ---
  await facilitator.request.post('/test/drop-connections');
  await facilitator.waitForTimeout(1200);

  // A second player joins AFTER the drop: the reconnected console must see them.
  const phone2Ctx = await browser.newContext();
  const phone2 = await phone2Ctx.newPage();
  await phone2.goto('/');
  await phone2.getByLabel('Room code').fill(code);
  await phone2.getByLabel('Your first name').fill('Ben');
  await phone2.getByRole('button', { name: 'Step inside' }).click();

  await expect(facilitator.getByText('Ben')).toBeVisible({ timeout: 15_000 });
  await expect(facilitator.getByText('Ana')).toBeVisible();

  // --- everything severed again; the screen must come back showing the lobby ---
  await facilitator.request.post('/test/drop-connections');
  await expect(screen.getByText('Ana · Ben')).toBeVisible({ timeout: 15_000 });

  // --- two more join, game starts, then the PHONE drops mid-act ---
  for (const name of ['Cat', 'Dev']) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/');
    await p.getByLabel('Room code').fill(code);
    await p.getByLabel('Your first name').fill(name);
    await p.getByRole('button', { name: 'Step inside' }).click();
  }
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();
  await expect(phone.getByText('Your private clues')).toBeVisible();
  const handBefore = await phone.locator('.card h3').allTextContents();

  await facilitator.request.post('/test/drop-connections');
  await phone.waitForTimeout(1200);

  // Same seat, same hand — and still able to act.
  await expect(phone.getByText('Your private clues')).toBeVisible({ timeout: 15_000 });
  const handAfter = await phone.locator('.card h3').allTextContents();
  expect(handAfter).toEqual(handBefore);
  await phone.getByRole('button', { name: 'Table it' }).first().click();
  await expect(screen.getByText('tabled by Ana')).toBeVisible({ timeout: 15_000 });
});

test('a console page reload resumes its room', async ({ browser }) => {
  const ctx = await browser.newContext();
  const facilitator = await ctx.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')![1]!;

  await facilitator.reload();
  await expect(facilitator.getByText(new RegExp(`Room ${code}`))).toBeVisible({ timeout: 15_000 });
});
