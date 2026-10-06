// What changes if the business switches a rule sparx set up to sparx's newer version.
//
// The re-sync never writes over a rule the business changed; it keeps sparx's newer
// version beside theirs (`platformDocument`). Before they switch, the confirm shows
// them, part by part, what is different. Only the parts that differ are listed, so
// a one-line fix does not read like the whole rule is being rewritten.
//
// Pure, and free of JSX: the confirm renders this, and the test reads it. The words
// for each part come in as `RuleWords`, which the confirm builds from the same
// presentation helpers the editor's flow map uses, so the two never disagree.

import { ConditionGroup as ConditionGroupSchema } from '@wizeworks/automation-schemas';
import type { AutomationStatus, ConditionGroup } from '@wizeworks/automation-schemas';
import type { PlatformDocument } from './automations-data';

/** What the business is told when sparx has improved a rule it set up, and held
 *  the improvement back because the business had changed its copy. */
export const PLATFORM_UPDATE_TEXT = {
  label: 'Newer version from sparx',
  title: 'sparx has a newer version of this automation',
  detail:
    'sparx set this automation up for you and has improved it since. You changed this one, so yours was kept exactly as you set it and keeps running that way. You can compare the two and switch to sparx’s version. Yours stays in this automation’s history if you do.',
  /** On the list, where the row is the way in. */
  badgeTitle:
    'sparx has improved this automation since you changed it. Yours keeps running as it is. Open it to compare the two and choose.',
} as const;

/** How each part of a rule reads, in the editor's own words. */
export interface RuleWords {
  trigger: (triggerType: string, triggerConfig: unknown) => string;
  /** The lines for a condition group; `none` when it has no conditions. */
  conditions: (group: ConditionGroup, none: string) => string[];
  /** One line per top-level step, in order. */
  steps: (actions: unknown) => string[];
}

/** One part of a rule, as it reads now and as it would read after the switch. */
export interface RulePartChange {
  part: 'trigger' | 'conditions' | 'actions' | 'goal' | 'description' | 'maxDepth';
  /** The part's name, the same one the editor gives it. */
  label: string;
  yours: string[];
  theirs: string[];
  /** Set when the two read the same here but differ in a setting the summary
   *  does not show (who an email goes to, what a task says). */
  hidden: boolean;
}

/** Key order is not a difference: jsonb hands documents back reordered. */
function canonical(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) {
        const child = (v as Record<string, unknown>)[k];
        if (child !== undefined) out[k] = sort(child);
      }
      return out;
    }
    return v ?? null;
  };
  return JSON.stringify(sort(value));
}

const EMPTY_GROUP: ConditionGroup = { logic: 'AND', conditions: [] };

function group(value: unknown): ConditionGroup {
  const parsed = ConditionGroupSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_GROUP;
}

/** A blank description is no description. */
function descriptionText(d: PlatformDocument): string | undefined {
  const text = d.description?.trim();
  if (!text) return undefined;
  return text;
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

interface Part {
  part: RulePartChange['part'];
  label: string;
  /** What is compared. */
  raw: (d: PlatformDocument) => unknown;
  /** What is shown. */
  lines: (d: PlatformDocument) => string[];
}

function parts(words: RuleWords): Part[] {
  return [
    {
      part: 'trigger',
      label: 'What starts it',
      raw: (d) => [d.triggerType, d.triggerConfig],
      lines: (d) => [words.trigger(d.triggerType, d.triggerConfig)],
    },
    {
      part: 'conditions',
      label: 'Only if',
      raw: (d) => d.conditions,
      lines: (d) => words.conditions(group(d.conditions), 'Runs every time'),
    },
    {
      part: 'actions',
      label: 'What it does',
      raw: (d) => d.actions,
      lines: (d) => {
        const steps = words.steps(d.actions);
        return steps.length > 0 ? steps : ['No steps'];
      },
    },
    {
      part: 'goal',
      label: 'What it’s aiming for',
      // No goal and an empty goal are the same thing to the engine.
      raw: (d) => (group(d.goal).conditions.length === 0 ? null : d.goal),
      lines: (d) => words.conditions(group(d.goal), 'No goal set'),
    },
    {
      part: 'description',
      label: 'Description',
      raw: (d) => descriptionText(d) ?? null,
      lines: (d) => [descriptionText(d) ?? 'No description'],
    },
    {
      part: 'maxDepth',
      label: 'How deep rules may chain',
      raw: (d) => d.maxDepth,
      lines: (d) => [String(d.maxDepth)],
    },
  ];
}

/** Every part of the rule that differs between the business's live version and
 *  sparx's newer one, in the order the editor draws them. */
export function platformVersionChanges(
  live: PlatformDocument,
  platform: PlatformDocument,
  words: RuleWords
): RulePartChange[] {
  const changes: RulePartChange[] = [];
  for (const p of parts(words)) {
    if (canonical(p.raw(live)) === canonical(p.raw(platform))) continue;
    const yours = p.lines(live);
    const theirs = p.lines(platform);
    changes.push({ part: p.part, label: p.label, yours, theirs, hidden: sameLines(yours, theirs) });
  }
  return changes;
}

/** The status the switch leaves exactly as it is, as a clause. */
export function statusKept(status: AutomationStatus): string {
  switch (status) {
    case 'active':
      return 'it stays switched on';
    case 'paused':
      return 'it stays paused';
    case 'draft':
      return 'it stays switched off';
    case 'error':
      return 'whether it is on stays exactly as it is';
  }
}

/** Every sentence the switch says, in one place. */
export const PLATFORM_VERSION_WORDS = {
  button: 'Use sparx’s version',
  blocked:
    'You have unpublished changes. Publish or discard them first, then you can switch to sparx’s version.',
  notReady: 'sparx is still preparing its newer version. You can switch to it here within a day.',
  confirmTitle: (name: string) => `Use sparx’s version of ${name}?`,
  confirmLead: 'This replaces what this automation does with sparx’s newer version.',
  confirmNoDetail:
    'It replaces what starts it, the conditions it checks, its steps and its description.',
  hiddenNote: 'These read the same here, but a setting inside them is different.',
  yours: 'Yours',
  theirs: 'sparx’s',
  confirmKeeps: (name: string, status: AutomationStatus) =>
    `It keeps its name, ${name}, and ${statusKept(status)}. Your current version is saved in its history, so you can bring it back at any time.`,
  confirmLabel: 'Use sparx’s version',
  cancelLabel: 'Keep mine',
  doneTitle: 'Now using sparx’s version',
  doneDetail: 'Your earlier version is saved in this automation’s history.',
  failedTitle: 'Could not switch to sparx’s version',
} as const;
