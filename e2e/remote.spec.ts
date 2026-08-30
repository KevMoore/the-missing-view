/**
 * PRD §13 asks for remote/online play; D1 built co-located. The game itself
 * never cared — phones have always connected over a WebSocket from anywhere —
 * but a QR code on a shared screen is useless, and the instructions were wrong.
 */
import { expect, test } from '@playwright/test';

test('the console switches between a room and a call, and the link carries the code', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const con = await ctx.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  // In-room is the default: scan the QR on the big screen.
  await expect(con.getByText(/scans the QR code on the big screen/)).toBeVisible();
  await expect(con.getByRole('button', { name: /Copy invite link/ })).toHaveCount(0);

  await con.getByRole('button', { name: 'Everyone on a call' }).click();
  await expect(con.getByText(/share that tab in your call/)).toBeVisible();
  await expect(con.getByText(/Paste this into the call chat/)).toBeVisible();

  // The link is a working join URL with the room code already in it.
  await con.getByRole('button', { name: 'Copy invite link' }).click();
  await expect(con.getByRole('button', { name: 'Copied ✓' })).toBeVisible();
  const link = await con.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain(`?code=${code!}`);

  // And it really does put a player straight into the join form, prefilled.
  const phone = await ctx.newPage();
  await phone.goto(link);
  await expect(phone.getByLabel('Room code')).toHaveValue(code!);
  await phone.getByLabel('Your first name').fill('Remote');
  await phone.getByRole('button', { name: 'Step inside' }).click();
  await expect(phone.getByText('You’re in.')).toBeVisible();
  await expect(con.getByText('Remote')).toBeVisible();

  // The choice survives a reload — a facilitator sets it once, not every game.
  await con.reload();
  await expect(con.getByText(/Paste this into the call chat/)).toBeVisible();
});
