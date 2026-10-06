'use client';

// The automation editor: create and edit are the SAME two-pane surface (flow canvas + inspector),
// because a rule is a durable thing you come back to. "Save" stages a draft, "Publish" makes it
// live; on/off and which business it runs for are deployment settings that apply immediately.

import { useToast } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { automationState } from './automations-presentation';
import { automationHealth } from './automation-health';
import type { Automation } from './automations-data';
import { actionHandlers } from './automation-editor/action-list';
import type { NewAutomationSeed } from './automation-editor/doc-fields';
import { EditorAlerts } from './automation-editor/editor-alerts';
import { EditorPanes, PaneSwitch } from './automation-editor/editor-panes';
import { EditorToolbar } from './automation-editor/editor-toolbar';
import { lifecycleHandlers } from './automation-editor/lifecycle-handlers';
import { useEditorState, type EditorState } from './automation-editor/use-editor-state';

export type { NewAutomationSeed } from './automation-editor/doc-fields';

export function AutomationEditor({
  ctx,
  automation,
  seed,
}: {
  ctx: SurfaceContext;
  /** Undefined = creating a new rule; present = editing that rule. */
  automation?: Automation;
  /** Only read when creating. What the screen that sent her here already knew. */
  seed?: NewAutomationSeed;
}) {
  const toast = useToast();
  const ed: EditorState = { ...useEditorState(ctx, automation, seed), toast };
  const h = { ...actionHandlers(ed), ...lifecycleHandlers(ed) };
  const { status, isNew, serverHasDraft, dirty } = ed;

  const state = automationState(status);
  // IS THIS RULE ACTUALLY WORKING? The editor badged a green "On" over eight failed runs out of
  // eight (issue 540's question, third caller). `status`, not `automation.status`, so pausing
  // settles the badge at once. [[feedback_a_fix_leaves_its_neighbour_behind]]
  const health = automation
    ? automationHealth(status, automation.runCount, automation.errorCount)
    : null;
  const showDiscard = !isNew && serverHasDraft && !dirty;

  return (
    <div className={PANE_SHELL}>
      <EditorToolbar ed={ed} h={h} state={state} health={health} showDiscard={showDiscard} />
      <EditorAlerts ed={ed} h={h} health={health} />
      <PaneSwitch ed={ed} />
      <EditorPanes ed={ed} h={h} />
    </div>
  );
}
