// Photograph the real console. One command, driven by the shot registry.
//
//   node scripts/capture-shots.mjs sign-in          once, by hand — saves the session
//   node scripts/capture-shots.mjs                  everything the plan knows
//   node scripts/capture-shots.mjs stock            one app
//   node scripts/capture-shots.mjs stock:levels     one surface
//   …--out <dir>                                    somewhere else, to look before committing
//   …--force                                        overwrite (see below — usually wrong)
//
// ── WHY IT REFUSES TO OVERWRITE ─────────────────────────────────────────────
//
// Next serves optimised images with a long max-age, so replacing a path keeps
// rendering the old picture — in the browser, in the CDN, and in every returning
// visitor's cache, with nothing to invalidate it. Re-shooting a surface means a
// new slug in the registry, not a new file at the same address. `--force` exists
// for the case where nothing has shipped yet.

import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_SHOTS, shotSrc } from '../content/shots.ts';
import {
  loadPlaywright,
  openContext,
  ensureConsoleUp,
  CONSOLE_ORIGIN,
  STATE_PATH,
} from './console-session.mjs';
import { DEFAULT_VIEWPORTS, THEMES, plannedShots, recipeFor } from './shot-plan.mjs';
import { arrange } from './arrange.mjs';
import { signIn } from './sign-in.mjs';

const PUBLIC_DIR = path.join(import.meta.dirname, '..', 'public');

/**
 * Every file to produce, from the REGISTRY where there is one and the PLAN
 * where there is not.
 *
 * Both directions matter. A registry entry with no plan is a rendered <img>
 * with nothing behind it — a broken picture on a live page — so it is a hard
 * error. A plan entry with no registry entry is simply a surface shot before
 * anybody has written its alt text, which is the normal order of work.
 */
function work(filter) {
  const jobs = [];
  const seen = new Set();

  for (const [app, shots] of Object.entries(APP_SHOTS)) {
    for (const shot of shots) {
      seen.add(`${app}:${shot.surface}`);
      const recipe = recipeFor(app, shot.surface);
      if (!recipe) throw new Error(`${app}:${shot.surface} is in the registry with no plan`);
      jobs.push({ app, shot, recipe, viewports: shot.viewports });
    }
  }

  for (const { app, surface } of plannedShots()) {
    if (seen.has(`${app}:${surface}`)) continue;
    const recipe = recipeFor(app, surface);
    jobs.push({
      app,
      shot: { surface },
      recipe,
      viewports: recipe.viewports ?? DEFAULT_VIEWPORTS,
    });
  }

  return jobs.filter(({ app, shot }) => matches(filter, app, shot.surface));
}

function matches(filter, app, surface) {
  if (filter.length === 0) return true;
  return filter.some((entry) => entry === app || entry === `${app}:${surface}`);
}

/** Where a file lands. Through `shotSrc`, so the runner cannot invent a path
 *  the page will not look for. */
function destination(outDir, app, shot, viewport, theme) {
  return path.join(outDir, shotSrc(app, shot, viewport, theme).replace(/^\//, ''));
}

async function capture(browser, playwright, job, { outDir, force }) {
  const { app, shot, recipe } = job;
  for (const viewport of job.viewports) {
    for (const theme of THEMES) {
      const file = destination(outDir, app, shot, viewport, theme);
      if (!force && (await exists(file))) {
        console.log(`  skip  ${path.relative(outDir, file)} (already shot)`);
        continue;
      }
      const context = await openContext(browser, {
        viewport,
        theme,
        mode: recipe.mode ?? 'tabs',
        playwright,
      });
      const page = await context.newPage();
      // Kept for the failure path only. The console's own error card says
      // "Something went wrong" by design, so a screenshot of a crash is a
      // screenshot of nothing — the stack is the only thing that names the bug.
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
      try {
        await arrange(page, recipe, { compact: viewport === 'mobile' });
        await fs.mkdir(path.dirname(file), { recursive: true });
        await page.screenshot({ path: file });
        console.log(`  shot  ${path.relative(outDir, file)}`);
      } catch (error) {
        // A `ready` gate that times out says WHICH string it never saw and
        // nothing about what was on screen instead — so photograph the failure.
        // Guessing at it cost a round trip the first time this fired.
        const failed = file.replace(/\.png$/, '-FAILED.png');
        await fs.mkdir(path.dirname(failed), { recursive: true });
        await page.screenshot({ path: failed }).catch(() => {});
        console.error(`  FAIL  ${path.relative(outDir, failed)} — ${error.message.split('\n')[0]}`);
        for (const line of errors.slice(0, 5)) console.error(`        ${line}`);
        throw error;
      } finally {
        await context.close();
      }
    }
  }
}

async function exists(file) {
  return fs.access(file).then(
    () => true,
    () => false
  );
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === 'sign-in') return signIn();

  const force = argv.includes('--force');
  const outIndex = argv.indexOf('--out');
  const outDir = outIndex === -1 ? PUBLIC_DIR : path.resolve(argv[outIndex + 1]);
  const filter = argv.filter((a, i) => !a.startsWith('--') && i !== outIndex + 1);

  await ensureConsoleUp();
  if (!(await exists(STATE_PATH))) {
    throw new Error('No saved session. Run:  node scripts/capture-shots.mjs sign-in');
  }

  const jobs = work(filter);
  if (jobs.length === 0) throw new Error(`Nothing planned matches ${filter.join(', ')}`);

  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  console.log(`Shooting ${jobs.length} surface(s) from ${CONSOLE_ORIGIN} into ${outDir}`);
  try {
    for (const job of jobs) {
      console.log(`${job.app}:${job.shot.surface}`);
      await capture(browser, playwright, job, { outDir, force });
    }
  } finally {
    await browser.close();
  }
}

await main();
