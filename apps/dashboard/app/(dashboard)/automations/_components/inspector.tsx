'use client';

// The inspector — the RIGHT pane. It edits whichever node is selected in the flow
// canvas, switching on the selection id:
//   • 'settings'   → name, description, loop-guard depth
//   • 'trigger'    → the TriggerEditor (event vs schedule)
//   • 'conditions' → the ConditionEditor (the nested AND/OR filter)
//   • an action id → the ActionConfigEditor (type + config) + remove
// Each view is a PanelHead (the node's identity) over a stack of property cards,
// mirroring the Builder's inspector. The field-level editors (TriggerEditor /
// ConditionEditor) are reused verbatim, just hosted inside a card here.

import { Filter, Settings2, Shield, Workflow } from 'lucide-react';
import { Input, Textarea } from 'silicaui-react';
import type { Action, ConditionGroup, Trigger } from '@sparx/automation-schemas';

import { actionDef, moduleForActionType, moduleLabel } from '../_lib/catalog';
import {
  CONDITIONS_NODE,
  SETTINGS_NODE,
  TRIGGER_NODE,
  actionHeadline,
  actionIcon,
  conditionsHeadline,
  triggerHeadline,
  triggerIcon,
  type NodeId,
} from '../_lib/flow';
import { NODE_ICONS } from './node-icons';
import { Field, InspectorCard, PanelHead } from './inspector-primitives';
import { ActionConfigEditor } from './action-config-editor';
import { ConditionEditor } from './condition-editor';
import { TriggerEditor } from './trigger-editor';

export interface InspectorProps {
  selectedId: NodeId | null;
  enabledModules: readonly string[];
  name: string;
  onName: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
  maxDepth: number;
  onMaxDepth: (n: number) => void;
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

function SettingsPanel({
  name,
  onName,
  description,
  onDescription,
  maxDepth,
  onMaxDepth,
}: InspectorProps) {
  return (
    <>
      <PanelHead icon={Settings2} title="Settings" subtitle="Name, description & safeguards" />
      <div className="ax-ins-stack">
        <InspectorCard icon={Workflow} title="Details" summary={name.trim() || 'Untitled'}>
          <Field label="Name" required htmlFor="ax-name">
            <Input
              id="ax-name"
              value={name}
              placeholder="Fleet re-engagement"
              onChange={(e) => onName(e.target.value)}
            />
          </Field>
          <Field label="Description" htmlFor="ax-desc">
            <Textarea
              id="ax-desc"
              rows={3}
              value={description}
              placeholder="What this automation does and when."
              onChange={(e) => onDescription(e.target.value)}
            />
          </Field>
        </InspectorCard>

        <InspectorCard
          icon={Shield}
          title="Advanced"
          summary={`Loop-guard depth ${maxDepth}`}
          defaultOpen={false}
          muted
        >
          <Field
            label="Loop-guard depth"
            htmlFor="ax-maxdepth"
            hint="How deep a rule → event → rule cascade may go before the engine stops it."
          >
            <Input
              id="ax-maxdepth"
              type="number"
              min={1}
              max={10}
              value={maxDepth}
              onChange={(e) => onMaxDepth(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="w-24"
            />
          </Field>
        </InspectorCard>
      </div>
    </>
  );
}

function TriggerPanel({ trigger, onTrigger, enabledModules }: InspectorProps) {
  const Glyph = NODE_ICONS[triggerIcon(trigger)];
  return (
    <>
      <PanelHead icon={Glyph} title="Trigger" subtitle="What starts this automation" />
      <div className="ax-ins-stack">
        <InspectorCard icon={Glyph} title="When" summary={triggerHeadline(trigger)}>
          <TriggerEditor value={trigger} onChange={onTrigger} enabledModules={enabledModules} />
        </InspectorCard>
      </div>
    </>
  );
}

function ConditionsPanel({ conditions, onConditions }: InspectorProps) {
  return (
    <>
      <PanelHead icon={Filter} title="Conditions" subtitle="Run only if these match (optional)" />
      <div className="ax-ins-stack">
        <InspectorCard icon={Filter} title="Filter" summary={conditionsHeadline(conditions)}>
          <ConditionEditor value={conditions} onChange={onConditions} />
        </InspectorCard>
      </div>
    </>
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
  if (!action) return <SettingsPanelFallback />;

  const def = actionDef(action.type);
  const Glyph = NODE_ICONS[actionIcon(action)];
  const module = def?.module ?? moduleForActionType(action.type);
  const title = def?.label ?? actionHeadline(action);
  const subtitle = `${moduleLabel(module)} action · step ${index + 1} of ${actions.length}`;

  return (
    <>
      <PanelHead icon={Glyph} title={title} subtitle={subtitle} />
      <div className="ax-ins-stack">
        <ActionConfigEditor
          action={action}
          actionId={selectedId}
          enabledModules={enabledModules}
          onChange={(next) => onAction(selectedId, next)}
          onRemove={() => onRemoveAction(selectedId)}
        />
      </div>
    </>
  );
}

/** A stale action id (selection out of range mid-render) — degrade to an empty
 *  stack rather than throwing; the shell re-points selection on the next tick. */
function SettingsPanelFallback() {
  return <div className="ax-ins-stack" />;
}
