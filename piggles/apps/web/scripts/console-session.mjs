// Driving the real Piggles console from a script — browser, session, canvas.
//
// Everything here exists so a capture is REPRODUCIBLE. A screenshot taken by
// hand is a photograph of one browser on one afternoon; these are the knobs that
// make the same URL produce the same picture next month.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHOT_SIZE } from '../content/shots.ts';

/** Where the console is served. Overridable so this can shoot a deployed one. */
export const CONSOLE_ORIGIN = process.env.PIGGLES_CONSOLE_ORIGIN ?? 'http://localhost:3022';

/** The saved sign-in. Session tokens — `*-auth.json` is already gitignored. */
export const STATE_PATH = path.join(import.meta.dirname, 'piggles-auth.json');

/**
 * Canvas decides LAYOUT, scale decides SHARPNESS, and they are independent.
 *
 * 1440 is the screen a small business actually has, and it leaves the dock room
 * for two windows. The first Stock shot was taken at 2558px and the gap down the
 * Item column is the console stretched across a monitor no florist owns.
 */
const SCALE = { desktop: 2, mobile: 3 };

/**
 * The canvas for each viewport, DERIVED from the registry's `SHOT_SIZE`.
 *
 * Not spelled here, because the page declares the same numbers on its <Image>
 * and the phone frame is a fixed 9:19 box — two hand-kept copies of a shape
 * only have to disagree once to put a band of dead frame under the screen.
 * Scale is the script's own business: it decides sharpness, not layout.
 */
export const VIEWPORTS = {
  desktop: {
    viewport: {
      width: SHOT_SIZE.desktop.width / SCALE.desktop,
      height: SHOT_SIZE.desktop.height / SCALE.desktop,
    },
    deviceScaleFactor: SCALE.desktop,
  },
  // The device supplies the mobile user agent and touch, which is what makes
  // the console mount its compact shell; its viewport is overridden below.
  mobile: {
    device: 'iPhone 14',
    viewport: {
      width: SHOT_SIZE.mobile.width / SCALE.mobile,
      height: SHOT_SIZE.mobile.height / SCALE.mobile,
    },
    deviceScaleFactor: SCALE.mobile,
  },
};

/**
 * Playwright is a TOOL here, not a dependency of the site.
 *
 * Adding it to package.json would put a ~400MB browser download in every
 * install and every CI run, to serve a script nobody runs during a build. So it
 * is resolved from a global install: `npm i -g playwright`.
 */
export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
    const entry = path.join(root, 'playwright', 'index.mjs');
    try {
      return await import(pathToFileURL(entry).href);
    } catch {
      throw new Error('Playwright not found. Install it once with:  npm i -g playwright');
    }
  }
}

/**
 * Everything the console reads out of localStorage before it paints.
 *
 * Written as an init script so it lands BEFORE the app boots — the theme is
 * applied by a blocking script in <head>, and the dock reads its presentation
 * and its saved arrangement during the same first pass.
 *
 * The layout keys are CLEARED rather than set. A run that inherited the last
 * run's arrangement would silently shoot a different picture from the same
 * plan, and the failure would look like the plan being wrong.
 */
export function prelude({ theme, mode }) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('piggles-console-layout')) localStorage.removeItem(key);
      if (key.startsWith('piggles-console-mode-layout')) localStorage.removeItem(key);
      if (key.startsWith('piggles-console-drafts')) localStorage.removeItem(key);
    }
    localStorage.setItem('piggles-console-theme', theme);
    // ALWAYS tabs at boot, whatever the recipe wants. Arrangements are composed
    // in the grid and floated afterwards (see arrange.mjs `toWindows`), because
    // `beside` has no grid to split inside a floating group.
    localStorage.setItem('piggles-console-window-mode', 'tabs');
    localStorage.setItem('piggles-console-rail', 'collapsed');
    localStorage.setItem(
      'piggles-console-nav',
      JSON.stringify({ module: null, pinned: false, railExpanded: false })
    );
    localStorage.removeItem('piggles-console-update-available');
  } catch {
    // A hardened profile with storage blocked. The capture still runs; it just
    // uses whatever defaults the console falls back to.
  }
}

/** A context already signed in, themed, and sized for one viewport. */
export async function openContext(browser, { viewport, theme, mode, playwright }) {
  const profile = VIEWPORTS[viewport];
  // The device supplies the user agent, touch and scale factor — what makes the
  // console mount its compact shell. Its viewport is then overridden, because
  // the frame decides the shape.
  const base = profile.device
    ? { ...playwright.devices[profile.device], ...profile, device: undefined }
    : profile;
  const context = await browser.newContext({
    ...base,
    storageState: STATE_PATH,
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(prelude, { theme, mode });
  return context;
}

/**
 * Refuse to start against a console that is not serving.
 *
 * Without this the first failure is a five-minute wait on a selector, reported
 * as a timeout — which reads as "the app is broken" when the app is simply not
 * running. The dev stack goes down often enough (a restart, a rename, a machine
 * that slept) that the honest error is worth the request.
 */
export async function ensureConsoleUp() {
  try {
    await fetch(CONSOLE_ORIGIN, { redirect: 'manual', signal: AbortSignal.timeout(5_000) });
  } catch {
    throw new Error(`${CONSOLE_ORIGIN} is not answering. Start the Piggles dev stack first.`);
  }
}

/**
 * Wait until the arrangement is real — not merely rendered.
 *
 * REAL DATA FIRST, then quiet. The order is the whole point: at t=0 nothing is
 * mounted, so "no pane is waiting" is trivially true and a screenshot taken on
 * it is a picture of a blank workspace. Waiting for a string that only exists
 * once Wildroot's rows have rendered is what proves the app got that far; the
 * status sweep afterwards catches the OTHER panes, which may still be loading
 * behind the one that arrived first.
 */
export async function settle(page, { ready, timeout = 45_000 } = {}) {
  if (ready) await page.waitForSelector(ready, { timeout });
  await page.waitForFunction(
    () => document.querySelectorAll('[role="status"]').length === 0,
    null,
    {
      timeout,
    }
  );
  // Fonts and the icon set land after the data does, and a half-drawn glyph in a
  // toolbar is the one artefact that survives at 2x.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}
