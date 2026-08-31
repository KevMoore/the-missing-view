/**
 * The score is a bed under the narration, not a cue over it. Regression: two
 * independent owners duck the music — the opening for its narrator, the suspect
 * queue for a reply — and a plain boolean let whichever ran last win. Child
 * effects run before parent effects, so the idle voice queue cleared the
 * opening's duck the instant it was set and the narration played over an
 * undipped score.
 */
import { expect, test } from '@playwright/test';

/** Read the level off the score element itself, not off our own bookkeeping. */
const level = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLAudioElement>('audio[data-role="score"]');
    return el ? { volume: el.volume, paused: el.paused, src: el.currentSrc } : null;
  });

test('the score sits under the opening, not over it', async ({ browser }) => {
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
  await expect(screen.getByText(/Join on your phone/)).toBeVisible();

  // the lobby theme carries the room on its own
  await expect.poll(async () => (await level(screen))?.volume ?? 0).toBeGreaterThan(0.4);

  await con.getByRole('button', { name: 'Play the opening' }).click();
  await expect(screen.getByText(/The road over the moor closed at dusk/)).toBeVisible();

  // and under the opening it drops right back, and stays there
  await expect
    .poll(async () => (await level(screen))?.volume ?? 1, { timeout: 15_000 })
    .toBeLessThan(0.1);
  await screen.waitForTimeout(4000);
  const settled = await level(screen);
  expect(settled?.volume ?? 1, 'the duck was lifted by the idle voice queue').toBeLessThan(0.1);
  expect(settled?.src).toContain('prologue');
});

test('a speaking suspect takes the score right down', async ({ browser }) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  for (let i = 0; i < 3; i++) await con.getByRole('button', { name: 'Add an AI player' }).click();

  const screen = await browser.newPage();
  const spoken: string[] = [];
  screen.on('response', (r) => {
    if (r.url().includes('/voice/')) spoken.push(r.url());
  });
  await screen.setViewportSize({ width: 1440, height: 900 });
  await screen.goto(`/screen?code=${code!}`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctx.newPage();
  await phone.goto(`/?code=${code!}`);
  await phone.getByLabel('Your first name').fill('Kev');
  await phone.getByRole('button', { name: 'Step inside' }).click();
  await expect(phone.getByText('You’re in.')).toBeVisible();
  await con.getByRole('button', { name: /Start Act 1/ }).click();

  // in-game, nobody speaking: the bed is audible
  await expect.poll(() => level(screen).then((l) => l?.volume ?? 0)).toBeGreaterThan(0.1);

  await phone.getByRole('button', { name: 'suspects' }).click();
  await phone.getByLabel('Choose a suspect').selectOption({ label: 'Mr Thomas Reeves' });
  await phone.getByLabel('Your question').fill('Were the doors bolted all night?');
  await phone.getByRole('button', { name: 'Put it to them' }).click();

  // the screen fetches the reply as audio...
  await expect.poll(() => spoken.length, { timeout: 20_000 }).toBeGreaterThan(0);
  // ...and while it plays, the score gets right out of the way
  await expect
    .poll(() => level(screen).then((l) => l?.volume ?? 1), { timeout: 10_000 })
    .toBeLessThan(0.05);
});
