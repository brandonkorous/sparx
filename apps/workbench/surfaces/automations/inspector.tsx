'use client';

// The inspector — the RIGHT pane. It edits whichever node is selected in the flow
// canvas, switching on the selection id:
//   • 'settings'   → name, description, which business it runs for, loop-guard depth
//   • 'trigger'    → the TriggerEditor (event vs schedule)
//   • 'conditions' → the ConditionEditor (the nested AND/OR filter)
//   • an action id → the ActionConfigEditor (type + config) + remove
// Only the SELECTED node's editor is shown — never all of them stacked open. Each
// view is a heading (the node's identity) over the field editors, which are the
// same sub-editors reused verbatim, just hosted here for one node at a time.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { Filter, Target, type LucideIcon } from 'lucide-react';
import { IfElseConfig } from '@sparx/automation-schemas';
import type { Action, ConditionGroup, Trigger } from '@sparx/automation-schemas';
import type { SiteInfo } from '../../lib/api/shell-data';
import { actionDef, moduleForActionType, moduleLabel } from './automations-catalog';
import {
  CONDITIONS_NODE,
  GOAL_NODE,
  NODE_ICONS,
  SETTINGS_NODE,
  TRIGGER_NODE,
  actionHeadline,
  actionIcon,
  branchArms,
  conditionsHeadline,
  triggerHeadline,
  triggerIcon,
  type NodeId,
} from './automations-presentation';
import { TriggerEditor } from './trigger-editor';
import { ConditionEditor } from './condition-editor';
import { ActionConfigEditor } from './action-config-editor';

const EVERY_SITE = '__all__';

/** The selected node's identity: a tinted icon + title + one-line subtitle. */
function PanelHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="border-base-300 flex items-start gap-3 border-b pb-3">
      <span className="bg-module/10 text-module flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col">
        <Heading level={3} className="truncate text-lg font-semibold">
          {title}
        </Heading>
        <Text className="text-sm">{subtitle}</Text>
      </div>
    </header>
  );
}

export interface InspectorProps {
  selectedId: NodeId | null;
  enabledModules: readonly string[];
  isNew: boolean;
  name: string;
  onName: (v: string) => void;
  nameError: string | null;
  touched: boolean;
  description: string;
  onDescription: (v: string) => void;
  maxDepth: number;
  onMaxDepth: (n: number) => void;
  siteScope: string | null;
  onSiteScope: (v: string | null) => void;
  sites: SiteInfo[];
  trigger: Trigger;
  onTrigger: (t: Trigger) => void;
  conditions: ConditionGroup;
  onConditions: (c: ConditionGroup) => void;
  actions: Action[];
  actionIds: string[];
  onAction: (id: string, next: Action) => void;
  onRemoveAction: (id: string) => void;
  /** What this rule is trying to cause (docs/144 §9); null = no goal. */
  goal: ConditionGroup | null;
  onGoal: (g: ConditionGroup | null) => void;
  /** Resolve any node id — top-level or a path into a branch — to its action. */
  actionForNode: (id: string) => Action | null;
  /** Change the question a branch asks. */
  onBranchQuestion: (branchNodeId: string, condition: ConditionGroup, label?: string) => void;
}

export function Inspector(props: InspectorProps) {
  const { selectedId } = props;
  if (selectedId === TRIGGER_NODE) return <TriggerPanel {...props} />;
  if (selectedId === CONDITIONS_NODE) return <ConditionsPanel {...props} />;
  if (selectedId === GOAL_NODE) return <GoalPanel {...props} />;
  if (selectedId && selectedId !== SETTINGS_NODE) {
    // Top-level first, then anything the tree can resolve — which covers a step
    // inside a branch, addressed by path (see branch-tree). The inspector does
    // not otherwise care where a step lives.
    const idx = props.actionIds.indexOf(selectedId);
    if (idx >= 0) return <ActionPanel {...props} selectedId={selectedId} index={idx} />;
    const nested = props.actionForNode(selectedId);
    if (nested) return <ActionPanel {...props} selectedId={selectedId} index={-1} />;
  }
  return <SettingsPanel {...props} />;
}

