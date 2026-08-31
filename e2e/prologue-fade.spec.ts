/**
 * The fade and the push were both on `.on`. Losing the class mid-transition
 * removed the animation, so the outgoing plate snapped from zoomed back to
 * unzoomed while still fully visible — a jump-cut underneath a cross-dissolve.
 */
import { expect, test } from '@playwright/test';

test('the outgoing image keeps its zoom while it fades', async ({ browser }) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1440, height: 900 });
  await screen.goto(`/screen?code=${code!}`);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await con.getByRole('button', { name: 'Play the opening' }).click();
  await expect(screen.getByText(/The road over the moor closed at dusk/)).toBeVisible();

  // Assert the rule rather than the clock: any plate that has been shown and is
  // no longer current must still be holding its push. Under the old CSS the
  // animation left with the class and the transform snapped back to 1.
  const outgoing = screen.locator('.prologue-plate.played:not(.on)');
  await expect.poll(() => outgoing.count(), { timeout: 40_000 }).toBeGreaterThan(0);

  const scales = await outgoing.evaluateAll((els) =>
    els.map((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a),
  );
  for (const scale of scales)
    expect(scale, `an outgoing plate snapped back to ${String(scale)}`).toBeGreaterThan(1.005);
});
