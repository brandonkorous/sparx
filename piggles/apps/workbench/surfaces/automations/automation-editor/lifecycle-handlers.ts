import { afterPaneChange } from '../../../lib/defer';
import type { actionHandlers } from './action-list';
import { SETTINGS_NODE } from '../automations-presentation';
import { automationErrorMessage, type Automation } from '../automations-data';
import { docFieldsFrom, newActionId, serializeDoc, type DocFields } from './doc-fields';
import { onCreate, onPublish, onSave } from './save-handlers';
import type { EditorState } from './use-editor-state';

// Replace the whole document (after discard → live, or restore → draft).
function loadFields(ed: EditorState, f: DocFields) {
  const { setName, setDescription, setTrigger, setConditions, setActions, setActionIds } = ed;
  const { setGoal, setMaxDepth, setSelectedId, setBaseline, setError } = ed;
  setName(f.name);
  setDescription(f.description);
  setTrigger(f.trigger);
  setConditions(f.conditions);
  setActions(f.actions);
  setActionIds(f.actions.map(() => newActionId()));
  setGoal(f.goal);
  setMaxDepth(f.maxDepth);
  setSelectedId(SETTINGS_NODE);
  setBaseline(serializeDoc(f));
  setError(null);
}

async function onDiscard(ed: EditorState) {
  const { automation, confirm, discard, setServerHasDraft, toast } = ed;
  if (!automation) return;
  const ok = await confirm({
    title: 'Discard your unpublished changes?',
    description:
      'This throws away the draft and keeps the live version exactly as it is running now. This cannot be undone.',
    confirmLabel: 'Discard the draft',
    cancelLabel: 'Keep editing',
    color: 'danger',
  });
  if (!ok) return;
  discard.mutate(undefined, {
    onSuccess: (live) => {
      loadFields(ed, docFieldsFrom(live, 'live'));
      setServerHasDraft(false);
      toast.add({ title: 'Draft discarded', type: 'success' });
    },
    onError: (e) => {
      toast.add({
        title: 'Could not discard the draft',
        description: automationErrorMessage(e, 'Nothing was changed.'),
        type: 'error',
      });
    },
  });
}

function onToggleStatus(ed: EditorState) {
  const { automation, status, setStatusMut, setStatus, toast, name } = ed;
  if (!automation) return;
  const next = status === 'active' ? 'paused' : 'active';
  setStatusMut.mutate(next, {
    onSuccess: () => {
      setStatus(next);
      toast.add({
        title: next === 'active' ? `${name} is on` : `${name} paused`,
        description:
          next === 'active'
            ? 'It will act every time its trigger happens.'
            : 'It keeps its setup and can be turned back on.',
        type: 'success',
      });
    },
    onError: (e) => {
      toast.add({
        title: 'Could not change whether it is on',
        description: automationErrorMessage(e, 'Nothing was changed.'),
        type: 'error',
      });
    },
  });
}

function onSiteScope(ed: EditorState, next: string | null) {
  const { scopeSet, setSiteScope, automation, scope, toast } = ed;
  scopeSet.current = true;
  setSiteScope(next);
  if (!automation) return; // create → applied at create time
  scope.mutate(
    { propertyId: next },
    {
      onError: (e) => {
        toast.add({
          title: 'Could not change which business this runs for',
          description: automationErrorMessage(e, 'Nothing was changed.'),
          type: 'error',
        });
      },
    }
  );
}

async function onDelete(ed: EditorState) {
  const { automation, confirm, name, remove, ctx, toast } = ed;
  if (!automation) return;
  const ok = await confirm({
    title: `Delete ${name}?`,
    description:
      'This permanently removes the automation and its version history. Its past run records are kept. This cannot be undone.',
    confirmLabel: 'Delete it',
    cancelLabel: 'Keep it',
    color: 'danger',
  });
  if (!ok) return;
  remove.mutate(undefined, {
    onSuccess: () => {
      ctx.close();
      afterPaneChange(() => {
        toast.add({ title: `${name} deleted`, type: 'success' });
      });
    },
    onError: (e) => {
      toast.add({
        title: 'Could not delete this automation',
        description: automationErrorMessage(e, 'Nothing was changed.'),
        type: 'error',
      });
    },
  });
}

function onRestored(ed: EditorState, restored: Automation) {
  const { setServerHasDraft, setShowHistory } = ed;
  loadFields(ed, docFieldsFrom(restored, 'draft'));
  setServerHasDraft(true);
  setShowHistory(false);
}

// Our newer version is now the live one: load it, at its new version.
function onPlatformTaken(ed: EditorState, taken: Automation) {
  const { setServerHasDraft, setVersion, setStatus } = ed;
  loadFields(ed, docFieldsFrom(taken, 'live'));
  setServerHasDraft(false);
  setVersion(taken.version);
  setStatus(taken.status);
}

/** The toolbar and pane callbacks, bound to this render's state. */
export function lifecycleHandlers(ed: EditorState) {
  return {
    onCreate: () => {
      onCreate(ed);
    },
    onSave: () => {
      onSave(ed);
    },
    onPublish: () => onPublish(ed),
    onDiscard: () => onDiscard(ed),
    onToggleStatus: () => {
      onToggleStatus(ed);
    },
    onSiteScope: (next: string | null) => {
      onSiteScope(ed, next);
    },
    onDelete: () => onDelete(ed),
    onRestored: (restored: Automation) => {
      onRestored(ed, restored);
    },
    onPlatformTaken: (taken: Automation) => {
      onPlatformTaken(ed, taken);
    },
  };
}

export type EditorHandlers = ReturnType<typeof actionHandlers> &
  ReturnType<typeof lifecycleHandlers>;
