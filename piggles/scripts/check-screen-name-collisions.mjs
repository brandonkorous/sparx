#!/usr/bin/env node
// TWO SCREENS WITH THE SAME NAME.
//
// A console names a screen once and then shows that name in four places: the
// nav rail, the launcher, the command palette and the tab. None of those four
// says which SURFACE a row belongs to — the name is the whole of the address.
// So two surfaces carrying one name is not a tidiness problem. It is a row a
// person cannot choose between.
//
// Measured on 2026-09-19, Juniper Row, typing "wholesale price" into the box:
//
//     Sell
//       Wholesale price      → commerce.product.trade-pricing
//       Wholesale prices     → b2b.pricing-tiers.list
//       Special prices       → commerce.pricing.list
//
// Two unrelated screens, one letter apart, stacked. And a THIRD surface,
// `b2b.pricing-tier.detail`, carried the first one's string exactly. Issue 740.
//
// ── WHY A TITLE ALONE IS THE TEST ───────────────────────────────────────────
//
// A detail pane usually appends its record ("Wholesale price · Marlow Knit"), so
// the tab bar can tell two of them apart. The launcher cannot: it lists the
// SCREEN, before any record exists, so both rows render the bare title. That is
// the surface this check defends, which is why it tests the title on its own and
// gives a detail pane no exemption for a suffix it only sometimes has.
//
// ── NEAR-MISSES COUNT, AND THE RULE IS NARROW ON PURPOSE ────────────────────
//
// "Wholesale price" and "Wholesale prices" are different strings and the same
// row to read. So a plural of another title is a collision too. It is held to
// exactly that — a trailing "s"/"es" — rather than an edit distance, because a
// fuzzy rule on 300 surfaces reports pairs nobody would confuse and gets
// switched off. And it is held to pairs in two DIFFERENT apps, because
// "Suppliers" over "Supplier" inside ONE app is the list/detail convention the
// whole console is built on. Recognised by the key's app, never by the words.
//
// ── ONLY WHAT THE LAUNCHER LISTS ────────────────────────────────────────────
//
// A `listed: false` surface is not in the rail, the launcher or the palette: the
// only way to reach it is to open a record, and its tab then carries that
// record's name. So the name is the whole address for LISTED surfaces, and those
// are what this tests. Both denominators are printed.
//
// ── AND ONLY INSIDE ONE HEADING ─────────────────────────────────────────────
//
// The launcher does not show a flat list. It groups rows under the app they
// belong to and prints that app's name above the run, so "Reports" under
// Selling and "Reports" under Stock are two rows a person can already tell
// apart. The two that cannot be told apart are the two under ONE heading, which
// is exactly what was on screen: Wholesale price and Wholesale prices, both
// under Sell, because Piggles' Sell app fronts commerce AND wholesale.
//
// So the grouping is resolved the way `launcher-entries.ts` resolves it —
// `moduleLabel(surface.module)`, which in Piggles is the APP label from
// `@piggles/config` (Sell = commerce + b2b + dropship) and in sparx is the
// module's own label. Comparing across headings would report pairs the launcher
// has already separated, and a check that cries wolf gets switched off.
//
// Resolution follows the app: the catalog's title, overridden by the console's
// vocabulary, minus anything `hiddenSurfaces` takes off the screen entirely.
// A raw catalog title that no one ever reads is not a collision.
//
// The denominator is printed, and a console that resolves no surfaces fails
// rather than passing in silence. [[feedback_structural_checks_go_blind]]

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The two consoles. Piggles renames the shared screens; sparx does not, so its
 *  vocabulary file is absent and its catalog titles stand as written. */
