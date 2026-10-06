import { SETTINGS_NODE, TRIGGER_NODE, type NodeId } from '../automations-presentation';
import { actionDef } from '../automations-catalog';
import type { EditorState } from './use-editor-state';

interface Validation {
  message: string;
  focus: NodeId;
}

// ── Validation ──
function validate(ed: EditorState): Validation | null {
  const { name, trigger, actions, actionIds } = ed;
  if (!name.trim()) return { message: 'Give this automation a name.', focus: SETTINGS_NODE };
  if (trigger.kind === 'event' && !trigger.eventType.trim()) {
    return { message: 'Choose what starts this automation.', focus: TRIGGER_NODE };
  }
  if (trigger.kind === 'schedule' && trigger.schedule.cadence === 'once' && !trigger.schedule.at) {
    return { message: 'Set the date and time this should run.', focus: TRIGGER_NODE };
  }
  if (actions.length === 0) {
    return { message: 'Add at least one step for this rule to do.', focus: TRIGGER_NODE };
  }
  for (const [i, a] of actions.entries()) {
    const def = actionDef(a.type);
    if (def?.mode === 'fields' && def.configFields) {
      const config = a.config;
      for (const f of def.configFields) {
        if (!f.required) continue;
        const v = config[f.key];
        const missing = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
        if (missing) {
          return {
            message: `Step ${String(i + 1)} (${def.label}) needs “${f.label}”.`,
            focus: actionIds[i] ?? TRIGGER_NODE,
          };
        }
      }
    }
  }
  return null;
}

export function checkValid(ed: EditorState): boolean {
  const { setSubmitted, setError, selectNode } = ed;
  setSubmitted(true);
  const v = validate(ed);
  if (v) {
    setError(v.message);
    selectNode(v.focus);
    return false;
  }
  setError(null);
  return true;
}

export function docPayload(ed: EditorState) {
  const { name, description, trigger, conditions, actions, goal, maxDepth } = ed;
  return {
    name: name.trim(),
    description: description.trim() ? description.trim() : null,
    trigger,
    conditions,
    actions,
    goal,
    maxDepth,
  };
}
