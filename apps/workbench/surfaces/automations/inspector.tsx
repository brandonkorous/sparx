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
import { Filter, type LucideIcon } from 'lucide-react';
import type { Action, ConditionGroup, Trigger } from '@sparx/automation-schemas';
import type { SiteInfo } from '../../lib/api/shell-data';
import { actionDef, moduleForActionType, moduleLabel } from './automations-catalog';
import {
  CONDITIONS_NODE,
  NODE_ICONS,
  SETTINGS_NODE,
  TRIGGER_NODE,
  actionHeadline,
  actionIcon,
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
}

export function Inspector(props: InspectorProps) {
  const { selectedId } = props;
  if (selectedId === TRIGGER_NODE) return <TriggerPanel {...props} />;
  if (selectedId === CONDITIONS_NODE) return <ConditionsPanel {...props} />;
  if (selectedId && selectedId !== SETTINGS_NODE) {
    const idx = props.actionIds.indexOf(selectedId);
    if (idx >= 0) return <ActionPanel {...props} selectedId={selectedId} index={idx} />;
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
}: InspectorProps & { selectedId: string; index: number }) {
  const action = actions[index];
  if (!action) return <Panel />;

  const def = actionDef(action.type);
  const Glyph = NODE_ICONS[actionIcon(action)];
  const module = def?.module ?? moduleForActionType(action.type);
  const title = def?.label ?? actionHeadline(action);
  const subtitle = `${moduleLabel(module)} · step ${String(index + 1)} of ${String(actions.length)}`;

  return (
    <Panel>
      <PanelHead icon={Glyph} title={title} subtitle={subtitle} />
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
