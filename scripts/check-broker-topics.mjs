// Fails when the CRM bridge tees a topic onto the broker that nothing can hear.
//
// WHAT A BUSINESS OWNER MET (issue 760). A shop rang an order through and she
// typed it in at the counter. Four minutes later she searched her own console
// for the order number:
//
//     O-000018
//     Orders
//       #O-000016   Marguerite Adeyemi · fulfilled
//       #O-000015   Marguerite Adeyemi · fulfilled
//       …
//
// The numbers either side of it, and not the one she asked for. The order was
// open in the next pane at the time.
//
// MEASURED 2026-09-20 against the running database and the live search index,
// for one shop: 18 orders, 16 of them indexed. The two missing were the two
// most recent — one typed in at the till, one raised by a repeat order coming
// round — and every order that arrived through the WEBSITE was present.
//
// WHY. An order is announced to the rest of the platform on `order.placed`:
// the search indexer, the dropship router and every automation keyed on "a new
// order" subscribe that topic and only that topic. `checkout-service` was the
// only thing that published it. Every other caller of `orderService.create`
// relied on the `order.created` the service publishes itself — which is the CRM
// spine's own IN-PROCESS signal, is not in the event catalog, and was teed onto
// the broker where no worker subscribes it and no tenant can key an automation
// on it. A publish that reaches nobody looks exactly like one that works.
// [[feedback_absent_behaves_like_fine]]
//
// WHAT THIS CHECKS. Every topic in `PLATFORM_TEE_TOPICS` must be a topic
// something can actually receive:
//
//   * a name in the `EventType` catalog — a worker can subscribe it; or
//   * one of the FAN_IN_ONLY names below, which reach the automation engine
//     through the fan-in tee rather than through a subscription. Each one has
//     to say who reads it, in this file, where the next person will see it.
//
// A new tee that is neither fails here rather than going quiet in production.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const BRIDGE = 'wizeworks/packages/crm/src/pubsub-bridge.ts';
const CATALOG = 'wizeworks/packages/events/src/types.ts';

/** Teed topics that no worker subscribes, and are teed anyway because the
 *  AUTOMATION fan-in reads them. The reason is the entry: a name with nothing
 *  beside it is how `order.created` sat here unnoticed. */
const FAN_IN_ONLY = new Map([
  [
    'email.opened',
    'automation-actions/src/resolvers.ts EMAIL_ENGAGEMENT_EVENTS — a tenant can ' +
      'build "opened but did not click in 3 days → follow up".',
  ],
  [
    'email.clicked',
    'automation-actions/src/resolvers.ts EMAIL_ENGAGEMENT_EVENTS — "clicked → add a tag".',
  ],
  [
    'email.bounced',
    'automation-actions/src/resolvers.ts EMAIL_ENGAGEMENT_EVENTS — engagement trigger.',
  ],
  [
    'order.payment.recorded',
    'Published post-commit by crm/src/services/order-payments-service.ts. NOT in the ' +
      'catalog and no automation names it either, so today it reaches nobody — the same ' +
      'shape as the `order.created` that caused issue 760. Left teed rather than removed ' +
      'in the same pass, because deciding whether money-in deserves a catalog topic is a ' +
      'question about the event catalog and not about this bridge. Recorded here so it is ' +
      'a decision somebody can see rather than a line nobody reads.',
  ],
]);

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

function read(rel) {
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    die([
      `✖ check:broker-topics cannot find ${rel}.`,
      '   A scan target that no longer exists reports a clean pass over nothing.',
    ]);
  }
  return readFileSync(full, 'utf8');
}

// ── the teed set ──────────────────────────────────────────────────────
const bridge = read(BRIDGE);
const teeBlock = /PLATFORM_TEE_TOPICS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(bridge);
if (!teeBlock?.[1]) {
  die([
    '✖ check:broker-topics could not find PLATFORM_TEE_TOPICS in',
    `   ${BRIDGE}`,
    '   It was renamed or restructured. Update this check rather than deleting it —',
    '   the set is what decides which in-process topics reach the broker at all.',
  ]);
}
const teed = [...teeBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (teed.length === 0) {
  die(['✖ check:broker-topics parsed PLATFORM_TEE_TOPICS and found no topics in it.']);
}

// ── the catalog ───────────────────────────────────────────────────────
// Walked line by line rather than matched with one regex. A `[\s\S]*?;` stops at
// the first semicolon, and the union is 173 members threaded with prose comments
// — one of which contains a semicolon and another an apostrophe, so a regex read
// 188 "names", the last of them a sentence fragment. It still cleared a
// length sanity check, and every real topic came out MISSING.
// [[feedback_structural_checks_go_blind]]
const catalog = read(CATALOG);
const catalogLines = catalog.split('\n');
const unionStart = catalogLines.findIndex((l) => /^export type EventType\s*=/.test(l));
if (unionStart < 0) {
  die([`✖ check:broker-topics could not find the EventType union in ${CATALOG}.`]);
}
const known = new Set();
for (let i = unionStart + 1; i < catalogLines.length; i += 1) {
  const line = (catalogLines[i] ?? '').trim();
  if (line === '' || line.startsWith('//')) continue;
  if (!line.startsWith('|')) break; // the union is over
  for (const m of line.matchAll(/'([^']+)'/g)) known.add(m[1]);
}
if (known.size < 50) {
  die([
    `✖ check:broker-topics parsed only ${String(known.size)} names out of the EventType union.`,
    '   That is too few to be the real catalog, so every topic would pass by accident.',
  ]);
}

// ── the comparison ────────────────────────────────────────────────────
const orphans = teed.filter((t) => !known.has(t) && !FAN_IN_ONLY.has(t));

if (orphans.length > 0) {
  die([
    `✖ ${String(orphans.length)} topic(s) are teed to the broker and nothing can receive them:`,
    '',
    ...orphans.map((t) => `   ${t}`),
    '',
    `   ${BRIDGE} tees these onto the event bus, but they are not in the EventType`,
    `   catalog (${CATALOG}), so no worker subscribes them, and they are not listed`,
    '   in this check as fan-in-only, so no automation reads them either.',
    '',
    '   A publish that reaches nobody looks exactly like one that works. That is how',
    '   an order typed in at the till came to be announced to nothing at all while the',
    '   same order placed on the website was indexed, routed and triggered normally.',
    '',
    '   Either add the topic to the EventType catalog and give it a subscriber, or',
    '   stop teeing it, or add it to FAN_IN_ONLY in this file WITH the name of the',
    '   file that reads it.',
  ]);
}

console.log(
  `✓ check:broker-topics — ${String(teed.length)} teed topic(s), ` +
    `${String(teed.filter((t) => known.has(t)).length)} in the catalog of ${String(known.size)}, ` +
    `${String(teed.filter((t) => FAN_IN_ONLY.has(t)).length)} fan-in only with a reason.`
);
