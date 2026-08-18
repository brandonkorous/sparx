'use client';

// Presentational helpers for the automations surfaces — status tones, plain
// summaries of a rule's trigger/conditions/actions, and the module tags. Pure
// (no data hooks), so any surface renders them.
//
// The rich rule document is PARSED from the stored JSON columns with the
// canonical `@wizeworks/automation-schemas` parsers — never re-implemented here — so
// the editor and the read views can never disagree with the engine. Parsing is
// defensive: a malformed legacy row degrades to a raw view rather than throwing.

import { Badge } from '@wizeworks/silicaui-react';
import {
  faBan,
  faBolt,
  faBuilding,
  faCartShopping,
  faClock,
  faCodeBranch,
  faEnvelope,
  faFilter,
  faHourglass,
  faLifeRing,
  faListCheck,
  faListUl,
  faNoteSticky,
  faPencilLine,
  faPhoneVolume,
  faRepeat,
  faShuffle,
  faSliders,
  faSplit,
  faTag,
  faWebhook,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';
import {
  Action as ActionSchema,
  ConditionGroup as ConditionGroupSchema,
  IfElseConfig,
  isConditionGroup,
  triggerFromColumns,
} from '@wizeworks/automation-schemas';
import type {
  Action,
  AutomationStatus,
  ConditionGroup,
  RunStatus,
  ScheduleSpec,
  StepStatus,
  Trigger,
} from '@wizeworks/automation-schemas';
import { ModuleScope, type WorkbenchModule } from '../../components/module-scope';
import {
  DAYS_OF_WEEK,
  actionLabel,
  deriveModules,
  moduleLabel,
  operatorDef,
  primitiveText,
  scanEntityLabel,
  TRIGGER_EVENTS,
  type ModuleSlug,
} from './automations-catalog';
import type { Tone } from './automations-data';
import { productCopy } from '../../lib/product';

// ─── parsing (defensive) ─────────────────────────────────────────────────────

export function parseTrigger(triggerType: string, triggerConfig: unknown): Trigger | null {
  try {
    return triggerFromColumns(triggerType, triggerConfig);
  } catch {
    return null;
  }
}

export function parseConditions(conditions: unknown): ConditionGroup {
  const result = ConditionGroupSchema.safeParse(conditions);
  return result.success ? result.data : { logic: 'AND', conditions: [] };
}

export function parseActions(actions: unknown): Action[] {
  if (!Array.isArray(actions)) return [];
  const out: Action[] = [];
  for (const raw of actions) {
    const result = ActionSchema.safeParse(raw);
    if (result.success) out.push(result.data);
  }
  return out;
}

// ─── schedule + trigger summaries ────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

function minuteToHHMM(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

export function humanizeSchedule(schedule: ScheduleSpec): string {
  switch (schedule.cadence) {
    case 'daily':
      return `Every day at ${minuteToHHMM(schedule.atMinuteUtc)} UTC`;
    case 'weekly': {
      const day = DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek)?.label ?? 'day';
      return `Every ${day} at ${minuteToHHMM(schedule.atMinuteUtc)} UTC`;
    }
    case 'monthly':
      return `On day ${String(schedule.dayOfMonth)} of the month at ${minuteToHHMM(
        schedule.atMinuteUtc
      )} UTC`;
    case 'interval':
      return `Every ${String(schedule.everyMinutes)} minutes`;
    case 'once':
      return schedule.at ? `Once, at ${schedule.at.slice(0, 16).replace('T', ' ')} UTC` : 'Once';
  }
}

/** A one-line, plain-language summary of what starts a rule. */
export function summarizeTrigger(triggerType: string, triggerConfig: unknown): string {
  const trigger = parseTrigger(triggerType, triggerConfig);
  if (!trigger) return triggerType;
  if (trigger.kind === 'event') {
    const known = TRIGGER_EVENTS.find((e) => e.eventType === trigger.eventType);
    return known ? known.label : `When ${trigger.eventType}`;
  }
  return `${humanizeSchedule(trigger.schedule)} · scanning ${scanEntityLabel(
    trigger.predicate.entity
  )}`;
}

// ─── status tones ────────────────────────────────────────────────────────────

interface State {
  label: string;
  tone: Tone;
  detail: string;
}

export function automationState(status: AutomationStatus): State {
  switch (status) {
    case 'active':
      return {
        label: 'On',
        tone: 'success',
        detail: 'This rule is running — it acts every time its trigger happens.',
      };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'warning',
        detail: 'This rule is switched off for now. It keeps its setup and can be turned back on.',
      };
    case 'draft':
      return {
        label: 'Draft',
        tone: 'neutral',
        detail: 'This rule is not running yet. Turn it on when you are ready.',
      };
    case 'error':
      return {
        label: 'Needs attention',
        tone: 'danger',
        detail:
          'Something went wrong the last time this rule ran. Check its recent runs to see what failed.',
      };
  }
}

