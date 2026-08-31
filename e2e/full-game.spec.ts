/**
 * The whole evening, end to end: facilitator opens the house, the screen
 * takes the stage, five phones join, three acts play out, the reveal lands
 * with the correct visibility rules (D11).
 */
import { expect, test, type Page } from '@playwright/test';

const PLAYERS = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

test('a full game of Death at Blackwood Hall', async ({ browser }) => {
  // --- facilitator opens the house ---
  const facilitator = await browser.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  await expect(facilitator.getByText(/Room [0-9A-F]{6}/)).toBeVisible();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  expect(code).toBeTruthy();

  // --- the big screen joins ---
  const screen = await browser.newPage();
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code!);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await expect(screen.getByText(code!)).toBeVisible(); // lobby shows the join code

  // --- five phones join (isolated contexts: separate localStorage) ---
  const phones: Page[] = [];
  for (const name of PLAYERS) {
    const ctx = await browser.newContext();
    const phone = await ctx.newPage();
    await phone.goto('/');
    await phone.getByLabel('Room code').fill(code!);
    await phone.getByLabel('Your first name').fill(name);
    await phone.getByRole('button', { name: 'Step inside' }).click();
    await expect(phone.getByText('You’re in.')).toBeVisible();
    phones.push(phone);
  }
  await expect(screen.getByText('Ana · Ben · Cat · Dev · Eve')).toBeVisible();

  // --- act 1 ---
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();
  const ana = phones[0]!;
  await expect(ana.getByText('Your private clues')).toBeVisible();

  // Ana tables her first clue; it lands on the screen credited to her.
  const clueTitle = await ana.locator('.card h3').first().textContent();
  await ana.getByRole('button', { name: 'Table it' }).first().click();
  await expect(screen.getByText(`tabled by Ana`)).toBeVisible();
  await expect(screen.getByRole('heading', { name: clueTitle! })).toBeVisible();

  // Ben interrogates the butler; question and answer play on the screen.
  const ben = phones[1]!;
  await ben.getByRole('button', { name: 'suspects' }).click();
  await ben.getByLabel('Choose a suspect').selectOption({ label: 'Mr Thomas Reeves' });
  await ben.getByLabel('Your question').fill('Were the doors bolted all night?');
  await ben.getByRole('button', { name: 'Put it to them' }).click();
  await expect(screen.getByText(/Ben asks Mr Thomas Reeves/)).toBeVisible();
  await expect(screen.getByText(/bolted/).last()).toBeVisible({ timeout: 15_000 });

  // Cat proposes a theory, Dev challenges it.
  const cat = phones[2]!;
  await cat.getByRole('button', { name: 'theories' }).click();
  await cat.getByLabel('Propose a theory').fill('The ledger is the key to all of it');
  await cat.getByRole('button', { name: 'Table the theory' }).click();
  const dev = phones[3]!;
  await dev.getByRole('button', { name: 'theories' }).click();
  await expect(dev.getByText('The ledger is the key to all of it')).toBeVisible();
  await dev.getByRole('button', { name: 'Challenge' }).click();
  await expect(screen.getByText('backed by 1 · challenged by 1')).toBeVisible();

  // The clock is advisory, so the console has to say whose move it is once it
  // runs out, and show the vote filling up once it is open.
  await expect(facilitator.getByText(/Acts are suggestions/)).toBeVisible();

  // --- three commitments drive the acts (D5) ---
  for (let act = 1; act <= 3; act++) {
    await facilitator.getByRole('button', { name: /Close the act/ }).click();
    await expect(screen.getByText('The house must decide')).toBeVisible();
    // The facilitator can see the vote arriving, as a count and never as names.
    await expect(facilitator.getByText(/of 5 have voted/)).toBeVisible();
    // Eve votes on her phone.
    const eve = phones[4]!;
    await eve.getByRole('button', { name: 'decide' }).click();
    await eve.locator('.deco-frame button').first().click();
    if (act === 3) {
      // Before closing act 3, the team names the killer from Eve's phone.
      await facilitator.getByRole('button', { name: /End the game — reveal/ }).click();
    } else {
      await facilitator.getByRole('button', { name: `Begin Act ${String(act + 1)}` }).click();
    }
  }

  // --- the reveal (D11 visibility rules) ---
  await expect(screen.getByText(/But here is the interesting part/)).toBeVisible({
    timeout: 15_000,
  });
  // Every player gets a named strength on the shared screen.
  for (const name of PLAYERS) {
    await expect(screen.getByText(new RegExp(`${name} — The`))).toBeVisible();
  }
  // Each phone gets a private read.
  await expect(ana.getByText('Your private read')).toBeVisible();
  await expect(ana.getByText('The quieter side')).toBeVisible();
  // The facilitator sees team shape but no per-person profiles.
  await expect(facilitator.getByText(/Team shape/)).toBeVisible();
  await expect(facilitator.getByText('This team leaned')).toBeVisible();
  // Whole words only: "Cat" is a substring of "quiet catalyst", which is a
  // strength label rather than a person.
  const teamShapeText = (await facilitator.locator('.deco-frame').last().textContent()) ?? '';
  for (const name of PLAYERS)
    expect(
      new RegExp(`\\b${name}\\b`).test(teamShapeText),
      `${name} appears in the facilitator's view (D11)`,
    ).toBe(false);

  // All eight moments are accounted for on the facilitator's view, each one
  // either reached, offered and passed over, or never attempted.
  await expect(facilitator.getByText('The eight moments')).toBeVisible();
  await expect(facilitator.locator('.moment-row')).toHaveCount(8);
  await expect(
    facilitator.getByText(/never happened|moved straight past|room answered/).first(),
  ).toBeVisible();

  // The room sees the ones it reached, credited by name — the half that is
  // celebratory. What it missed stays with the facilitator (D11).
  await expect(screen.getByText('The moments you reached')).toBeVisible();
  const reached = await screen.locator('.moment').count();
  expect(reached).toBeGreaterThan(0);
  expect(reached).toBeLessThanOrEqual(8);

  // PRD §6: decision making, the fourth framework category, alongside the strength.
  await expect(ana.getByText('And how you decided')).toBeVisible();

  // PRD §11: the individual half of the debrief sits with the private read.
  await expect(ana.getByText('Worth asking yourself')).toBeVisible();
  await expect(ana.getByText('What role did you naturally fall into?')).toBeVisible();

  // PRD §19: three taps and one optional line. The first question is the one
  // the whole proposition is measured on.
  await expect(
    ana.getByText('Before the reveal, did you know this was about your team?'),
  ).toBeVisible();
  await ana.getByRole('button', { name: 'No idea' }).click();
  await ana.getByRole('button', { name: 'Yes' }).first().click();
  await ana.getByRole('button', { name: 'Yes' }).last().click();
  await ana.getByLabel('What will you do differently').fill('Ask the quiet one first.');
  await ana.getByRole('button', { name: 'Send' }).click();
  await expect(ana.getByText('That helps more than you would think.')).toBeVisible();

  // Keeping the read is a mailto, not an email system: no address is taken and
  // nothing is sent from here.
  await expect(ana.getByText(/never leaves your phone/)).toBeVisible();
  await expect(ana.getByLabel('Email address')).toHaveCount(0);

  // The facilitator gets the session to talk through, and a way to the rest.
  await expect(facilitator.getByText('How it went')).toBeVisible();
  await expect(facilitator.getByText(/It was Miss Evelyn Cross|and they were right/)).toBeVisible();
  await expect(facilitator.getByText('Dominance', { exact: true })).toBeVisible();
  await expect(
    facilitator.getByRole('link', { name: /Results across every session/ }),
  ).toBeVisible();
});

