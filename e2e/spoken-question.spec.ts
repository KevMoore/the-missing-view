/**
 * The room used to read the question and hear only the reply. It now hears an
 * exchange between two people, each in the voice of the character asking or
 * answering.
 */
import { expect, test } from '@playwright/test';

test('the question is spoken before the reply, in that order', async ({ browser }) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  for (let i = 0; i < 3; i++) await con.getByRole('button', { name: 'Add an AI player' }).click();

  const screen = await browser.newPage();
  const played: string[] = [];
  screen.on('response', (r) => {
    const m = /\/voice\/[0-9A-F]{6}\/(?:[\w-]+\/)?(ask-)?(.+)\.mp3/.exec(r.url());
    if (m) played.push(m[1] ? 'question' : 'answer');
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

  await phone.getByRole('button', { name: 'suspects' }).click();
  await phone.getByLabel('Choose a suspect').selectOption({ label: 'Mr Thomas Reeves' });
  await phone.getByLabel('Your question').fill('Were the doors bolted all night?');
  await phone.getByRole('button', { name: 'Put it to them' }).click();

  await expect.poll(() => played.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
  expect(played[0], 'the reply was heard before the question').toBe('question');
  expect(played[1]).toBe('answer');
});