function Panel({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 p-3 @lg:p-4">{children}</div>;
}

function SettingsPanel({
  isNew,
  name,
  onName,
  nameError,
  touched,
  description,
  onDescription,
  maxDepth,
  onMaxDepth,
  siteScope,
  onSiteScope,
  sites,
}: InspectorProps) {
  const siteItems: Record<string, string> = {};
  for (const site of sites) siteItems[site.id] = site.name;
  siteItems[EVERY_SITE] = 'Every business on this account';

  return (
    <Panel>
      <PanelHead
        icon={NODE_ICONS.settings}
        title="Settings"
        subtitle="Name it, and choose where it runs"
      />

      <Field>
        <FieldLabel>What is this automation called?</FieldLabel>
        <FieldControl
          render={
            <Input
              color={nameError && touched ? 'error' : 'module'}
              value={name}
              placeholder="e.g. Thank new customers"
              onChange={(event) => {
                onName(event.target.value);
              }}
            />
          }
        />
        {nameError && touched ? (
          <FieldStatus status="error">{nameError}</FieldStatus>
        ) : (
          <FieldDescription>For you — so you can tell your rules apart.</FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel>Description (optional)</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={3}
              value={description}
              placeholder="A note on what this rule is for."
              onChange={(event) => {
                onDescription(event.target.value);
              }}
            />
          }
        />
      </Field>

      <Field>
        <FieldLabel>Which business this runs for</FieldLabel>
        <Select
          color="module"
          aria-label="Which business this runs for"
          value={siteScope ?? EVERY_SITE}
          items={siteItems}
          onValueChange={(next) => {
            const chosen = next as string;
            onSiteScope(chosen === EVERY_SITE ? null : chosen);
          }}
        />
        <FieldDescription>
          Choosing every business is wider — a rule set to one business never fires on another’s
          orders or customers.
          {!isNew ? ' Changing this takes effect straight away, even before you publish.' : ''}
        </FieldDescription>
      </Field>

      <div className="border-base-300 flex flex-col gap-2 border-t pt-4">
        <Field>
          <FieldLabel>How deep rules may chain</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="number"
                min={1}
                max={10}
                className="max-w-[8rem]"
                value={maxDepth}
                onChange={(event) => {
                  onMaxDepth(Math.min(10, Math.max(1, Number(event.target.value) || 1)));
                }}
              />
            }
          />
          <FieldDescription>
            A safety limit — if this rule’s actions set off other rules, how many times that may
            cascade before it stops. Three is a sensible default; leave it unless you know you need
            to change it.
          </FieldDescription>
        </Field>
      </div>
    </Panel>
  );
}

function TriggerPanel({ trigger, onTrigger, enabledModules }: InspectorProps) {
  const Glyph = NODE_ICONS[triggerIcon(trigger)];
  return (
    <Panel>
      <PanelHead icon={Glyph} title="When this runs" subtitle={triggerHeadline(trigger)} />
      <TriggerEditor value={trigger} onChange={onTrigger} enabledModules={enabledModules} />
    </Panel>
  );
}

function ConditionsPanel({ conditions, onConditions }: InspectorProps) {
  return (
    <Panel>
      <PanelHead icon={Filter} title="Only run if…" subtitle={conditionsHeadline(conditions)} />
      <Text className="text-sm">
        Narrow it down so the rule only acts in the cases you want. Leave this empty to run every
        time.
      </Text>
      <ConditionEditor value={conditions} onChange={onConditions} />
    </Panel>
  );
}

function ActionPanel({
  selectedId,
  index,
  actions,
  enabledModules,
  onAction,
  onRemoveAction,
  actionForNode,
  onBranchQuestion,
}: InspectorProps & { selectedId: string; index: number }) {
  // `index >= 0` = a top-level step; otherwise it is nested and resolved by path.
  const action = index >= 0 ? actions[index] : actionForNode(selectedId);
  if (!action) return <Panel />;

  const def = actionDef(action.type);
  const Glyph = NODE_ICONS[actionIcon(action)];
  const module = def?.module ?? moduleForActionType(action.type);
  const title = def?.label ?? actionHeadline(action);
  const subtitle =
    index >= 0
      ? `${moduleLabel(module)} · step ${String(index + 1)} of ${String(actions.length)}`
      : `${moduleLabel(module)} · inside a branch`;

  return (
    <Panel>
      <PanelHead icon={Glyph} title={title} subtitle={subtitle} />
      {action.type === 'platform.if_else' ? (
        <BranchQuestionEditor
          action={action}
          onChange={(condition, label) => {
            onBranchQuestion(selectedId, condition, label);
          }}
        />
      ) : null}
      <ActionConfigEditor
        action={action}
        actionId={selectedId}
        enabledModules={enabledModules}
        onChange={(next) => {
          onAction(selectedId, next);
        }}
        onRemove={() => {
          onRemoveAction(selectedId);
        }}
      />
    </Panel>
  );
}

/**
 * The question a branch asks, plus the note shown on its card.
 *
 * The note is offered FIRST and deliberately: a rendered condition tree tells you
 * what the rule checks, and "did they book a call?" tells you what it MEANS. On a
 * canvas of eight steps, the second is what makes the map readable.
 */
function BranchQuestionEditor({
  action,
  onChange,
}: {
  action: Action;
  onChange: (condition: ConditionGroup, label?: string) => void;
}) {
  const arms = branchArms(action);
  const parsed = IfElseConfig.safeParse(action.config);
  const condition = parsed.success
    ? parsed.data.condition
    : { logic: 'AND' as const, conditions: [] };
  const label = parsed.success ? (parsed.data.label ?? '') : '';

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Call this branch</FieldLabel>
        <FieldControl>
          <Input
            value={label}
            placeholder="Did they book a call?"
            onChange={(e) => {
              onChange(condition, e.target.value);
            }}
          />
        </FieldControl>
        <FieldDescription>
          A short note so you can read the flow at a glance. Optional.
        </FieldDescription>
      </Field>

      <div className="flex flex-col gap-2">
        <Text>
          When the rule reaches this step it checks the following. If it all holds, it does the “If
          yes” steps ({arms.then.length}); otherwise it does the “If no” steps (
          {arms.otherwise.length}
          ), then carries on.
        </Text>
        <ConditionEditor
          value={condition}
          onChange={(next) => {
            onChange(next, label === '' ? undefined : label);
          }}
        />
        {condition.conditions.length === 0 ? (
          <Text>Nothing to check yet — as it stands this always takes the “If yes” side.</Text>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The goal — what the rule is trying to cause (docs/144 §9).
 *
 * Its own node rather than a field in Settings, because it is not a setting: it
 * is the thing that turns run history from "400 emails went out" into "62 of the
 * 400 people booked". Given the same weight on the canvas as the trigger and the
 * conditions, since it is the same kind of statement about the rule.
 */
function GoalPanel({ goal, onGoal }: InspectorProps) {
  const active = goal !== null;
  return (
    <Panel>
      <PanelHead
        icon={Target}
        title="What you’re aiming for"
        subtitle="Optional — how you’ll know it worked"
      />
      <Text>
        Describe what you want to happen because of this automation. When it happens for someone,
        sparx stops running the rest of the steps for them — there is no point nudging somebody who
        has already done it — and counts them as a success.
      </Text>

      {active ? (
        <>
          <ConditionEditor
            value={goal}
            onChange={(next) => {
              onGoal(next.conditions.length === 0 ? null : next);
            }}
          />
          <Text>
            Leave every line blank to go back to having no goal. Without one, this rule just runs to
            the end — which is right for something like a receipt.
          </Text>
        </>
      ) : (
        <button
          type="button"
          className="border-base-300 hover:border-module hover:text-module flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left"
          onClick={() => {
            onGoal({ logic: 'AND', conditions: [{ field: '', operator: 'eq', value: '' }] });
          }}
        >
          <Target className="size-4 shrink-0" aria-hidden />
          <span className="text-sm font-medium">Set what you’re aiming for</span>
        </button>
      )}
    </Panel>
  );
}