test('accusation flow in act 3', async ({ browser }) => {
  const facilitator = await browser.newPage();
  await facilitator.goto('/console');
  await facilitator.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await facilitator.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')![1]!;

  const phones: Page[] = [];
  for (const name of ['Ana', 'Ben', 'Cat', 'Dev']) {
    const ctx = await browser.newContext();
    const phone = await ctx.newPage();
    await phone.goto('/');
    await phone.getByLabel('Room code').fill(code);
    await phone.getByLabel('Your first name').fill(name);
    await phone.getByRole('button', { name: 'Step inside' }).click();
    phones.push(phone);
  }
  await facilitator.getByRole('button', { name: /Start Act 1/ }).click();
  // Fast-forward to act 3.
  for (let i = 0; i < 2; i++) {
    await facilitator.getByRole('button', { name: /Close the act/ }).click();
    await facilitator.getByRole('button', { name: /Begin Act/ }).click();
  }
  // It takes all four. One player naming somebody is not the house accusing
  // (D36) — the game is about a team deciding, and it used to be a race.
  const ana = phones[0]!;
  await ana.getByRole('button', { name: 'decide' }).click();
  await expect(ana.getByText('The house accuses', { exact: true })).toBeVisible();
  await ana.getByLabel('The killer').selectOption({ label: 'Miss Evelyn Cross' });
  await ana.getByLabel('The motive').fill('Revenge for her father');
  await ana.getByRole('button', { name: 'I say it was them' }).click();
  await expect(ana.getByRole('button', { name: 'Take my name off it' })).toBeVisible();
  // Three of four is still not an accusation.
  await expect(ana.getByText('The house has accused')).toBeHidden();

  for (const phone of phones.slice(1)) {
    await phone.getByRole('button', { name: 'decide' }).click();
    await phone.getByLabel('The killer').selectOption({ label: 'Miss Evelyn Cross' });
    await phone.getByRole('button', { name: 'I say it was them' }).click();
  }
  await expect(ana.getByText('The house has accused')).toBeVisible({ timeout: 10_000 });

  await facilitator.getByRole('button', { name: /Close the act/ }).click();
  await facilitator.getByRole('button', { name: /End the game — reveal/ }).click();
  // Correct accusation -> "The house was right." on the screen view; check via console team reveal present.
  await expect(facilitator.getByText(/Team shape/)).toBeVisible({ timeout: 15_000 });
});