const CONSOLES = [
  {
    name: 'piggles',
    workbench: join(REPO, 'piggles', 'apps', 'workbench'),
    vocabulary: 'lib/console/vocabulary.ts',
    hiddenFrom: 'lib/console/hidden.ts',
    // Piggles groups by APP, and one app fronts several modules.
    headings: { file: join(REPO, 'piggles', 'packages', 'config', 'src', 'apps.ts') },
  },
  {
    name: 'sparx',
    workbench: join(REPO, 'sparx', 'apps', 'workbench'),
    vocabulary: null,
    hiddenFrom: null,
    // sparx groups by MODULE, one heading each.
    headings: { file: join(REPO, 'sparx', 'apps', 'workbench', 'lib', 'surfaces', 'nav.ts') },
  },
];

/**
 * module → the heading the launcher prints above its rows.
 *
 * Piggles builds it from `APPS` (`label` plus the `modules` it fronts); sparx
 * from the flat `MODULE_LABELS` map. A module missing from either falls back to
 * its own key, which is what `moduleLabel` does, so an unmapped module is its
 * own heading rather than silently joining someone else's.
 */
function headingsFor(console_) {
  const src = readFileSync(console_.headings.file, 'utf8');
  const map = new Map();

  if (console_.name === 'piggles') {
    const start = src.indexOf('export const APPS');
    if (start === -1) throw new Error(`piggles: no APPS in ${console_.headings.file}`);
    for (const block of src
      .slice(start)
      .split(/\n {2}\{\n/)
      .slice(1)) {
      const label = /^\s*label:\s*'((?:[^'\\]|\\.)*)',/m.exec(block)?.[1];
      const modules = /^\s*modules:\s*\[([^\]]*)\]/m.exec(block)?.[1];
      if (!label || modules === undefined) continue;
      for (const m of modules.matchAll(/'([\w-]+)'/g)) map.set(m[1], label.replace(/\\'/g, "'"));
    }
  } else {
    const start = src.indexOf('const MODULE_LABELS');
    if (start === -1) throw new Error(`sparx: no MODULE_LABELS in ${console_.headings.file}`);
    const end = src.indexOf('\n};', start);
    for (const m of src.slice(start, end).matchAll(/^\s*([\w-]+):\s*'((?:[^'\\]|\\.)*)',/gm)) {
      map.set(m[1], m[2].replace(/\\'/g, "'"));
    }
  }

  if (map.size === 0) {
    throw new Error(
      `${console_.name}: resolved 0 launcher headings from ${console_.headings.file}`
    );
  }
  return map;
}

/** Every surface the console registers, with the title a person actually reads. */
function resolveSurfaces(console_) {
  const read = (rel) => readFileSync(join(console_.workbench, rel), 'utf8');
  const headings = headingsFor(console_);

  const overrides = new Map();
  if (console_.vocabulary) {
    const src = read(console_.vocabulary);
    const start = src.indexOf('PIGGLES_SURFACES');
    if (start === -1) {
      throw new Error(
        `${console_.name}: ${console_.vocabulary} has no PIGGLES_SURFACES map. ` +
          `Teach this check the new shape rather than letting it resolve nothing.`
      );
    }
    for (const m of src.slice(start).matchAll(/^\s*'([\w.-]+)':\s*'((?:[^'\\]|\\.)*)',/gm)) {
      if (!overrides.has(m[1])) overrides.set(m[1], m[2].replace(/\\'/g, "'"));
    }
  }

  const hidden = new Set(
    console_.hiddenFrom
      ? [...read(console_.hiddenFrom).matchAll(/^ {2}'([\w.*-]+)',$/gm)].map((m) => m[1])
      : []
  );
  const isHidden = (key) => {
    if (hidden.has(key)) return true;
    for (const entry of hidden) {
      if (entry.endsWith('.*') && key.startsWith(entry.slice(0, -1))) return true;
    }
    return false;
  };

  const catalog = join(console_.workbench, 'lib', 'surfaces', 'catalog');
  if (!existsSync(catalog)) {
    throw new Error(`${console_.name}: no catalog at ${catalog}. Nothing was scanned.`);
  }

  const surfaces = [];
  for (const file of readdirSync(catalog).filter((n) => n.endsWith('.ts'))) {
    const src = readFileSync(join(catalog, file), 'utf8');
    // Split on the object boundary so a key is paired with its own title.
    for (const block of src.split(/\n {2}\{\n/).slice(1)) {
      const key = /^\s*key:\s*'([^']+)'/m.exec(block)?.[1];
      if (!key || isHidden(key)) continue;
      const title = overrides.get(key) ?? /^\s*title:\s*'([^']+)'/m.exec(block)?.[1];
      // `listed: false` keeps a surface out of the rail, the launcher and the
      // palette: it is reached only by opening a record, and its tab carries
      // that record's name. The name is the whole address only for the rest.
      const listed = !/^\s*listed:\s*false/m.test(block);
      const module = /^\s*module:\s*'([\w-]+)'/m.exec(block)?.[1] ?? key.split('.')[0];
      const heading = headings.get(module) ?? module;
      if (title) surfaces.push({ key, title, file, listed, heading });
    }
  }
  return surfaces;
}