export function runState(status: RunStatus): State {
  switch (status) {
    case 'completed':
      return { label: 'Finished', tone: 'success', detail: 'Every step ran to the end.' };
    case 'converted':
      // The best outcome a run has, so it gets the module hue rather than
      // sharing plain green with "ran to the end and nothing happened".
      return {
        label: 'Worked',
        tone: 'module',
        detail: 'What you were aiming for happened, so the rest of the steps were skipped.',
      };
    case 'failed':
      return { label: 'Failed', tone: 'danger', detail: 'A step could not complete.' };
    case 'running':
      return { label: 'Running', tone: 'info', detail: 'This run is in progress.' };
    case 'waiting':
      return {
        label: 'Waiting',
        tone: 'warning',
        detail: 'Paused on a “wait” step until its delay is up.',
      };
    case 'skipped':
      return {
        label: 'Skipped',
        tone: 'neutral',
        detail: 'The conditions no longer matched, so nothing ran.',
      };
  }
}

export function stepState(status: StepStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'completed':
      return { label: 'Done', tone: 'success' };
    case 'failed':
      return { label: 'Failed', tone: 'danger' };
    case 'gated':
      return { label: 'Held back', tone: 'warning' };
    case 'running':
      return { label: 'Running', tone: 'info' };
    case 'skipped':
      return { label: 'Skipped', tone: 'neutral' };
    case 'pending':
      return { label: 'Waiting', tone: 'neutral' };
  }
}

// ─── module tags + tier ──────────────────────────────────────────────────────

/** The parts of the business a rule touches, each in its own module hue. Each
 *  badge carries its own ModuleScope because CSS vars cascade by DOM, so the hue
 *  has to be re-established around every badge. */
export function ModuleTags({
  trigger,
  actions,
}: {
  trigger: { triggerType: string; triggerConfig: unknown };
  actions: readonly { type: string }[];
}) {
  const modules: ModuleSlug[] = deriveModules(trigger, actions);
  if (modules.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {modules.map((m) => (
        <ModuleScope key={m} module={m as WorkbenchModule}>
          <Badge color="module" variant="soft" size="sm">
            {moduleLabel(m)}
          </Badge>
        </ModuleScope>
      ))}
    </div>
  );
}

/** The tier badge — Locked / Managed for platform rules, nothing for a tenant's
 *  own. Locked is the one that changes what a person can DO, so it is warning. */
export function TierBadge({ origin, locked }: { origin: string; locked: boolean }) {
  if (locked) {
    return (
      <Badge color="warning" variant="soft" size="sm">
        {productCopy('automations.badge.managed', 'Managed by sparx')}
      </Badge>
    );
  }
  if (origin === 'system') {
    return (
      <Badge color="info" variant="soft" size="sm">
        {productCopy('automations.badge.system', 'Set up by sparx')}
      </Badge>
    );
  }
  return null;
}

// ─── condition + action read views ───────────────────────────────────────────

function conditionValueText(value: unknown): string {
  if (Array.isArray(value)) return value.map(primitiveText).join(', ');
  return primitiveText(value);
}

// Accepts `unknown` on purpose: after the isConditionGroup guard, tsc widens a
// leaf of the finite-depth ConditionNode union to `unknown`, so a typed param
// would force a cast at the call site. Reading defensively keeps the call site
// clean AND degrades a malformed leaf to a plain string rather than throwing.
export function conditionToText(node: unknown): string {
  const c = (node ?? {}) as { field?: unknown; operator?: unknown; value?: unknown };
  const field = typeof c.field === 'string' ? c.field : '';
  const operator = typeof c.operator === 'string' ? c.operator : 'eq';
  const op = operatorDef(operator);
  const label = op?.label ?? operator;
  if (op?.valueless) return `${field} ${label}`.trim();
  return `${field} ${label} ${conditionValueText(c.value)}`.trim();
}

