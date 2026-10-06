// What changes if the business switches a rule we set up to our newer version.
// Pure and JSX-free, so the confirm renders it and the test reads it. The words
// for each part come in as `RuleWords`, built from the flow map's own helpers.

import { ConditionGroup as ConditionGroupSchema } from '@wizeworks/automation-schemas';
import type { AutomationStatus, ConditionGroup } from '@wizeworks/automation-schemas';
import type { PlatformDocument } from './automations-data';

/** Shown when we improved a rule we set up and held it back for theirs. */
export const PLATFORM_UPDATE_TEXT = {
  label: 'We improved this',
  title: 'We have a newer version of this automation',
  detail:
    'We set this up for you and have made it better since. You changed yours, so we left it exactly as it is. It keeps running your way. You can compare the two and switch to ours. If you do, yours stays in its history.',
  badgeTitle:
    'We improved this since you changed it. Yours keeps running as it is. Open it to compare the two and choose.',
} as const;

/** How each part of a rule reads, in the editor's own words. */
export interface RuleWords {
  trigger: (triggerType: string, triggerConfig: unknown) => string;
  /** The lines for a condition group; `none` when it has no conditions. */
  conditions: (group: ConditionGroup, none: string) => string[];
  /** One line per top-level step, in order. */
  steps: (actions: unknown) => string[];
}

/** One part of a rule, as it reads now and as it would after the switch. */
export interface RulePartChange {
  part: 'trigger' | 'conditions' | 'actions' | 'goal' | 'description' | 'maxDepth';
  label: string;
  yours: string[];
  theirs: string[];
  /** The two read the same here but differ in a setting the summary hides. */
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

function descriptionText(d: PlatformDocument): string | undefined {
  const text = d.description?.trim();
  if (!text) return undefined;
  return text;
}

interface Part {
  part: RulePartChange['part'];
  label: string;
  raw: (d: PlatformDocument) => unknown;
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
      raw: (d) => (group(d.goal).conditions.length === 0 ? null : d.goal),
      lines: (d) => words.conditions(group(d.goal), 'No goal yet'),
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

/** Every part that differs between theirs and ours, in the editor's order. */
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
    const hidden = yours.length === theirs.length && yours.every((l, i) => l === theirs[i]);
    changes.push({ part: p.part, label: p.label, yours, theirs, hidden });
  }
  return changes;
}

/** The on/off the switch leaves alone, as a clause. */
export function statusKept(status: AutomationStatus): string {
  switch (status) {
    case 'active':
      return 'it stays on';
    case 'paused':
      return 'it stays paused';
    case 'draft':
      return 'it stays off';
    case 'error':
      return 'it stays on or off, just as it is now';
  }
}

/** Every sentence the switch says. */
export const PLATFORM_VERSION_WORDS = {
  button: 'Use our version',
  blocked:
    'You have changes you have not published yet. Publish them or throw them away first. Then you can switch.',
  notReady: 'We are still getting our new version ready. You can switch here within a day.',
  confirmTitle: (name: string) => `Use our version of ${name}?`,
  confirmLead: 'This swaps what this automation does for our newer version.',
  confirmNoDetail: 'It swaps what starts it, what it checks, its steps and its description.',
  hiddenNote: 'These read the same here, but a setting inside them is different.',
  yours: 'Yours',
  theirs: 'Ours',
  confirmKeeps: (name: string, status: AutomationStatus) =>
    `It keeps its name, ${name}, and ${statusKept(status)}. We save your current version in its history. You can bring it back any time.`,
  confirmLabel: 'Use our version',
  cancelLabel: 'Keep mine',
  doneTitle: 'You are on our new version',
  doneDetail: 'Your earlier version is saved in its history.',
  failedTitle: 'We could not switch it',
} as const;
