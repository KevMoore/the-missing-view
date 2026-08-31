/**
 * The fade and the push were both on `.on`. Losing the class mid-transition
 * removed the animation, so the outgoing plate snapped from zoomed back to
 * unzoomed while still fully visible — a jump-cut underneath a cross-dissolve.
 */
import { expect, test } from '@playwright/test';

/** The scale a plate is actually rendering at, read off the composited matrix. */
const scaleOf = (el: Element): number => {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return Math.round(m.a * 1000) / 1000;
};

test('the outgoing image keeps its zoom while it fades', async ({ browser }) => {
  test.setTimeout(120_000);
  const con = await browser.newPage();
  await con.goto('/console');
  await con.getByRole('button', { name: 'Open the house' }).click();
  const roomText = await con.getByText(/Room [0-9A-F]{6}/).textContent();
  const code = /Room ([0-9A-F]{6})/.exec(roomText ?? '')?.[1];

  const screen = await browser.newPage();
  await screen.setViewportSize({ width: 1440, height: 900 });
  await screen.goto('/screen');
  await screen.getByLabel('Room code').fill(code!);
  await screen.getByRole('button', { name: 'Take the stage' }).click();
  await con.getByRole('button', { name: 'Play the opening' }).click();
  await expect(screen.getByText(/The road over the moor closed at dusk/)).toBeVisible();

  const first = screen.locator('.prologue-plate').first();
  // let the push get somewhere
  await screen.waitForTimeout(4000);
  const zoomedIn = await first.evaluate(scaleOf);
  expect(zoomedIn, 'the first plate never started its push').toBeGreaterThan(1.01);

  // the beat turns over
  await expect(screen.getByText(/eleven miles from the nearest constable/)).toBeVisible({
    timeout: 20_000,
  });

  // mid cross-fade: it must still be zoomed, and still be visible
  await screen.waitForTimeout(400);
  const midFade = await first.evaluate((el) => ({
    scale: new DOMMatrixReadOnly(getComputedStyle(el).transform).a,
    opacity: Number(getComputedStyle(el).opacity),
  }));
  expect(midFade.opacity, 'the outgoing plate had already vanished').toBeGreaterThan(0.05);
  expect(midFade.scale, 'the outgoing plate snapped back to unzoomed').toBeGreaterThanOrEqual(
    zoomedIn - 0.001,
  );
});