export function ConditionGroupView({
  group,
  nested = false,
}: {
  group: ConditionGroup;
  nested?: boolean;
}) {
  if (group.conditions.length === 0) {
    return (
      <p className="text-sm">
        {nested ? '(empty group)' : 'No conditions — this runs every time its trigger happens.'}
      </p>
    );
  }
  return (
    <ul
      className={
        nested ? 'border-base-300 flex flex-col gap-1 border-l-2 pl-3' : 'flex flex-col gap-1'
      }
    >
      {group.conditions.map((node, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          {i > 0 ? (
            <span className="mt-0.5 text-xs font-semibold">
              {group.logic === 'AND' ? 'AND' : 'OR'}
            </span>
          ) : null}
          {isConditionGroup(node) ? (
            <ConditionGroupView group={node} nested />
          ) : (
            <code className="bg-base-200 rounded px-1.5 py-0.5 font-mono text-xs break-all">
              {conditionToText(node)}
            </code>
          )}
        </li>
      ))}
    </ul>
  );
}

export function actionSummaryText(action: Action): string {
  const cfg = action.config;
  switch (action.type) {
    case 'platform.wait': {
      const secs = Number(cfg.delaySeconds);
      return Number.isFinite(secs) ? `Wait ${secs.toLocaleString()} seconds` : 'Wait';
    }
    case 'platform.stop':
      return typeof cfg.reason === 'string' && cfg.reason ? `Stop — ${cfg.reason}` : 'Stop here';
    case 'crm.add_tag':
    case 'crm.remove_tag': {
      const tags = cfg.tags;
      return `${actionLabel(action.type)}: ${Array.isArray(tags) ? tags.join(', ') : ''}`.trim();
    }
    case 'email.send_internal':
      return `Email ${typeof cfg.to === 'string' ? cfg.to : 'staff'}`;
    case 'platform.if_else': {
      // The author's own note wins, because "did they book a call?" is a better
      // headline than any rendering of the condition tree behind it.
      const branch = IfElseConfig.safeParse(cfg);
      if (!branch.success) return 'Go one way or the other';
      if (branch.data.label) return branch.data.label;
      const chips = conditionChips(branch.data.condition);
      return chips.length > 0 ? `If ${chips[0]}` : 'Go one way or the other';
    }
    default:
      return actionLabel(action.type);
  }
}

/** How many steps sit on each side of a branch — what the canvas shows on the
 *  collapsed card so an author can see the shape without opening it. */
export function branchCounts(action: Action): { then: number; otherwise: number } | null {
  if (action.type !== 'platform.if_else') return null;
  const branch = IfElseConfig.safeParse(action.config);
  if (!branch.success) return { then: 0, otherwise: 0 };
  return { then: branch.data.then.length, otherwise: branch.data.otherwise.length };
}

/** The two arms of a branch, parsed. Returns empty lists for an unparseable
 *  config rather than throwing — a rule with one bad step should still render,
 *  so somebody can see it and fix it. */
export function branchArms(action: Action): { then: Action[]; otherwise: Action[] } {
  const branch = IfElseConfig.safeParse(action.config);
  if (!branch.success) return { then: [], otherwise: [] };
  return { then: branch.data.then, otherwise: branch.data.otherwise };
}

// ══════════════════════════════════════════════════════════════════════════
// FLOW-NODE MODEL — the editor's visual map.
//
// The editor draws a rule as a vertical pipeline of NODES: a Settings node, the
// Trigger ("When"), the Conditions ("Only if"), then each Action ("Then …") in
// order. Selection is a single node id; the canvas highlights it and the
// inspector edits it. The humanizers below are the ONE source of the plain-
// language headline + detail shown on each node card — so the canvas and the
// inspector header never drift — all driven by the catalog vocabulary.
// ══════════════════════════════════════════════════════════════════════════

export const SETTINGS_NODE = 'settings';
export const TRIGGER_NODE = 'trigger';
export const CONDITIONS_NODE = 'conditions';
/** What the rule is aiming to cause (docs/144 §9). A node of its own rather than
 *  a setting, because it is the same kind of statement as the trigger and the
 *  conditions — and because it is what makes the run history worth reading. */
export const GOAL_NODE = 'goal';

/** A selectable node id: a fixed node above, or an action's stable id. */
export type NodeId = string;

/** Icon vocabulary shared by the node markers and the inspector headers, so a
 *  node wears the same glyph in both places. */
