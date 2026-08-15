'use client';

// Presentational helpers for the workflow editor's two panes — the stage-type
// vocabulary, the short label, and the plain-language summary of what entering a
// stage does. Pure (no data hooks, no JSX), so both the canvas and the inspector
// render the same words for the same stage and can never drift apart.
//
// This is salvaged verbatim from the old stage-list.tsx: the copy here is the
// considered, non-technical wording a shop owner reads, and rewording it would be
// a regression, not a rebuild.

import type { StageDraft } from './workflow-data';
import type { DocumentStageType } from './types';

/**
 * The six semantic roles, in the order a document actually travels through them,
 * each labelled with what it MEANS rather than what it is called in the schema.
 * `stageType` is the only thing system behaviour keys off, so choosing one is
 * the single most consequential field on this screen — and "committed" tells a
 * shop owner nothing on its own.
 */
export const STAGE_TYPES: { value: DocumentStageType; label: string; hint: string }[] = [
  {
    value: 'draft',
    label: 'Draft — still being put together',
    hint: 'Nothing is promised to the customer yet.',
  },
  {
    value: 'open',
    label: 'Open — sent, still changeable',
    hint: 'The customer can see it and you can still edit it.',
  },
  {
    value: 'committed',
    label: 'Committed — the customer approved it',
    hint: 'They have said yes. The work can start.',
  },
  {
    value: 'final',
    label: 'Final — billable, awaiting payment',
    hint: 'This is what they owe. Usually where you stop editing.',
  },
  {
    value: 'paid',
    label: 'Paid — settled',
    hint: 'The money has arrived and the document is done.',
  },
  {
    value: 'void',
    label: 'Void — cancelled',
    hint: 'Kept for the record, but it is not owed and not collectable.',
  },
];

/** The short half of the option label — the part before the em dash. */
export function typeLabel(type: DocumentStageType): string {
  return (
    (STAGE_TYPES.find((option) => option.value === type)?.label ?? type).split(' — ')[0] ?? type
  );
}

/** The one-line hint under the stage-type select. */
export function typeHint(type: DocumentStageType): string {
  return STAGE_TYPES.find((option) => option.value === type)?.hint ?? '';
}

/** What entering this stage does, as a sentence fragment per effect. Mirrors the
 *  wording `lifecycle.tsx` uses in its advance confirm, so the thing configured
 *  here and the thing an operator is warned about later read the same. */
export function effectSummary(stage: StageDraft): string {
  const effects: string[] = [];
  if (stage.numberOnEnter) {
    const prefix = stage.numberPrefix.trim();
    effects.push(prefix ? `numbers it ${prefix}…` : 'numbers it');
  }
  if (stage.snapshotOnEnter) effects.push('freezes a permanent record');
  if (stage.locksEditing) effects.push('locks it from edits');
  if (effects.length === 0) return 'Arriving here changes nothing about the document.';
  const joined =
    effects.length === 1
      ? effects[0]
      : `${effects.slice(0, -1).join(', ')} and ${effects[effects.length - 1] ?? ''}`;
  return `Arriving here ${joined ?? ''}.`;
}
