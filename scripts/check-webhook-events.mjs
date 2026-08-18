// Fails if the three lists that decide which events a tenant can subscribe to
// have drifted apart.
//
// There are THREE, and each failure between them is silent in a different way:
//
//   1. `EVENT_KEYS` in wizeworks/services/api-rest/.../webhooks/subscriptions.ts
//      The allow-list the API validates against. A key missing here is rejected
//      at save time with a validation error naming no cause.
//   2. `WEBHOOK_EVENTS` in sparx/apps/workbench/surfaces/cms/webhooks-data.ts
//      The human catalogue the picker renders. A key missing here is
//      subscribable only by someone hand-writing JSON against the API — so the
//      feature exists and nobody can find it.
//   3. `EventType` in wizeworks/packages/events/src/types.ts
//      The event registry. A key allowed in (1) that is not in (3) can never
//      fire, because nothing will ever publish it.
//
// The worst of the three is (1)+(2) agreeing on an event that (3) does not
// emit: the subscription saves, the picker shows it ticked, and the endpoint
// stays silent forever. Whoever set it up concludes their server is broken.
// `inventory.levels.updated` is exactly this shape — declared in the registry,
// published by nothing — which is why it is absent from (1) and (2) and why
// this check exists.
//
// Zero dependencies on purpose: the CI job runs it with bare Node, no install.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8');

const ROUTE = 'wizeworks/services/api-rest/src/routes/v1/webhooks/subscriptions.ts';
const CATALOG = 'sparx/apps/workbench/surfaces/cms/webhooks-data.ts';
const REGISTRY = 'wizeworks/packages/events/src/types.ts';

/** The `const EVENT_KEYS = [ … ] as const` block in the route. */
function routeKeys() {
  const source = read(ROUTE);
  const block = /const EVENT_KEYS = \[([\s\S]*?)\] as const;/.exec(source);
  if (!block) throw new Error(`check-webhook-events: EVENT_KEYS not found in ${ROUTE}`);
  return new Set([...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
}

/** Every `key: '…'` inside the `WEBHOOK_EVENTS` array in the workbench. */
function catalogKeys() {
  const source = read(CATALOG);
  const block =
    /const WEBHOOK_EVENTS: readonly WebhookEventDef\[\] = \[([\s\S]*?)\] as const;/.exec(source);
  if (!block) throw new Error(`check-webhook-events: WEBHOOK_EVENTS not found in ${CATALOG}`);
  return new Set([...block[1].matchAll(/key: '([^']+)'/g)].map((m) => m[1]));
}

/**
 * Every member of the EventType union.
 *
 * Read line-by-line rather than with one span regex: the union is heavily
 * commented, and those comments contain both semicolons and quoted words
 * ("Sam's workspace"), so terminating on `;` or harvesting every quoted string
 * both give a wrong answer — the first found six members out of two hundred.
 * Only lines whose first non-space character is `|` count.
 */
function registryKeys() {
  const lines = read(REGISTRY).split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('export type EventType ='));
  if (start === -1) throw new Error(`check-webhook-events: EventType not found in ${REGISTRY}`);

  const keys = new Set();
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    // The next top-level declaration ends the union.
    if (trimmed.startsWith('export ')) break;
    if (!trimmed.startsWith('|')) continue;
    const literal = /^\|\s*'([^']+)'/.exec(trimmed);
    if (literal) keys.add(literal[1]);
  }
  if (keys.size === 0) throw new Error(`check-webhook-events: EventType union parsed as empty`);
  return keys;
}

const route = routeKeys();
const catalog = catalogKeys();
const registry = registryKeys();

const problems = [];

for (const key of route) {
  if (!catalog.has(key)) {
    problems.push(
      `${key}: allowed by the API but missing from the picker — subscribable only by hand-writing JSON.\n    add it to WEBHOOK_EVENTS in ${CATALOG}`
    );
  }
  if (!registry.has(key)) {
    problems.push(
      `${key}: allowed by the API but not a real EventType — a subscription to it can never fire.\n    add it to EventType in ${REGISTRY}, or remove it from EVENT_KEYS in ${ROUTE}`
    );
  }
}

for (const key of catalog) {
  if (!route.has(key)) {
    problems.push(
      `${key}: offered in the picker but rejected by the API — ticking it fails to save.\n    add it to EVENT_KEYS in ${ROUTE}`
    );
  }
}

if (problems.length > 0) {
  console.error('\nWebhook event lists have drifted:\n');
  for (const problem of problems) console.error(`  - ${problem}\n`);
  console.error(
    `Checked ${route.size} allowed keys against ${catalog.size} catalogued and ${registry.size} declared.\n`
  );
  process.exit(1);
}

console.log(
  `check-webhook-events: ok — ${route.size} subscribable events, all catalogued and all declared.`
);
