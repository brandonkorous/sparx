'use client';

// The Automation editor shell — a map + inspector working surface, sibling to the
// site/email Builder (docs/84 Slice G-UI v2 + G-versioning). Owns the whole rule
// document in state, the current selection, and the create/save/publish flow;
// composes the flow canvas (left, the "map") and the inspector OR the version
// history (right).
//
// Versioning (Builder-style draft → publish + immutable history): document edits
// STAGE in a draft via "Save", the live version keeps running until "Publish"
// promotes it. The toolbar carries a version pill (with an "unpublished changes"
// dot), Save / Publish, and a History toggle; the right pane swaps to the version
// list in history mode. Create builds the first version directly.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arrayMove } from '@dnd-kit/sortable';
import { History, Minus, Plus, Workflow } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { cn, toast, useConfirm } from '@sparx/ui';
import type { Action, AutomationStatus, ConditionGroup, Trigger } from '@sparx/automation-schemas';

import { actionDef, availableActions } from '../_lib/catalog';
import { SETTINGS_NODE, TRIGGER_NODE, type NodeId } from '../_lib/flow';
import { parseActions, parseConditions, parseTrigger } from '../_lib/presentation';
import type { AutomationDraftDto, AutomationVersionDto } from '../_lib/types';
import {
  createAutomationAction,
  discardDraftAction,
  listAutomationVersionsAction,
  publishAutomationAction,
  restoreAutomationVersionAction,
  updateAutomationAction,
} from '../actions';
import { FlowCanvas } from './flow-canvas';
import { HistoryPanel } from './history-panel';
import { Inspector } from './inspector';

const DEFAULT_TRIGGER: Trigger = { kind: 'event', eventType: '' };
const DEFAULT_CONDITIONS: ConditionGroup = { logic: 'AND', conditions: [] };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  error: 'Error',
};

// Stable per-action ids (dnd-kit + selection key off the ITEM, not the index, so a
// card's identity follows it across inserts/reorders). A monotonic counter never
// collides within one editor session.
let ACTION_UID = 0;
const newActionId = () => `act-${ACTION_UID++}`;

// Canvas zoom — persisted like the Builder's rail width; clamped to a sane band
// and snapped to 10% steps so the readout stays tidy.
const ZOOM_KEY = 'sparx:automation-zoom';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
function clampZoom(n: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n * 10) / 10));
}

/** Canonical serialization of the authoring document — drives dirty detection
 *  (current vs the last saved/loaded baseline). Normalizes name/description the
 *  same way the submit payload does, so a no-op edit never reads as dirty. */
function serializeDoc(
  name: string,
  description: string,
  trigger: Trigger,
  conditions: ConditionGroup,
  actions: Action[],
  maxDepth: number
): string {
  return JSON.stringify({
    name: name.trim(),
    description: description.trim() ? description.trim() : null,
    trigger,
    conditions,
    actions,
    maxDepth,
  });
}

export interface EditorInitial {
  id: string;
  name: string;
  description: string | null;
  status: AutomationStatus;
  /** Live published version (the editor loads the draft if one exists). */
  version: number;
  publishedAt: string | null;
  /** A staged draft exists server-side (Publish is enabled even when not dirty). */
  hasDraft: boolean;
  trigger: Trigger;
  conditions: ConditionGroup;
  actions: Action[];
  maxDepth: number;
}

interface Props {
  enabledModules: readonly string[];
  /** Present → edit mode; absent → create mode. */
  initial?: EditorInitial;
}

interface Validation {
  message: string;
  focus: NodeId;
}

