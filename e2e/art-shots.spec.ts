/**
 * Not an assertion suite: this drives the house to each beat of the flow and
 * writes a screenshot to /tmp/tmv-shots, so the painted backdrops and the
 * portraits can be looked at. Run with `pnpm exec playwright test art-shots`.
 */
import { expect, test, type Page } from '@playwright/test';

const OUT = '/tmp/tmv-shots';
const PLAYERS = ['Ana', 'Ben', 'Cat', 'Dev'];

test('shots of every scene', async ({ browser }) => {
  test.setTimeout(120_000);

  const facilitator = await browser.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  expect(code).toBeTruthy();

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1600, height: 900 });
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code!);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  const phones: Page[] = [];
  for (const name of PLAYERS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const phone = await ctx.newPage();
    await phone.goto('/');
    await phone.getByLabel('Room code').fill(code!);
    await phone.getByLabel('Your first name').fill(name);
    await phone.getByRole('button', { name: 'Step inside' }).click();
    await expect(phone.getByText('You’re in.')).toBeVisible();
    phones.push(phone);
  }

  const shot = async (page: Page, name: string) => {
    await page.waitForTimeout(2000); // let the backdrop cross-fade settle
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  };

  await expect(screen.getByText('Ana · Ben · Cat · Dev')).toBeVisible();
  await shot(screen, '1-lobby');

  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();
  const ana = phones[0]!;
  await expect(ana.getByText('Your private clues')).toBeVisible();
  await ana.getByRole('button', { name: 'Table it' }).first().click();
  await shot(screen, '2-act1');
  await shot(ana, '3-phone-dossier');

  await ana.getByRole('button', { name: 'suspects' }).click();
  await shot(ana, '4-phone-suspects');

  await facilitator.getByRole('button', { name: 'Close the act — open the decision' }).click();
  await shot(screen, '5-commitment');

  await facilitator.getByRole('button', { name: 'Begin Act 2' }).click();
  await shot(screen, '6-act2');
});
