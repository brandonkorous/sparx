// Getting the console into the shape a shot wants — arriving, then composing.
//
// Every move here is one a person can make: follow a link, press ⌘K, pick a
// screen, hold a modifier to say where it goes. Nothing reaches into the dock.

import { CONSOLE_ORIGIN, settle } from './console-session.mjs';

/** Modifier → destination, the launcher's own contract (components/launcher.tsx). */
const MODIFIERS = { tab: [], beside: ['Shift'], window: ['Alt'] };

/**
 * Open a surface through the launcher, exactly as somebody would.
 *
 * The row is picked by its accessible name rather than by typing and pressing
 * Enter: the highlighted row after a search depends on match ordering, and a
 * capture that silently shoots the second-best match is worse than one that
 * fails. `exact` matters — "Stock" is also a prefix of "Stock counts".
 */
async function openViaLauncher(page, { open, where = 'tab' }) {
  await page.keyboard.press('Control+k');
  const dialog = page.locator('[role="dialog"]').filter({ has: page.locator('[role="listbox"]') });
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.locator('input').first().fill(open);
  const row = dialog.getByRole('option', { name: open, exact: true }).first();
  await row.waitFor({ timeout: 10_000 });
  await row.click({ modifiers: MODIFIERS[where] });
  await dialog.waitFor({ state: 'detached', timeout: 10_000 });
}

/**
 * Flip the whole workspace to floating windows, AFTER the arrangement is built.
 *
 * Composing in windows mode does not work: `beside` inside a floating group has
 * no grid to split, so the second pane lands as a tab and the shot comes back
 * as one window pretending to be two. Tabs mode splits properly, and the toggle
 * then floats every group it finds — cascaded, overlapping, which is the picture.
 */
async function toWindows(page) {
  const toggle = page.getByRole('button', { name: 'Switch to movable windows' });
  if ((await toggle.count()) === 0) return;
  await toggle.click();
  await page.waitForTimeout(700);
}

/** Bring a pane forward by clicking its tab — `beside` focuses what it opened. */
async function focusPane(page, title) {
  const tab = page.locator('.dv-tab', { hasText: title }).first();
  if ((await tab.count()) === 0) return;
  await tab.click();
  await page.waitForTimeout(300);
}

/**
 * Arrive, compose, and wait until it is real.
 *
 * COMPACT SESSIONS SKIP COMPOSITION. A phone runs the stack host, which has no
 * split and no windows (`PaneHostCapabilities`), so `beside` and `window` are
 * offers it cannot honour — a mobile shot is one surface, which is the honest
 * picture of what a phone actually shows.
 */
export async function arrange(page, recipe, { compact }) {
  await page.goto(`${CONSOLE_ORIGIN}${recipe.path}`, { waitUntil: 'domcontentloaded' });
  // Dev overlays are not the product, and both of these reached a capture that
  // was on its way to a marketing page: Next's indicator (bottom-left) and the
  // query devtools launcher (bottom-right). Hidden HERE as well as switched off
  // in the app, so a capture never depends on somebody else's provider config.
  await page.addStyleTag({
    content: 'nextjs-portal,.tsqd-open-btn-container{display:none!important}',
  });
  await settle(page, { ready: textSelector(recipe.ready) });

  if (compact) return 1;

  const steps = recipe.then ?? [];
  for (const step of steps) {
    await openViaLauncher(page, step);
    await settle(page, { ready: textSelector(step.ready) });
  }
  if (recipe.mode === 'windows') await toWindows(page);
  // AFTER the float, not before. Cascading stacks the windows in creation
  // order, so the pane a shot is named for ends up underneath the one opened
  // after it — clicking its tab last is what raises it.
  if (recipe.focus) await focusPane(page, recipe.focus);
  return steps.length + 1;
}

/**
 * A string from the plan, as a selector that only matches rendered content.
 *
 * SUBSTRING, not exact. The same product reads "Garden Roses, by the Bunch" in
 * one list and "Garden Roses, by the Bunch · WR-ST-ROSE" in another, and a plan
 * should not have to know which — quoting it made the batches shot fail on a
 * screen the string was plainly on.
 *
 * `visible=true` because the FIRST match wins and hidden ones come first: "Shop
 * Cooler" is an <option> in the location filter long before it is a table cell,
 * and an option inside a closed select is never visible. That waited out the
 * full timeout on a screen showing the words.
 */
function textSelector(text) {
  return text ? `text=${text} >> visible=true` : null;
}