export type NodeIconKey =
  | 'settings'
  | 'zap'
  | 'clock'
  | 'filter'
  | 'wait'
  | 'stop'
  | 'webhook'
  | 'tag'
  | 'note'
  | 'field'
  | 'task'
  | 'deal'
  | 'support'
  | 'mail'
  | 'mail-plus'
  | 'sequence'
  | 'b2b'
  | 'commerce'
  | 'branch'
  | 'rotate'
  | 'list'
  | 'phone'
  | 'action';

export const NODE_ICONS: Record<NodeIconKey, PigglesIcon> = {
  settings: faSliders,
  zap: faBolt,
  clock: faClock,
  filter: faFilter,
  wait: faHourglass,
  stop: faBan,
  webhook: faWebhook,
  tag: faTag,
  note: faNoteSticky,
  field: faPencilLine,
  task: faListCheck,
  deal: faCodeBranch,
  support: faLifeRing,
  mail: faEnvelope,
  'mail-plus': faEnvelope,
  sequence: faRepeat,
  b2b: faBuilding,
  commerce: faCartShopping,
  // Split, not GitBranch: `deal` already wears GitBranch, and two different
  // things sharing a glyph on the same canvas is how a map stops being one.
  branch: faSplit,
  rotate: faShuffle,
  list: faListUl,
  phone: faPhoneVolume,
  action: faBolt,
};

/* ── trigger node ────────────────────────────────────────────────────────── */

export function triggerHeadline(trigger: Trigger): string {
  if (trigger.kind === 'schedule') return humanizeSchedule(trigger.schedule);
  const label = TRIGGER_EVENTS.find((e) => e.eventType === trigger.eventType)?.label;
  if (label) return label;
  return trigger.eventType.trim() ? `When ${trigger.eventType}` : 'Choose what starts this';
}

export function triggerDetail(trigger: Trigger): string {
  if (trigger.kind === 'schedule') {
    return `On a schedule · looks at ${scanEntityLabel(trigger.predicate.entity)}`;
  }
  // For a curated event the headline is the friendly label, so the detail carries
  // the raw event name; for a custom event the headline already IS the event.
  return isCuratedTriggerEvent(trigger) ? trigger.eventType : 'When something happens';
}

/** True when the event is one of the curated suggestions — its headline is the
 *  friendly label, so the canvas shows the raw event name (the detail) in mono. */
export function isCuratedTriggerEvent(trigger: Trigger): boolean {
  return trigger.kind === 'event' && TRIGGER_EVENTS.some((e) => e.eventType === trigger.eventType);
}

export function triggerIcon(trigger: Trigger): NodeIconKey {
  return trigger.kind === 'schedule' ? 'clock' : 'zap';
}

/* ── conditions node ─────────────────────────────────────────────────────── */

export function conditionsHeadline(group: ConditionGroup): string {
  if (group.conditions.length === 0) return 'Runs every time';
  return group.logic === 'OR' ? 'Only if any of these match' : 'Only if all of these match';
}

export function conditionsDetail(group: ConditionGroup): string {
  if (group.conditions.length === 0) return 'No conditions — runs on every trigger';
  const n = group.conditions.length;
  return n === 1 ? '1 condition' : `${String(n)} conditions`;
}

const MAX_CHIPS = 3;

/** Short chip texts for the canvas node — the first few top-level conditions, a
 *  nested sub-group collapsed to "( … )". The full nested editor is the inspector. */
export function conditionChips(group: ConditionGroup): string[] {
  return group.conditions
    .slice(0, MAX_CHIPS)
    .map((node) => (isConditionGroup(node) ? '( … )' : conditionToText(node)));
}

export function conditionsOverflow(group: ConditionGroup): number {
  return Math.max(0, group.conditions.length - MAX_CHIPS);
}

/* ── action node ─────────────────────────────────────────────────────────── */

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
  'platform.notify': 'note',
  'crm.add_tag': 'tag',
  'crm.remove_tag': 'tag',
  'crm.add_note': 'note',
  'crm.update_field': 'field',
  'crm.create_task': 'task',
  'crm.create_ticket': 'support',
  'crm.update_deal_stage': 'deal',
  'crm.capture_lead': 'task',
  'platform.if_else': 'branch',
  'crm.create_record': 'field',
  'crm.set_property': 'field',
  'crm.rotate_owner': 'rotate',
  'crm.add_to_list': 'list',
  'engagement.send_email': 'mail',
  'voice.log_call_task': 'phone',
  'form.notify': 'mail-plus',
  'form.autoreply': 'mail',
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
  if (head === 'commerce' || head === 'inventory') return 'commerce';
  return 'action';
}
