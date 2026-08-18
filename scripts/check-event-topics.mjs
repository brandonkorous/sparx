// Fails if any event name declared in code has no Pub/Sub topic provisioned in
// terraform. Publishing to a missing topic throws `5 NOT_FOUND`, which every
// publisher catches + logs — so the failure is INVISIBLE in production: money
// moves, the event silently doesn't. That exact drift has now caused four
// separate incidents (order.placed 2026-07-12, the dropship family, then 66
// EventType names and 22 CrmTopic names on 2026-07-24).
//
// THE NON-OBVIOUS PART: there are TWO parallel event catalogs, not one.
//   - `EventType`  in wizeworks/packages/events/src/types.ts  (the main platform bus)
//   - `CrmTopic`   in wizeworks/packages/crm/src/events.ts    (the CRM `crm-pubsub` bus)
// Both bridge to the SAME Pub/Sub project. A drift check that reads only the
// first passes while 22 CRM topics are unprovisioned — which is precisely how
// the 2026-07-24 gap survived the first fix. This check unions BOTH. If a third
// catalog is ever added, add it to CATALOGS below.
//
// Direction that FAILS the build: declared-in-code but not-in-terraform (a
// guaranteed silent publish failure). The reverse (a topic in terraform with no
// declaring union) is only WARNED — an extra topic is harmless (infra topics
// like dead-letter, or a not-yet-wired name, legitimately live there).
//
// Zero dependencies on purpose: the CI job runs it with bare Node, no install.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8');

// --- The code-side catalogs. Each is a TS string-literal union. -------------
const CATALOGS = [
  { name: 'EventType', file: 'wizeworks/packages/events/src/types.ts', type: 'EventType' },
  { name: 'CrmTopic', file: 'wizeworks/packages/crm/src/events.ts', type: 'CrmTopic' },
];

// Extract every string literal from `export type <Type> =` up to the `;` that
// terminates the union. Line `//` comments are stripped FIRST — the union is
// densely commented, and several comments contain a literal ';' (e.g. "toggles
// a module flag; consumed …") that would otherwise cut the scan off after the
// first member. After de-commenting, the only quoted strings on these lines are
// union members (`| 'name'`), so we can safely collect every literal.
function parseUnion(source, typeName) {
  const startLine = source.split('\n').findIndex((l) => l.includes(`export type ${typeName} =`));
  if (startLine < 0)
    throw new Error(
      `could not find "export type ${typeName} =" — did the type move or get renamed?`
    );
  const lines = source.split('\n');
  const names = new Set();
  for (let i = startLine; i < lines.length; i++) {
    const code = lines[i].replace(/\/\/.*$/, ''); // drop the line comment
    for (const m of code.matchAll(/'([^']+)'/g)) names.add(m[1]);
    if (i > startLine && code.includes(';')) break; // union terminated
  }
  if (names.size === 0)
    throw new Error(
      `parsed 0 members from "${typeName}" — parser likely out of sync with the file`
    );
  return names;
}

// Extract the KEYS of the `topics = { ... }` map inside module "pubsub".
// Brace-walked so we stop at the map's own close and never bleed into the
// sibling `subscription_overrides` map (whose keys are "<topic>.<subscriber>").
function parseTerraformTopics(source) {
  const lines = source.split('\n');
  const openIdx = lines.findIndex((l) => /^\s*topics\s*=\s*\{/.test(l));
  if (openIdx < 0) throw new Error('could not find "topics = {" in terraform/envs/prod/main.tf');
  const keys = new Set();
  let depth = 0;
  for (let i = openIdx; i < lines.length; i++) {
    const line = lines[i];
    // A topic key is a quoted string at the start of a line, followed by `=`.
    // Subscriber names sit inside `[...]` AFTER the `=`, so this anchor skips
    // them. Only collect once we're inside the map (depth === 1).
    if (depth === 1) {
      const m = line.match(/^\s*"([^"]+)"\s*=/);
      if (m) keys.add(m[1]);
    }
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth === 0 && i > openIdx) break; // map closed
  }
  return keys;
}

const provisioned = parseTerraformTopics(read('terraform/envs/prod/main.tf'));

const declared = new Map(); // name -> catalog it came from
for (const cat of CATALOGS) {
  for (const name of parseUnion(read(cat.file), cat.type)) {
    if (!declared.has(name)) declared.set(name, cat.name);
  }
}

const missing = [...declared].filter(([name]) => !provisioned.has(name));
const orphaned = [...provisioned].filter((name) => !declared.has(name));

console.log(
  `event-topic parity: ${declared.size} declared across ${CATALOGS.length} catalogs ` +
    `(${CATALOGS.map((c) => c.name).join(' + ')}), ${provisioned.size} topics provisioned.`
);

if (orphaned.length > 0) {
  console.log(
    `\n⚠ ${orphaned.length} topic(s) provisioned but not declared in any catalog ` +
      `(harmless — infra/legacy or not-yet-wired):\n` +
      orphaned
        .sort()
        .map((n) => `    ${n}`)
        .join('\n')
  );
}

if (missing.length > 0) {
  console.error(
    `\n✗ ${missing.length} event name(s) declared in code but NOT provisioned as a Pub/Sub ` +
      `topic. Every publish to these SILENTLY fails in production. Add each to the ` +
      `\`topics\` map in terraform/envs/prod/main.tf (\`= []\` if no subscriber yet) and run ` +
      `\`terraform apply\`:\n` +
      missing
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, catalog]) => `    ${name}  (${catalog})`)
        .join('\n')
  );
  process.exit(1);
}

console.log('\n✓ Every declared event has a provisioned topic.');
