/**
 * One dead phone in act 3 used to stop a house that had already agreed.
 *
 * The accusation waits for everybody (D36), which is right — but a battery that
 * goes at the wrong minute is not a disagreement, and the game recorded those
 * rooms as having never decided at all. This drives the real failure: a phone
 * closes with its player's name still uncommitted.
 */
import { expect, test, type Page } from '@playwright/test';

test('the house may accuse without a phone that has gone, but not without a person who is there', async ({
  browser,
}) => {
  test.setTimeout(120_000);

  const facilitator = await browser.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1] ?? '';

  const phones: Page[] = [];
  for (const name of ['Ana', 'Ben', 'Cat', 'Dev']) {
    const ctx = await browser.newContext();
    const phone = await ctx.newPage();
    await phone.goto(`/?code=${code}`);
    await phone.getByLabel('Your first name').fill(name);
    await phone.getByRole('button', { name: 'Step inside' }).click();
    await expect(phone.getByText('You’re in.')).toBeVisible();
    phones.push(phone);
  }
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();
  for (let i = 0; i < 2; i++) {
    await facilitator.getByRole('button', { name: /Close the act/ }).click();
    await facilitator.getByRole('button', { name: /Begin Act/ }).click();
  }

  // While everybody is present, the house waits — including for Dev, who is
  // sitting right there and has not made up their mind.
  for (const phone of phones.slice(0, 3)) {
    await phone.getByRole('button', { name: 'decide' }).click();
    await phone.getByLabel('The killer').selectOption({ label: 'Miss Evelyn Cross' });
    await phone.getByRole('button', { name: 'I say it was them' }).click();
  }
  const ana = phones[0]!;
  await expect(ana.getByText('1 still to say.')).toBeVisible();
  await expect(
    facilitator.getByRole('button', { name: 'Accuse without them' }),
    'a connected player could be talked over',
  ).toBeHidden();

  // Dev's phone dies.
  await phones[3]!.close();
  await expect(facilitator.getByRole('button', { name: 'Accuse without them' })).toBeVisible({
    timeout: 15_000,
  });

  // The three who agreed were already agreed; standing Dev down is what seals
  // it, so the rule cannot live inside the commit handler alone.
  await facilitator.getByRole('button', { name: 'Accuse without them' }).click();
  await expect(ana.getByText('The house has accused')).toBeVisible({ timeout: 10_000 });
  await expect(ana.getByText('Miss Evelyn Cross')).toBeVisible();

  await facilitator.getByRole('button', { name: /Close the act/ }).click();
  await facilitator.getByRole('button', { name: /End the game/ }).click();
  // And it is recorded as a house that decided, which is the whole point.
  await expect(facilitator.getByText(/they were right/)).toBeVisible({ timeout: 20_000 });
});
