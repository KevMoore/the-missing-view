/**
 * The front door serves two audiences at one address. A player who scans the
 * QR code must never pay for the landing page.
 */
import { expect, test } from '@playwright/test';

test('a scanned QR code goes straight to the join form', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctx.newPage();
  await phone.goto('/?code=ABC123');

  await expect(phone.getByLabel('Room code')).toHaveValue('ABC123');
  await expect(phone.getByLabel('Your first name')).toBeVisible();
  await expect(phone.getByRole('heading', { name: 'How it works' })).toHaveCount(0);
  await expect(phone.getByRole('link', { name: /facilitator console/ })).toHaveCount(0);
});

test('a cold visit gets the landing page, and can still join from it', async ({ browser }) => {
  const facilitator = await browser.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  expect(code).toBeTruthy();

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctx.newPage();
  await phone.goto('/');

  // It says what the game is and how to run it.
  await expect(phone.getByText('One mystery. Different perspectives.')).toBeVisible();
  await expect(phone.getByRole('link', { name: /facilitator console/ })).toBeVisible();
  await expect(phone.getByText('One phone per player.')).toBeVisible();

  // And a player who typed the address still joins from this page, in two taps.
  await phone.getByLabel('Room code').fill(code!);
  await phone.getByLabel('Your first name').fill('Kev');
  await phone.getByRole('button', { name: 'Step inside' }).click();
  await expect(phone.getByText('You’re in.')).toBeVisible();
});