export function AutomationEditor({ enabledModules, initial }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(initial?.name ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [trigger, setTrigger] = React.useState<Trigger>(initial?.trigger ?? DEFAULT_TRIGGER);
  const [conditions, setConditions] = React.useState<ConditionGroup>(
    initial?.conditions ?? DEFAULT_CONDITIONS
  );
  const [actions, setActions] = React.useState<Action[]>(initial?.actions ?? []);
  const [actionIds, setActionIds] = React.useState<string[]>(() =>
    (initial?.actions ?? []).map(() => newActionId())
  );
  const [maxDepth, setMaxDepth] = React.useState(initial?.maxDepth ?? 3);

  const [selectedId, setSelectedId] = React.useState<NodeId>(SETTINGS_NODE);
  const [mobilePane, setMobilePane] = React.useState<'flow' | 'edit'>('flow');

  // ── Versioning state ──
  const [version, setVersion] = React.useState(initial?.version ?? 1);
  const [serverHasDraft, setServerHasDraft] = React.useState(initial?.hasDraft ?? false);
  const [baseline, setBaseline] = React.useState(() =>
    serializeDoc(
      initial?.name ?? '',
      initial?.description ?? '',
      initial?.trigger ?? DEFAULT_TRIGGER,
      initial?.conditions ?? DEFAULT_CONDITIONS,
      initial?.actions ?? [],
      initial?.maxDepth ?? 3
    )
  );
  const [showHistory, setShowHistory] = React.useState(false);
  const [versions, setVersions] = React.useState<AutomationVersionDto[] | null>(null);
  const [versionsLoading, setVersionsLoading] = React.useState(false);
  const [versionsError, setVersionsError] = React.useState<string | null>(null);

  // Canvas zoom (read persisted value after mount so SSR + first paint use 1).
  const [zoom, setZoomState] = React.useState(1);
  const mapRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ZOOM_KEY);
      if (raw) {
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) setZoomState(clampZoom(n));
      }
    } catch {
      // storage disabled — keep 100%
    }
  }, []);
  const setZoom = React.useCallback((next: number | ((z: number) => number)) => {
    setZoomState((cur) => {
      const value = clampZoom(typeof next === 'function' ? next(cur) : next);
      try {
        window.localStorage.setItem(ZOOM_KEY, String(value));
      } catch {
        // ignore — in-memory state still updates
      }
      return value;
    });
  }, []);
  // ⌘/Ctrl + wheel zooms (a non-passive listener so we can preventDefault); a
  // plain wheel still scrolls the flow.
  React.useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => z + (e.deltaY < 0 ? 0.1 : -0.1));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  const editing = initial !== undefined;
  const status = initial?.status ?? 'draft';
  const cancelHref = editing ? `/automations/${initial.id}` : '/automations';

  const currentDoc = React.useMemo(
    () => serializeDoc(name, description, trigger, conditions, actions, maxDepth),
    [name, description, trigger, conditions, actions, maxDepth]
  );
  const dirty = editing && currentDoc !== baseline;
  const hasUnpublished = dirty || serverHasDraft;
  const canPublish = editing && hasUnpublished;

  // Selecting a node always reveals its properties — on mobile that means flipping
  // to the inspector pane (harmless on desktop, where both panes are visible). It
  // also leaves history mode so the inspector is what's shown.
  const selectNode = React.useCallback((id: NodeId) => {
    setSelectedId(id);
    setShowHistory(false);
    setMobilePane('edit');
  }, []);

  function insertAction(atIndex: number) {
    const first = availableActions(enabledModules)[0];
    const type: Action['type'] = first?.type ?? 'platform.stop';
    const id = newActionId();
    const action: Action = { type, config: first?.jsonTemplate ?? {} };
    const clamped = Math.min(Math.max(atIndex, 0), actions.length);
    setActions((prev) => {
      const next = [...prev];
      next.splice(clamped, 0, action);
      return next;
    });
    setActionIds((prev) => {
      const next = [...prev];
      next.splice(clamped, 0, id);
      return next;
    });
    selectNode(id);
  }

  function moveAction(from: number, to: number) {
    setActions((prev) => arrayMove(prev, from, to));
    setActionIds((prev) => arrayMove(prev, from, to));
  }

  function updateAction(id: string, next: Action) {
    const i = actionIds.indexOf(id);
    if (i < 0) return;
    setActions((prev) => prev.map((a, idx) => (idx === i ? next : a)));
  }

  function removeAction(id: string) {
    const i = actionIds.indexOf(id);
    if (i < 0) return;
    setActions((prev) => prev.filter((_, idx) => idx !== i));
    setActionIds((prev) => prev.filter((_, idx) => idx !== i));
    if (selectedId === id) {
      const fallback = actionIds[i - 1] ?? actionIds[i + 1] ?? TRIGGER_NODE;
      setSelectedId(fallback === id ? TRIGGER_NODE : fallback);
    }
  }

  function validate(): Validation | null {
    if (!name.trim()) return { message: 'Give the automation a name.', focus: SETTINGS_NODE };
    if (trigger.kind === 'event' && !trigger.eventType.trim()) {
      return { message: 'Choose a trigger event.', focus: TRIGGER_NODE };
    }
    if (trigger.kind === 'schedule') {
      if (trigger.schedule.cadence === 'once' && !trigger.schedule.at) {
        return { message: 'Pick a date and time for the one-time schedule.', focus: TRIGGER_NODE };
      }
      if (!trigger.predicate.entity) {
        return { message: 'Choose what the schedule scans.', focus: TRIGGER_NODE };
      }
    }
    if (actions.length === 0) {
      return { message: 'Add at least one action.', focus: TRIGGER_NODE };
    }
    for (const [i, a] of actions.entries()) {
      const def = actionDef(a.type);
      if (def?.mode === 'fields' && def.configFields) {
        const config = a.config ?? {};
        for (const f of def.configFields) {
          if (!f.required) continue;
          const v = config[f.key];
          const missing = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
          if (missing) {
            return {
              message: `Step ${i + 1} (${def.label}) needs “${f.label}”.`,
              focus: actionIds[i] ?? TRIGGER_NODE,
            };
          }
        }
      }
    }
    return null;
  }

  function payload() {
    return {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      trigger,
      conditions,
      actions,
      maxDepth,
    };
  }

  function checkValid(): boolean {
    const v = validate();
    if (v) {
      setError(v.message);
      selectNode(v.focus);
      return false;
    }
    setError(null);
    return true;
  }

  // Create mode — the first publish (version 1).
  function onCreate() {
    if (!checkValid()) return;
    startTransition(async () => {
      const result = await createAutomationAction(payload());
      if (result.ok) {
        router.push(`/automations/${result.data.id}`);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  // Edit mode — stage the document edits as a draft (the live version keeps running).
  function onSave() {
    if (!initial || !checkValid()) return;
    const snapshot = currentDoc;
    startTransition(async () => {
      const result = await updateAutomationAction(initial.id, payload());
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setBaseline(snapshot);
      setServerHasDraft(true);
      setVersions(null);
      toast.success('Draft saved.');
    });
  }

  // Edit mode — promote the draft (staging the current edits first) to the next
  // live version.
  function onPublish() {
    if (!initial || !checkValid()) return;
    const snapshot = currentDoc;
    const wasDirty = dirty;
    startTransition(async () => {
      if (wasDirty) {
        const staged = await updateAutomationAction(initial.id, payload());
        if (!staged.ok) {
          setError(staged.error.message);
          return;
        }
      }
      const result = await publishAutomationAction(initial.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setBaseline(snapshot);
      setServerHasDraft(false);
      setVersion(result.data.version);
      setVersions(null);
      toast.success(`Published v${result.data.version}.`);
    });
  }

  async function onDiscard() {
    if (!initial) return;
    const ok = await confirm({
      title: 'Discard unpublished changes?',
      description:
        'Your draft edits are removed and the live published version keeps running. This cannot be undone.',
      confirmLabel: 'Discard changes',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await discardDraftAction(initial.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      toast.success('Discarded unpublished changes.');
      // The live published document is the truth again — reload it on the detail.
      router.push(`/automations/${initial.id}`);
      router.refresh();
    });
  }

  function loadDoc(doc: AutomationDraftDto) {
    const trig = parseTrigger(doc.triggerType, doc.triggerConfig) ?? {
      kind: 'event',
      eventType: doc.triggerType,
    };
    const conds = parseConditions(doc.conditions);
    const acts = parseActions(doc.actions);
    setName(doc.name);
    setDescription(doc.description ?? '');
    setTrigger(trig);
    setConditions(conds);
    setActions(acts);
    setActionIds(acts.map(() => newActionId()));
    setMaxDepth(doc.maxDepth);
    setSelectedId(SETTINGS_NODE);
    setBaseline(serializeDoc(doc.name, doc.description ?? '', trig, conds, acts, doc.maxDepth));
  }

  async function onRestore(versionNo: number) {
    if (!initial) return;
    if (dirty) {
      const ok = await confirm({
        title: `Restore v${versionNo}?`,
        description:
          'This replaces your current unsaved edits with that version, staged as a new draft to review and publish.',
        confirmLabel: `Restore v${versionNo}`,
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await restoreAutomationVersionAction(initial.id, versionNo);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.draft) loadDoc(result.data.draft);
      setServerHasDraft(true);
      setVersions(null);
      setShowHistory(false);
      toast.success(`Restored v${versionNo} as a draft — review and publish.`);
    });
  }

  async function loadVersions() {
    if (!initial) return;
    setVersionsLoading(true);
    setVersionsError(null);
    const result = await listAutomationVersionsAction(initial.id);
    if (result.ok) setVersions(result.data);
    else setVersionsError(result.error.message);
    setVersionsLoading(false);
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      setMobilePane('edit');
      if (versions === null && !versionsLoading) void loadVersions();
    }
  }

  return (
    <div className="ax-shell">
      {/* Toolbar */}
      <div className="ax-toolbar">
        <div className="ax-toolbar__left">
          <span className="ax-toolbar__home">
            <Workflow aria-hidden />
          </span>
          <input
            className="ax-toolbar__name"
            value={name}
            placeholder="Name this automation"
            aria-label="Automation name"
            onChange={(e) => setName(e.target.value)}
          />
          <span className="ax-statuspill" data-status={status}>
            {STATUS_LABEL[status] ?? 'Draft'}
          </span>
          {editing && (
            <span
              className="ax-verpill"
              data-unpublished={hasUnpublished}
              title={hasUnpublished ? 'Unpublished changes' : `Published version ${version}`}
            >
              v{version}
              {hasUnpublished && <span className="ax-verpill__dot" aria-hidden />}
            </span>
          )}
        </div>
        <div className="ax-toolbar__right">
          {error && <span className="ax-toolbar__error">{error}</span>}
          {editing ? (
            <>
              <Button
                type="button"
                variant={showHistory ? 'soft' : 'ghost'}
                color="module"
                iconStart={<History className="h-4 w-4" />}
                onClick={toggleHistory}
              >
                History
              </Button>
              <Button variant="ghost" render={<Link href={cancelHref} />}>
                Close
              </Button>
              <Button
                type="button"
                variant="soft"
                color="module"
                disabled={!dirty || pending}
                onClick={onSave}
              >
                Save draft
              </Button>
              <Button
                type="button"
                color="module"
                loading={pending}
                disabled={!canPublish || pending}
                onClick={onPublish}
              >
                Publish
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" render={<Link href={cancelHref} />}>
                Cancel
              </Button>
              <Button color="module" loading={pending} disabled={pending} onClick={onCreate}>
                Create automation
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile pane switch */}
      <div className="ax-paneswitch">
        {(['flow', 'edit'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className="ax-paneswitch__btn"
            data-on={mobilePane === p}
            onClick={() => setMobilePane(p)}
          >
            {p === 'flow' ? 'Flow' : showHistory ? 'History' : 'Properties'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="ax-body">
        <div
          ref={mapRef}
          className={cn('ax-map', mobilePane === 'flow' ? 'ax-pane--show' : 'ax-pane--hide')}
        >
          <FlowCanvas
            name={name}
            status={status}
            maxDepth={maxDepth}
            trigger={trigger}
            conditions={conditions}
            actions={actions}
            actionIds={actionIds}
            selectedId={selectedId}
            zoom={zoom}
            onSelect={selectNode}
            onInsertAction={insertAction}
            onMoveAction={moveAction}
          />
          <div className="ax-zoom">
            <button
              type="button"
              className="ax-zoom__btn"
              onClick={() => setZoom((z) => z - 0.1)}
              aria-label="Zoom out"
            >
              <Minus aria-hidden />
            </button>
            <button
              type="button"
              className="ax-zoom__val"
              onClick={() => setZoom(1)}
              title="Reset to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="ax-zoom__btn"
              onClick={() => setZoom((z) => z + 0.1)}
              aria-label="Zoom in"
            >
              <Plus aria-hidden />
            </button>
          </div>
        </div>

        <aside className={cn('ax-side', mobilePane === 'edit' ? 'ax-pane--show' : 'ax-pane--hide')}>
          <div className="ax-side__bar">
            <span className="ax-side__bar-title">
              {showHistory ? 'Version history' : 'Properties'}
            </span>
            {showHistory && (
              <button
                type="button"
                className="ax-side__close"
                onClick={() => setShowHistory(false)}
              >
                Done
              </button>
            )}
          </div>
          <div className="ax-side__scroll">
            {showHistory ? (
              <HistoryPanel
                versions={versions}
                loading={versionsLoading}
                error={versionsError}
                currentVersion={version}
                hasUnpublished={hasUnpublished}
                pending={pending}
                onRestore={onRestore}
                onDiscard={onDiscard}
              />
            ) : (
              <Inspector
                selectedId={selectedId}
                enabledModules={enabledModules}
                name={name}
                onName={setName}
                description={description}
                onDescription={setDescription}
                maxDepth={maxDepth}
                onMaxDepth={setMaxDepth}
                trigger={trigger}
                onTrigger={setTrigger}
                conditions={conditions}
                onConditions={setConditions}
                actions={actions}
                actionIds={actionIds}
                onAction={updateAction}
                onRemoveAction={removeAction}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
