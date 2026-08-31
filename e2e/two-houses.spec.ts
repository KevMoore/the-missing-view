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

test('a screen shows one house and is not sent the other', async ({ browser }) => {
  test.setTimeout(120_000);
  const { facilitator, phones, code } = await openTwoHouseRoom(browser);
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();

  // Every frame this screen is sent. The claim is about what crosses the wire,
  // not about what the page decided to render: a board that reached the browser
  // has reached the team sitting in front of it.
  const screen = await browser.newPage();
  const frames: string[] = [];
  screen.on('websocket', (ws) => {
    ws.on('framereceived', (f) => {
      if (typeof f.payload === 'string') frames.push(f.payload);
    });
  });
  await screen.goto(`/screen?code=${code}&house=h1`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await expect(screen.getByText('House One')).toBeVisible();
  await expect(screen.getByText('House Two')).toBeHidden();

  // Ben is in the second house. What he tables must never reach this screen.
  const ben = phones[1]!;
  await ben.getByRole('button', { name: 'theories' }).click();
  await ben.getByLabel('Propose a theory').fill('A theory from the other house');
  await ben.getByRole('button', { name: 'Table the theory' }).click();

  // Ana is in the first house, so hers is how we know the screen is still live.
  const ana = phones[0]!;
  await ana.getByRole('button', { name: 'theories' }).click();
  await ana.getByLabel('Propose a theory').fill('A theory from this house');
  await ana.getByRole('button', { name: 'Table the theory' }).click();
  await expect(screen.getByText('A theory from this house')).toBeVisible();

  expect(
    frames.some((f) => f.includes('A theory from the other house')),
    'the other house’s theory was sent to this screen',
  ).toBe(false);
});

test('a screen with no house is asked which one, and shows nothing until it says', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { facilitator, code } = await openTwoHouseRoom(browser);
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();

  const screen = await browser.newPage();
  await screen.goto(`/screen?code=${code}`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  await expect(screen.getByText('Which house is this screen for?')).toBeVisible();
  await expect(screen.getByText('THE SUSPECTS')).toBeHidden();

  await screen.getByRole('button', { name: 'House Two', exact: true }).click();
  await expect(screen.getByText('Which house is this screen for?')).toBeHidden();
  await expect(screen.locator('.screen-house')).toHaveText('House Two');

  // The facilitator's own monitor is allowed both, and asking again is how you
  // get it — so the choice has to survive being made.
  // Its own context: the screen remembers its house in sessionStorage, and a
  // second monitor is a second machine, not a second tab.
  const monitor = await (await browser.newContext()).newPage();
  await monitor.goto(`/screen?code=${code}`);
  await monitor.getByRole('button', { name: 'Take the stage' }).click();
  await monitor.getByRole('button', { name: /show me both/ }).click();
  await expect(monitor.getByText('Which house is this screen for?')).toBeHidden();
  await expect(monitor.getByText('House One')).toBeVisible();
  await expect(monitor.getByText('House Two')).toBeVisible();
});

test('the two houses are compared, but only once both have finished', async ({ browser }) => {
  test.setTimeout(120_000);
  const { facilitator, phones, code } = await openTwoHouseRoom(browser);
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();

  const screen = await browser.newPage();
  await screen.goto(`/screen?code=${code}&house=h1`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();

  // Straight to act 3, where one house accuses and the other does not.
  for (let i = 0; i < 2; i++) {
    await facilitator.getByRole('button', { name: /Close the act/ }).click();
    await facilitator.getByRole('button', { name: /Begin Act/ }).click();
  }
  for (const phone of [phones[0]!, phones[2]!, phones[4]!, phones[6]!]) {
    await phone.getByRole('button', { name: 'decide' }).click();
    await phone.getByLabel('The killer').selectOption({ label: 'Miss Evelyn Cross' });
    await phone.getByRole('button', { name: 'I say it was them' }).click();
  }
  await expect(phones[0]!.getByText('The house has accused')).toBeVisible({ timeout: 10_000 });

  // Mid-game there is nothing to compare: a live scoreboard is a copying aid.
  await expect(screen.getByText('How the two houses did')).toBeHidden();

  await facilitator.getByRole('button', { name: /Close the act/ }).click();
  await facilitator.getByRole('button', { name: /End the game/ }).click();
  await expect(screen.getByText('How the two houses did')).toBeVisible({ timeout: 20_000 });
  await expect(screen.locator('.compare-verdict')).toHaveText(['Solved it', 'Got it wrong']);
});
