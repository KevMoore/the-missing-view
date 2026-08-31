/**
 * Two houses playing one case head to head (D38).
 *
 * The claim worth testing is the negative one: a house cannot see the other
 * house's work. Everything else — the split, the casting, the comparison — is
 * setup around that. It is checked on the phone rather than the big screen,
 * because the big screen is shared on purpose and shows both.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

const NAMES = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

async function openTwoHouseRoom(browser: Browser) {
  const facilitator = await browser.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: /Two houses, head to head/ }).click();
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1] ?? '';
  expect(code).toHaveLength(6);

  const phones: Page[] = [];
  for (const name of NAMES) {
    const ctx = await browser.newContext();
    const phone = await ctx.newPage();
    await phone.goto('/');
    await phone.getByLabel('Room code').fill(code);
    await phone.getByLabel('Your first name').fill(name);
    await phone.getByRole('button', { name: 'Step inside' }).click();
    await expect(phone.getByText('You’re in.')).toBeVisible();
    phones.push(phone);
  }
  return { facilitator, phones, code };
}

test('a house never sees the other house’s board', async ({ browser }) => {
  test.setTimeout(120_000);
  const { facilitator, phones } = await openTwoHouseRoom(browser);

  // Players land in the emptier house as they arrive, so eight people split
  // themselves and the facilitator only moves the ones they want moved.
  await expect(
    facilitator.getByRole('button', { name: /Start Act 1 \(House One 4 · House Two 4/ }),
  ).toBeEnabled();
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();

  // Arriving alternately puts Ana in the first house and Ben in the second.
  const ana = phones[0]!;
  const ben = phones[1]!;
  await expect(ana.getByText('House One')).toBeVisible();
  await expect(ben.getByText('House Two')).toBeVisible();

  await ana.getByRole('button', { name: 'theories' }).click();
  await ana.getByLabel('Propose a theory').fill('It was the gardener, obviously');
  await ana.getByRole('button', { name: 'Table the theory' }).click();
  await expect(ana.getByText(/It was the gardener/)).toBeVisible();

  // The other house is playing the same case and has no idea.
  await ben.getByRole('button', { name: 'theories' }).click();
  await expect(ben.getByText(/It was the gardener/)).toBeHidden();

  // Nor can Ben whisper to somebody in the other house: a move to a player who
  // is not in your game has nowhere to land.
  await ben.getByRole('button', { name: 'dossier' }).click();
  await ben.getByRole('button', { name: 'Whisper' }).first().click();
  await expect(ben.getByRole('button', { name: 'to Dev' })).toBeVisible();
  await expect(ben.getByRole('button', { name: 'to Ana' })).toBeHidden();
});

test('the facilitator casts a player and moves them between houses', async ({ browser }) => {
  test.setTimeout(120_000);
  const { facilitator, phones } = await openTwoHouseRoom(browser);

  // Pick a person, then pick a face.
  await facilitator.getByRole('button', { name: /^Ana/ }).click();
  const card = facilitator.locator('.cast-card').first();
  const characterName = (await card.locator('.cast-name').textContent()) ?? '';
  await card.click();
  await expect(facilitator.getByText(`Ana is ${characterName}`)).toBeVisible();

  // A character somebody already has cannot be handed to anybody else.
  await facilitator.getByRole('button', { name: /^Ben/ }).click();
  await expect(facilitator.locator('.cast-card.gone').first()).toBeVisible();

  // Ben arrived in the second house. Moving him to the first leaves the second
  // three strong, and the start button says so rather than dealing a bad game.
  await facilitator.getByRole('button', { name: 'House One', exact: true }).click();
  await expect(facilitator.getByRole('button', { name: /Start Act 1/ })).toBeDisabled();
  await facilitator.getByRole('button', { name: 'House Two', exact: true }).click();
  await expect(facilitator.getByRole('button', { name: /Start Act 1/ })).toBeEnabled();

  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();
  // Ana is playing the part she was given, not one drawn from the hat.
  await expect(phones[0]!.getByText(characterName).first()).toBeVisible();
});
