// Flow-node model for the Automation editor (map + inspector).
//
// The editor presents the rule as a vertical pipeline of NODES: a Settings node,
// the Trigger ("When"), the Conditions ("Only if"), then each Action ("Then …")
// in order. Selection is a single node id — the canvas highlights it and the
// inspector edits it. Node ids:
//   • 'settings' | 'trigger' | 'conditions' — the fixed nodes (always present)
//   • an action's stable id (owned by the editor shell; parallels the Action[])
// Reserved ids never collide with action ids (the shell prefixes those `act-`).
//
// This module is the single source of the human-readable summaries shown on each
// node card (headline + detail) and the icon each node wears, so the canvas and
// the inspector header never drift. Pure + client-safe (no JSX, no server imports)
// — the summary strings reuse the canonical `presentation` helpers so the map and
// the read-only detail view describe a rule identically.

import type { Action, Condition, ConditionGroup, Trigger } from '@sparx/automation-schemas';
import { isConditionGroup } from '@sparx/automation-schemas';

import { SCAN_ENTITIES, TRIGGER_EVENTS } from './catalog';
import { actionSummaryText, conditionToText, humanizeSchedule } from './presentation';

export const SETTINGS_NODE = 'settings';
export const TRIGGER_NODE = 'trigger';
export const CONDITIONS_NODE = 'conditions';

/** A selectable node id: a fixed node or an action's stable id. */
export type NodeId = string;

/** Icon vocabulary for the node markers + inspector headers. The canvas maps each
 *  key to a lucide icon (kept out of this pure module). */
export type NodeIconKey =
  | 'settings'
  | 'zap'
  | 'clock'
  | 'filter'
  | 'wait'
  | 'stop'
  | 'webhook'
  | 'tag'
  | 'tag-off'
  | 'note'
  | 'field'
  | 'task'
  | 'deal'
  | 'mail'
  | 'mail-plus'
  | 'sequence'
  | 'b2b'
  | 'commerce'
  | 'action';

// ─── trigger ─────────────────────────────────────────────────────────────────

export function triggerHeadline(trigger: Trigger): string {
  if (trigger.kind === 'schedule') return humanizeSchedule(trigger.schedule);
  const label = TRIGGER_EVENTS.find((e) => e.eventType === trigger.eventType)?.label;
  if (label) return label;
  return trigger.eventType.trim() ? trigger.eventType : 'Choose a trigger';
}

export function triggerDetail(trigger: Trigger): string {
  if (trigger.kind === 'schedule') {
    const entity =
      SCAN_ENTITIES.find((s) => s.entity === trigger.predicate.entity)?.label ??
      trigger.predicate.entity;
    return `Scheduled scan · ${entity}`;
  }
  // For a curated event the headline is the friendly label, so the detail carries
  // the raw event type; for a custom event the headline already IS the type.
  const isCurated = TRIGGER_EVENTS.some((e) => e.eventType === trigger.eventType);
  return isCurated ? trigger.eventType : 'Event trigger';
}

export function triggerIcon(trigger: Trigger): NodeIconKey {
  return trigger.kind === 'schedule' ? 'clock' : 'zap';
}

/** True when the event is one of the curated suggestions — its headline is the
 *  friendly label, so the canvas renders the raw event type (the detail) in mono. */
export function isCuratedTriggerEvent(trigger: Trigger): boolean {
  return trigger.kind === 'event' && TRIGGER_EVENTS.some((e) => e.eventType === trigger.eventType);
}

// ─── conditions ──────────────────────────────────────────────────────────────

export function conditionsHeadline(group: ConditionGroup): string {
  if (group.conditions.length === 0) return 'No conditions';
  return group.logic === 'OR' ? 'Only if any of these match' : 'Only if all of these match';
}

/** One-line fallback detail (used where chips don't fit). */
export function conditionsDetail(group: ConditionGroup): string {
  if (group.conditions.length === 0) return 'Runs on every trigger';
  const n = group.conditions.length;
  return n === 1 ? '1 condition' : `${n} conditions`;
}

/** Short chip texts for the canvas node — the first few top-level conditions, with
 *  a nested sub-group collapsed to `( … )`. The full nested editor lives in the
 *  inspector, so the card only needs a glanceable preview. */
const MAX_CHIPS = 3;
export function conditionChips(group: ConditionGroup): string[] {
  return group.conditions
    .slice(0, MAX_CHIPS)
    .map((node) => (isConditionGroup(node) ? '( … )' : conditionToText(node as Condition)));
}
export function conditionsOverflow(group: ConditionGroup): number {
  return Math.max(0, group.conditions.length - MAX_CHIPS);
}

// ─── actions ─────────────────────────────────────────────────────────────────

export function actionHeadline(action: Action): string {
  return actionSummaryText(action);
}

export function actionDetail(action: Action): string {
  return action.type;
}

const ACTION_ICONS: Record<string, NodeIconKey> = {
  'platform.wait': 'wait',
  'platform.stop': 'stop',
  'platform.webhook': 'webhook',
  'crm.add_tag': 'tag',
  'crm.remove_tag': 'tag-off',
  'crm.add_note': 'note',
  'crm.update_field': 'field',
  'crm.create_task': 'task',
  'crm.update_deal_stage': 'deal',
  'email.send_campaign': 'mail',
  'email.send_internal': 'mail-plus',
  'email.sequence_add': 'sequence',
  'email.sequence_remove': 'sequence',
};

export function actionIcon(action: Action): NodeIconKey {
  const exact = ACTION_ICONS[action.type];
  if (exact) return exact;
  const head = action.type.split('.')[0];
  if (head === 'b2b') return 'b2b';
  if (head === 'commerce') return 'commerce';
  return 'action';
}
