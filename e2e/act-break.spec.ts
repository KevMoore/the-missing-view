/**
 * An act used to change silently: the board carried on with a different number
 * in the corner. The break gives the room a beat to look up and be told where
 * it stands, which is the part nobody holds in their head after twenty minutes
 * of argument.
 */
import { expect, test, type Page } from '@playwright/test';

test('a new act announces itself, recaps, and hands back', async ({ browser }) => {
  test.setTimeout(180_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1440, height: 900 });
  await screen.goto(`/screen?code=${code!}`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  const phones: Page[] = [];
  for (const n of ['Ana', 'Ben', 'Cat', 'Dev']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await p.goto(`/?code=${code!}`);
    await p.getByLabel('Your first name').fill(n);
    await p.getByRole('button', { name: 'Step inside' }).click();
    await expect(p.getByText('You’re in.')).toBeVisible();
    phones.push(p);
  }
  await con.getByRole('button', { name: /Start Act 1/ }).click();

  // Act one opens on the board, not on a card — there is nothing to recap yet.
  await expect(screen.locator('.act-break')).toHaveCount(0);
  await expect(phones[0]!.getByText('Your private clues')).toBeVisible();

  // Give the room something worth recapping.
  await phones[0]!.getByRole('button', { name: 'Table it' }).first().click();
  await phones[1]!.getByRole('button', { name: 'theories' }).click();
  await phones[1]!.getByLabel('Propose a theory').fill('The ledger is the thread');
  await phones[1]!.getByRole('button', { name: 'Table the theory' }).click();

  await con.getByRole('button', { name: /Close the act/ }).click();
  await phones[2]!.getByRole('button', { name: 'decide' }).click();
  await phones[2]!.locator('.deco-frame button').first().click();
  await con.getByRole('button', { name: 'Begin Act 2' }).click();

  // The card: the act, its opening, and where the house stands.
  const card = screen.locator('.act-break');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Act Two');
  await expect(card).toContainText('What the House Heard');
  await expect(card).toContainText(/Daybreak, grey and silent/);
  await expect(card).toContainText('You decided:');
  await expect(card).toContainText('The ledger is the thread');
  await expect(card).toContainText(/clue(s)? (is|are) on the board/);
  await screen.waitForTimeout(1200);
  const style = await card.evaluate((el) => {
    const title = el.querySelector('.act-break-title')!;
    const cs = getComputedStyle(title);
    const box = title.getBoundingClientRect();
    return {
      colour: cs.color,
      opacity: getComputedStyle(el).opacity,
      zIndex: getComputedStyle(el).zIndex,
      top: Math.round(box.top),
      onTop: document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        ?.className,
    };
  });
  console.log('TITLE', JSON.stringify(style));
  await screen.screenshot({ path: '/tmp/tmv-shots/AB-act-break.png' });

  // And it hands back to the act on its own.
  await expect(card).toHaveCount(0, { timeout: 40_000 });
  await expect(screen.getByText('The evidence board')).toBeVisible();
});

test('a screen joining mid-act is not shown a card for an act already running', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  for (let i = 0; i < 3; i++) await con.getByRole('button', { name: 'Add an AI player' }).click();

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctx.newPage();
  await phone.goto(`/?code=${code!}`);
  await phone.getByLabel('Your first name').fill('Kev');
  await phone.getByRole('button', { name: 'Step inside' }).click();
  await expect(phone.getByText('You’re in.')).toBeVisible();
  await con.getByRole('button', { name: /Start Act 1/ }).click();

  const late = await browser.newPage();
  await late.setViewportSize({ width: 1440, height: 900 });
  await late.goto(`/screen?code=${code!}`);
  await late.getByRole('button', { name: 'Take the stage' }).click();
  await expect(late.getByText('The evidence board')).toBeVisible();
  expect(await late.locator('.act-break').count()).toBe(0);
});
