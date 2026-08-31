/**
 * A question and its answer are made at different moments, so appending each
 * new recording to a flat queue played question one, question two, then answer
 * one whenever the room asked faster than the model replied.
 */
import { expect, test } from '@playwright/test';

test('a busy interrogation plays each exchange through before the next', async ({ browser }) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];
  for (let i = 0; i < 3; i++) await con.getByRole('button', { name: 'Add an AI player' }).click();

  const screen = await browser.newPage();
  const heard: string[] = [];
  // Answers are delayed and questions are not, which is exactly the race that
  // shuffled the running order in a real session.
  await screen.route('**/voice/**', async (route) => {
    const isAsk = route.request().url().includes('/ask-');
    if (!isAsk) await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  screen.on('response', (r) => {
    const m = /\/voice\/[0-9A-F]{6}\/(ask-)?([\w-]+)\.mp3/.exec(r.url());
    if (m) heard.push(`${m[1] ? 'Q' : 'A'}:${(m[2] ?? '').slice(-6)}`);
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

  // Three questions in quick succession — faster than the replies can come back.
  for (const q of ['Were the doors bolted?', 'Who else was awake?', 'What woke you?']) {
    await phone.getByLabel('Choose a suspect').selectOption({ label: 'Mr Thomas Reeves' });
    await phone.getByLabel('Your question').fill(q);
    await phone.getByRole('button', { name: 'Put it to them' }).click();
    await phone.waitForTimeout(250);
  }

  await expect.poll(() => heard.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(6);

  // Every question is followed by its own answer before the next is heard.
  for (let i = 0; i + 1 < heard.length; i += 2) {
    const [q, a] = [heard[i]!, heard[i + 1]!];
    expect(q.startsWith('Q:'), `out of order at ${String(i)}: ${heard.join(' ')}`).toBe(true);
    expect(a, `answer did not follow its question: ${heard.join(' ')}`).toBe(`A:${q.slice(2)}`);
  }
});
