import type { Action, ConditionGroup, Trigger } from '@wizeworks/automation-schemas';
import { parseActions, parseConditions, parseTrigger } from '../automations-presentation';
import type { Automation } from '../automations-data';

// Stable per-action ids — dnd-kit + React key off the ITEM, not the index, so a
// card's identity follows it across inserts and reorders. A random base keeps
// them globally unique even across editor instances / HMR (the builder's rule).
const ID_BASE = Math.random().toString(36).slice(2, 8);
let ACTION_UID = 0;
export const newActionId = () => `act-${ID_BASE}-${String(ACTION_UID++)}`;

export interface DocFields {
  name: string;
  description: string;
  trigger: Trigger;
  conditions: ConditionGroup;
  actions: Action[];
  /** What this rule is trying to cause (docs/144 §9). Null = no goal, which is
   *  most rules — a receipt email is not trying to cause anything. */
  goal: ConditionGroup | null;
  maxDepth: number;
}

export const EMPTY_FIELDS: DocFields = {
  name: '',
  description: '',
  trigger: { kind: 'event', eventType: 'order.placed' },
  conditions: { logic: 'AND', conditions: [] },
  actions: [],
  goal: null,
  maxDepth: 3,
};

/** A new rule opened from somewhere that already knows what it is for (e.g. the sequence editor).
 *  Only the ACTION and the NAME: the trigger is the real decision, and guessing it would be the
 *  editor pretending to know something it does not. */
export interface NewAutomationSeed {
  /** The sequence to add people to. */
  sequenceId: string;
  /** What the rule is called before she renames it. Empty is fine. */
  name: string;
}

export function seededFields(seed: NewAutomationSeed): DocFields {
  return {
    ...EMPTY_FIELDS,
    name: seed.name,
    actions: [{ type: 'email.sequence_add', config: { sequenceId: seed.sequenceId } }],
  };
}

/** Read the editing document out of an automation — from its staged draft when one
 *  exists (source 'draft'), or from the live published columns (source 'live'). */
export function docFieldsFrom(a: Automation, source: 'draft' | 'live'): DocFields {
  const src =
    source === 'draft' && a.draft
      ? a.draft
      : {
          name: a.name,
          description: a.description,
          triggerType: a.triggerType,
          triggerConfig: a.triggerConfig,
          conditions: a.conditions,
          actions: a.actions,
          goal: a.goal,
          maxDepth: a.maxDepth,
        };
  return {
    name: src.name,
    description: src.description ?? '',
    trigger: parseTrigger(src.triggerType, src.triggerConfig) ?? {
      kind: 'event',
      eventType: src.triggerType,
    },
    conditions: parseConditions(src.conditions),
    actions: parseActions(src.actions),
    // An EMPTY group is not a goal — it passes for everything, so storing one
    // would convert every run the moment it enrolled. A draft written before
    // goals existed has no key at all, which lands here as null either way.
    goal: parseGoal(src.goal),
    maxDepth: src.maxDepth,
  };
}

/** A stored goal, or null when there isn't a meaningful one. */
function parseGoal(stored: unknown): ConditionGroup | null {
  if (stored === null || stored === undefined) return null;
  const parsed = parseConditions(stored);
  return parsed.conditions.length === 0 ? null : parsed;
}

/** Canonical serialization of the authoring document — drives dirty detection.
 *  Site scope is deliberately excluded: it is a live setting, not part of the
 *  versioned draft. */
export function serializeDoc(f: DocFields): string {
  return JSON.stringify({
    name: f.name.trim(),
    description: f.description.trim() ? f.description.trim() : null,
    trigger: f.trigger,
    conditions: f.conditions,
    actions: f.actions,
    goal: f.goal,
    maxDepth: f.maxDepth,
  });
}
