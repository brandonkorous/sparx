// The one step a script cannot do for you.
//
// Playwright starts from a clean profile with no cookie, so the first run needs
// a real sign-in. This opens a window, gets out of the way, and saves the
// session once the console has actually loaded — after which every capture run
// is unattended until the session expires.
//
// The password is typed BY A PERSON, into a browser they can see. Nothing here
// stores, reads or transmits it.

import { loadPlaywright, ensureConsoleUp, CONSOLE_ORIGIN, STATE_PATH } from './console-session.mjs';

const ACCOUNT = 'owner@wildroot-flowers.demo.sparx.test';

/** Long, because the wait is a person — a stack that is merely SLOW is not the
 *  failure this guards against, and `ensureConsoleUp` already caught a dead one. */
const PATIENCE_MS = 15 * 60_000;

export async function signIn() {
  await ensureConsoleUp();
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ headless: false });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    console.log(`\nOpening ${CONSOLE_ORIGIN} — it will bounce to the account app to sign in.`);
    console.log(`Sign in as  ${ACCOUNT}  (the password is in public/product/README.md).`);
    console.log('Waiting for the workspace to load…\n');

    await page.goto(CONSOLE_ORIGIN);
    // The workspace, not merely the origin: the handoff lands on the console and
    // THEN resolves the session, so a URL match alone can still be a redirect in
    // flight. The dock existing is the first moment the session is proven good.
    await page.waitForSelector('.dv-tabs-container', { timeout: PATIENCE_MS });

    await context.storageState({ path: STATE_PATH });
    console.log(`Saved. ${STATE_PATH}`);
    console.log('Now run:  node scripts/capture-shots.mjs stock\n');
  } finally {
    // Always — a failed sign-in used to leave the window orphaned on screen with
    // no process left to close it.
    await browser.close();
  }
}