/** Is `plural` this console's plural of `singular`? Deliberately literal. */
function isPluralOf(plural, singular) {
  return plural === `${singular}s` || plural === `${singular}es`;
}

/** The record a list and its own detail share, so "Suppliers" over "Supplier"
 *  is recognised as the house convention rather than reported as a clash. The
 *  list key is plural and the detail key singular (`commerce.products.list`,
 *  `commerce.product.detail`), so the trailing s comes off the key too. */
function recordOf(key) {
  const m = /^(.*)\.(list|detail|new|view|edit)$/.exec(key);
  if (!m) return null;
  return m[1].replace(/s$/, '');
}

let failed = false;
for (const console_ of CONSOLES) {
  const surfaces = resolveSurfaces(console_);
  if (surfaces.length === 0) {
    process.stdout.write(`FAIL ${console_.name}: resolved 0 surfaces.\n`);
    failed = true;
    continue;
  }

  const problems = [];

  // The launcher, the rail and the palette list exactly these, under the app
  // heading each one belongs to. A name only has to be unique within its run.
  const listed = surfaces.filter((s) => s.listed);
  const byHeading = new Map();
  for (const s of listed) {
    if (!byHeading.has(s.heading)) byHeading.set(s.heading, []);
    byHeading.get(s.heading).push(s);
  }

  for (const [heading, run] of byHeading) {
    const byTitle = new Map();
    for (const s of run) {
      if (!byTitle.has(s.title)) byTitle.set(s.title, []);
      byTitle.get(s.title).push(s);
    }

    for (const [title, group] of byTitle) {
      if (group.length < 2) continue;
      problems.push(
        `  under "${heading}", "${title}" is the name of ${String(group.length)} screens: ` +
          group.map((s) => s.key).join(', ')
      );
    }

    // A plural of the row above it reads as the same row.
    const titles = [...byTitle.keys()];
    for (const a of titles) {
      for (const b of titles) {
        if (a === b || !isPluralOf(a, b)) continue;
        const one = byTitle.get(b)[0];
        const many = byTitle.get(a)[0];
        const record = recordOf(one.key);
        if (record !== null && record === recordOf(many.key)) continue;
        problems.push(
          `  under "${heading}", "${many.title}" (${many.key}) is the plural of ` +
            `"${one.title}" (${one.key}), and they are not a list and its own detail`
        );
      }
    }
  }

  if (problems.length > 0) {
    failed = true;
    process.stdout.write(
      `FAIL ${console_.name}: ${String(problems.length)} name collision(s) across ` +
        `${String(listed.length)} listed surfaces (${String(surfaces.length)} registered)` +
        `\n${problems.join('\n')}\n`
    );
  } else {
    process.stdout.write(
      `PASS ${console_.name}: ${String(listed.length)} listed surfaces ` +
        `(${String(surfaces.length)} registered), every name its own\n`
    );
  }
}

process.exit(failed ? 1 : 0);
