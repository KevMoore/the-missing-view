/**
 * A television has no scrollbar and nobody in the room can reach it, so
 * anything past the bottom edge is gone. An iPad in landscape wrapped the five
 * suspects onto two rows and pushed the whole interrogation panel off.
 */
import { expect, test, type Page } from '@playwright/test';

const SCREENS = [
  ['iPad landscape', 1024, 768],
  ['iPad Pro landscape', 1180, 820],
  ['1080p television', 1920, 1080],
] as const;

for (const [name, w, h] of SCREENS) {
  test(`the screen fits a ${name}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const con = await browser.newPage();
    await con.goto('/console');
    await con.getByRole('button', { name: 'Open the house' }).click();
    const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
    const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

    const screen = await browser.newPage();
    await screen.setViewportSize({ width: w, height: h });
    await screen.goto('/screen');
    await screen.getByLabel('Room code').fill(code!);
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

    // Fill it the way a real act 1 does, so the caps are under load.
    for (const p of phones) {
      await expect(p.getByText('Your private clues')).toBeVisible();
      const held = await p.getByRole('button', { name: 'Table it' }).count();
      for (let i = 0; i < held; i++) {
        const b = p.getByRole('button', { name: 'Table it' }).first();
        if ((await b.count()) === 0) break;
        await b.click({ timeout: 5000 }).catch(() => undefined);
        await p.waitForTimeout(120);
      }
    }
    for (const [i, p] of phones.slice(0, 3).entries()) {
      await p.getByRole('button', { name: 'theories' }).click();
      await p
        .getByLabel('Propose a theory')
        .fill(`A theory of some considerable length, number ${String(i + 1)}`);
      await p.getByRole('button', { name: 'Table the theory' }).click();
    }
    await screen.waitForTimeout(800);

    // The suspects occupy exactly one row.
    const tops = await screen
      .locator('.suspect')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size, 'the suspects wrapped onto more than one row').toBe(1);

    // The interrogation panel is on screen, not below the fold.
    const box = await screen.getByText('Interrogation').boundingBox();
    expect(box?.y ?? h, 'interrogation is below the fold').toBeLessThan(h);

    // And nothing is cut off halfway.
    for (const sel of ['.card', '.card-slim', '.qa', '.suspect']) {
      const past = await screen
        .locator(sel)
        .evaluateAll(
          (els, height) => els.filter((e) => e.getBoundingClientRect().bottom > height).length,
          h,
        );
      expect(past, `${sel} runs past the bottom edge`).toBe(0);
    }
  });
}
