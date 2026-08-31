/**
 * Not an assertion suite: drives a two-house game and writes screenshots so the
 * casting table and the split screen can be looked at rather than guessed at.
 * Run with `pnpm exec playwright test two-house-shots`.
 */
import { expect, test, type Page } from '@playwright/test';

const OUT = '/tmp/tmv-shots-2h';
const PLAYERS = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

test('shots of a two-house game', async ({ browser }) => {
  test.setTimeout(240_000);

  const facilitator = await browser.newPage();
  await facilitator.setViewportSize({ width: 900, height: 1400 });
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: /Two houses, head to head/ }).click();
  await facilitator.screenshot({ path: `${OUT}/00-mode.png`, fullPage: true });
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  expect(code).toBeTruthy();

  // One screen per house, as the room would be set up.
  const screens: Page[] = [];
  for (const house of ['h1', 'h2']) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`/screen?code=${code!}&house=${house}`);
    await page.getByRole('button', { name: 'Take the stage' }).click();
    screens.push(page);
  }
  const screen = screens[0]!;

  const phones: Page[] = [];
  for (const name of PLAYERS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const phone = await ctx.newPage();
    await phone.goto(`/?code=${code!}`);
    await phone.getByLabel('Your first name').fill(name);
    await phone.getByRole('button', { name: 'Step inside' }).click();
    phones.push(phone);
  }

  await facilitator.getByRole('button', { name: /Ana/ }).click();
  await facilitator.locator('.cast-card').first().waitFor();
  await facilitator.screenshot({ path: `${OUT}/01-casting.png`, fullPage: true });
  await facilitator.locator('.cast-card').nth(2).click();
  await facilitator.screenshot({ path: `${OUT}/02-cast.png`, fullPage: true });

  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();
  await screen.waitForTimeout(1500);
  await screen.screenshot({ path: `${OUT}/03-act1-empty.png` });
  await phones[0]!.screenshot({ path: `${OUT}/04-phone.png` });

  // Fill both boards, so the split is worth looking at.
  for (const [i, phone] of phones.entries()) {
    await phone.getByRole('button', { name: 'dossier' }).click();
    for (const button of await phone.getByRole('button', { name: 'Table it' }).all())
      await button.click().catch(() => undefined);
    await phone.getByRole('button', { name: 'theories' }).click();
    await phone.getByLabel('Propose a theory').fill(`Theory number ${String(i + 1)}`);
    await phone.getByRole('button', { name: 'Table the theory' }).click();
  }
  await phones[0]!.getByRole('button', { name: 'suspects' }).click();
  await phones[0]!.getByLabel('Your question').fill('Where were you at midnight?');
  await phones[0]!.getByRole('button', { name: 'Put it to them' }).click();
  await phones[1]!.getByRole('button', { name: 'suspects' }).click();
  await phones[1]!.getByLabel('Your question').fill('Who else had a key?');
  await phones[1]!.getByRole('button', { name: 'Put it to them' }).click();
  await screen.waitForTimeout(3000);
  await screen.screenshot({ path: `${OUT}/05-house-one.png` });
  await screens[1]!.screenshot({ path: `${OUT}/05-house-two.png` });

  // Straight to act 3 and an accusation from each house.
  for (let i = 0; i < 2; i++) {
    await facilitator.getByRole('button', { name: /Close the act/ }).click();
    await facilitator.getByRole('button', { name: /Begin Act/ }).click();
  }
  await screen.waitForTimeout(2000);
  for (const phone of phones) {
    await phone.getByRole('button', { name: 'decide' }).click();
    await phone.getByLabel('The killer').selectOption({ index: 1 });
    await phone.getByRole('button', { name: 'I say it was them' }).click();
  }
  await phones[0]!.screenshot({ path: `${OUT}/06-accusing.png` });
  await screen.waitForTimeout(1500);
  await screen.screenshot({ path: `${OUT}/07-accused.png` });

  await facilitator.getByRole('button', { name: /Close the act/ }).click();
  await facilitator.getByRole('button', { name: /End the game/ }).click();
  await screen.waitForTimeout(3000);
  await screen.screenshot({ path: `${OUT}/08-reveal.png`, fullPage: true });
  await facilitator.screenshot({ path: `${OUT}/09-console-reveal.png`, fullPage: true });

  // Ten pages, each with a live socket and an audio element. Left open, the run
  // writes every shot and then hangs until the test times out.
  for (const page of [facilitator, ...screens, ...phones]) await page.close();
});
