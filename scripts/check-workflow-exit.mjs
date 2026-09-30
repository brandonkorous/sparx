// Fails when a built-in document workflow has no way OUT of it.
//
// WHAT A BUSINESS OWNER SAW. A wholesale order, one click on "Make an invoice",
// and the invoice INV-000011 exists. She wants it gone: the lines are wrong.
//
//   · The More menu offers "Print or save as PDF" and "Copy payment link".
//   · The stage menu offers "Invoice" and "Receipt", and nothing else.
//   · Back on the order, the button is replaced by: "Order O-000018 has already
//     been invoiced as INV-000011. Open that invoice to chase it, or void it
//     before raising another."
//
// She cannot void it. The default Invoice workflow — `isDefault: true`, the one
// every tenant is seeded with on invoicing activation — had two stages, Invoice
// and Paid, and no `void` stage at all. The console's delete is gated on
// `stageType === 'draft'`, which that workflow also does not have. So an
// invoice was PERMANENT from the moment it was raised, and the order behind it
// could never be invoiced again.
//
// MEASURED 2026-09-20: 205 live workflows on this machine, 52 of them with a
// void stage. The QUOTE workflows in the very same source file have carried
// Declined and Expired since the day they were written.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// WHAT A "WAY OUT" IS. Exactly one stage type ends a document without it having
// been completed: `void`. Entering one stamps `voidedAt`, sets the AR status to
// `void` and publishes `crm.billing_document.voided` — the machinery was all
// there, waiting for a stage that named it.
//
// WHAT THIS CHECK CAN AND CANNOT SEE. It reads the TEMPLATES a tenant is seeded
// from. It cannot see a workflow a tenant has since edited, and it does not try:
// those are the tenant's own and this repo does not own them.
//
// Zero dependencies on purpose: CI runs it with bare Node, no install.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCES = [
  'wizeworks/packages/crm-schemas/src/builtins/invoicing.ts',
  'wizeworks/packages/crm/src/presets/invoicing.ts',
];

function die(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

/**
 * Every `stages: [ … ]` block in a source file, with the workflow name above it.
 *
 * Read as text rather than imported, because these files pull in the whole crm
 * schema package and this check runs on bare Node before anything is built.
 */
function workflowsIn(rel) {
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    die([
      `✖ check:workflow-exit cannot find ${rel}.`,
      '   A source that no longer exists reports a clean pass over nothing.',
      '   [[feedback_structural_checks_go_blind]]',
    ]);
  }
  const lines = readFileSync(full, 'utf8').split('\n');
  const found = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    // A slug is either a literal (`slug: 'invoice'`) or a constant
    // (`slug: NET_TERMS_AR_WORKFLOW_SLUG`). Reading only the literal form
    // attributed the system workflows' stages to whichever workflow came
    // before them, which is a check that passes by looking at the wrong list.
    // [[feedback_structural_checks_go_blind]]
    const slug = /^\s*slug: (?:'([^']+)'|([A-Z][A-Z0-9_]*))\s*,/.exec(lines[i]);
    if (slug) {
      current = { rel, slug: slug[1] ?? slug[2], line: i + 1, stageTypes: [] };
      found.push(current);
      continue;
    }
    const type = /^\s*stageType: '([^']+)'/.exec(lines[i]);
    if (type && current) current.stageTypes.push(type[1]);
  }
  return found;
}

const workflows = SOURCES.flatMap(workflowsIn);
if (workflows.length === 0) {
  die([
    '✖ check:workflow-exit parsed no workflows at all.',
    '   That is not a clean pass, it is a parse that found nothing.',
  ]);
}

// A block with no stages is a line-type registry or a template, not a workflow.
const withStages = workflows.filter((w) => w.stageTypes.length > 0);
const stranded = withStages.filter((w) => !w.stageTypes.includes('void'));

if (stranded.length > 0) {
  die([
    `✖ ${String(stranded.length)} built-in workflow(s) have no way out:`,
    '',
    ...stranded.map(
      (w) => `   ${w.rel}:${String(w.line)}  ${w.slug}  [${w.stageTypes.join(', ')}]`
    ),
    '',
    '   A document on one of these can never be canceled. The console offers a',
    '   delete only on a `draft` stage, so a workflow with neither is a document',
    '   that is permanent from the moment it is created — and anything that',
    '   refuses to be raised twice against the same record is then stuck too.',
    '',
    "   Add a terminal stage with `stageType: 'void'` (locksEditing: true,",
    "   numberOnEnter: false, color '#EF4444'). Entering one stamps voidedAt,",
    '   sets the status to void and publishes crm.billing_document.voided.',
  ]);
}

console.log(
  `✓ check:workflow-exit — ${String(withStages.length)} built-in workflow(s) across ` +
    `${String(SOURCES.length)} source file(s), every one with a void stage to end on ` +
    `(${String(withStages.map((w) => w.stageTypes.length).reduce((a, b) => a + b, 0))} stages read).`
);
