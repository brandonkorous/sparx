'use client';

// The flow canvas — the LEFT pane and the "map" of the editor. It renders the
// rule as a vertical pipeline on a connecting spine: a Settings node, the Trigger
// ("When"), the Conditions ("Only if"), then each Action ("Then …") in order,
// with an end "add step". Clicking any node selects it (the inspector edits it);
// the Action steps drag to reorder.
//
// Drag-and-drop (the headline interaction):
//   • The WHOLE action card is the drag surface (no handle) — a pointer sensor
//     with a 6px activation distance tells a click (select) apart from a drag.
//   • The lifted card rides in a DragOverlay (a portal, so it's never clipped by
//     the scroll container) while its slot holds a dashed placeholder, and the
//     other steps animate to open the gap. dnd-kit auto-scrolls the canvas when
//     you drag near an edge.
//   • Keyboard: focus a card, Space to pick up, ↑/↓ to move, Space to drop,
//     Escape to cancel; Enter selects (the keyboard sensor is scoped to Space so
//     Enter stays free for selection).
//   • The 1·2·3 markers renumber live from the array index.
// Insert-anywhere: a small "+" sits on the spine in the GAP before each action
// (always visible — insert at that position), and the end button appends — so a
// step can be inserted anywhere, not just the end. The inserts fade out while a
// reorder is in flight so they don't sit static while the cards animate.
//
// `zoom` scales the flow visual only (the inspector/toolbar stay crisp); the
// control that drives it lives in the shell. At zoom 1 (the default) the DnD math
// is identity; the shell adds the scale-correction when zoom ≠ 1.

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import { cn } from '@sparx/ui';
import type { Action, ConditionGroup, Trigger } from '@sparx/automation-schemas';

import {
  CONDITIONS_NODE,
  SETTINGS_NODE,
  TRIGGER_NODE,
  actionDetail,
  actionHeadline,
  conditionChips,
  conditionsHeadline,
  conditionsOverflow,
  isCuratedTriggerEvent,
  triggerDetail,
  triggerHeadline,
  triggerIcon,
  type NodeId,
} from '../_lib/flow';
import { NodeIcon } from './node-icons';

// Lock dragging to the vertical axis — the spine is a single column, so sideways
// drift would only ever be noise. Inline so we don't add @dnd-kit/modifiers.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  error: 'Error',
};

/** onKeyDown that fires `select` on Enter/Space for the non-draggable nodes. */
function keySelect(select: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select();
    }
  };
}

// ─── settings (peer node atop the spine) ──────────────────────────────────────

function SettingsRow({
  name,
  status,
  maxDepth,
  selected,
  onSelect,
}: {
  name: string;
  status: string;
  maxDepth: number;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  return (
    <button
      type="button"
      className={cn('ax-settings', selected && 'ax-settings--on')}
      onClick={() => onSelect(SETTINGS_NODE)}
    >
      <span className="ax-settings__icon">
        <NodeIcon iconKey="settings" />
      </span>
      <span className="ax-settings__titles">
        <span className="ax-settings__t">{name.trim() || 'Untitled automation'}</span>
        <span className="ax-settings__s">
          {STATUS_LABEL[status] ?? 'Draft'} · loop-guard depth {maxDepth}
        </span>
      </span>
    </button>
  );
}

// ─── fixed nodes (trigger + conditions; not draggable) ────────────────────────

function TriggerStep({
  trigger,
  selected,
  onSelect,
}: {
  trigger: Trigger;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  const detail = triggerDetail(trigger);
  return (
    <div className="ax-step ax-step--trigger ax-step--first">
      <div className="ax-rail">
        <div className="ax-marker">
          <NodeIcon iconKey={triggerIcon(trigger)} />
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Trigger: ${triggerHeadline(trigger)}`}
        className={cn('ax-node', selected && 'ax-node--on')}
        onClick={() => onSelect(TRIGGER_NODE)}
        onKeyDown={keySelect(() => onSelect(TRIGGER_NODE))}
      >
        <span className="ax-node__body">
          <span className="ax-node__title">{triggerHeadline(trigger)}</span>
          <span className="ax-node__detail">
            {isCuratedTriggerEvent(trigger) ? <code>{detail}</code> : detail}
          </span>
        </span>
      </div>
    </div>
  );
}

function ConditionsStep({
  group,
  selected,
  onSelect,
}: {
  group: ConditionGroup;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  const empty = group.conditions.length === 0;
  const chips = conditionChips(group);
  const overflow = conditionsOverflow(group);
  return (
    <div className="ax-step ax-step--cond">
      <div className="ax-rail">
        <div className="ax-marker">
          <NodeIcon iconKey="filter" />
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Conditions"
        className={cn('ax-node', selected && 'ax-node--on')}
        onClick={() => onSelect(CONDITIONS_NODE)}
        onKeyDown={keySelect(() => onSelect(CONDITIONS_NODE))}
      >
        <span className="ax-node__body">
          <span className="ax-node__title">{conditionsHeadline(group)}</span>
          {empty ? (
            <span className="ax-node__detail">Runs on every trigger</span>
          ) : (
            <span className="ax-node__cond">
              {chips.map((c, i) => (
                <span key={i} className="ax-cond">
                  {c}
                </span>
              ))}
              {overflow > 0 && <span className="ax-cond__join">+{overflow} more</span>}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// ─── action step (sortable) ───────────────────────────────────────────────────

function ActionStep({
  id,
  action,
  index,
  selected,
  zoom,
  onSelect,
}: {
  id: string;
  action: Action;
  index: number;
  selected: boolean;
  zoom: number;
  onSelect: (id: NodeId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  // Pull the keyboard handler out of the drag listeners so we can compose it with
  // our own Enter-to-select (the listeners' onKeyDown only reacts to Space now).
  const { onKeyDown: dndKeyDown, ...dragListeners } = listeners ?? {};

  // The drag source holds a placeholder (its content rides in the overlay), so it
  // must NOT also carry the sortable transform — only the OTHER cards animate.
  // Under canvas zoom the make-room translate is measured in SCALED px and then
  // re-scaled by the zoom wrapper, so divide it back out to keep the gap exact
  // (the spine is one column, so x is pinned to 0 regardless).
  const corrected =
    transform && zoom !== 1 ? { ...transform, x: 0, y: transform.y / zoom } : transform;
  const style: React.CSSProperties | undefined = isDragging
    ? undefined
    : { transform: CSS.Transform.toString(corrected), transition };

  function handleKeyDown(e: React.KeyboardEvent) {
    dndKeyDown?.(e);
    if (e.key === 'Enter') {
      e.preventDefault();
      onSelect(id);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('ax-step ax-step--action ax-step--draggable', isDragging && 'ax-step--ghost')}
    >
      <div className="ax-rail">
        <div className="ax-marker">{index + 1}</div>
      </div>
      <div
        {...attributes}
        {...dragListeners}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => onSelect(id)}
        aria-label={`Step ${index + 1}: ${actionHeadline(action)}`}
        className={cn('ax-node', selected && 'ax-node--on')}
      >
        <span className="ax-node__body">
          <span className="ax-node__title">{actionHeadline(action)}</span>
          <span className="ax-node__detail">
            <code>{actionDetail(action)}</code>
          </span>
        </span>
        <span className="ax-node__grip" aria-hidden>
          <GripVertical />
        </span>
      </div>
    </div>
  );
}

/** The lifted card shown in the DragOverlay — just the card, picked up off the
 *  surface (the numbered slot stays behind as the placeholder). */
function DragCard({ action }: { action: Action }) {
  return (
    <div className="ax-dragcard">
      <span className="ax-node__body">
        <span className="ax-node__title">{actionHeadline(action)}</span>
        <span className="ax-node__detail">
          <code>{actionDetail(action)}</code>
        </span>
      </span>
      <span className="ax-node__grip" aria-hidden>
        <GripVertical />
      </span>
    </div>
  );
}

/** An always-visible "+" sitting on the spine in the GAP before an action,
 *  inserting a step at `atIndex`. The connecting line runs through the rail; the
 *  button's surface fill breaks it like a node. */
function InsertRow({
  atIndex,
  onInsert,
}: {
  atIndex: number;
  onInsert: (atIndex: number) => void;
}) {
  return (
    <div className="ax-ins">
      <button
        type="button"
        className="ax-ins__btn"
        onClick={() => onInsert(atIndex)}
        aria-label={
          atIndex === 0 ? 'Insert a step at the start' : `Insert a step before step ${atIndex + 1}`
        }
      >
        <Plus aria-hidden />
      </button>
    </div>
  );
}

function AddStepRow({ onClick, hasActions }: { onClick: () => void; hasActions: boolean }) {
  return (
    <div className="ax-step ax-step--last ax-step--add">
      <div className="ax-rail">
        <div className="ax-marker ax-marker--add">
          <Plus aria-hidden />
        </div>
      </div>
      <button type="button" className="ax-addstep__btn" onClick={onClick}>
        {hasActions ? 'Add a step — an action or a wait' : 'Add the first action'}
      </button>
    </div>
  );
}

// ─── canvas ────────────────────────────────────────────────────────────────────

export interface FlowCanvasProps {
  name: string;
  status: string;
  maxDepth: number;
  trigger: Trigger;
  conditions: ConditionGroup;
  actions: Action[];
  /** Stable ids parallel to `actions` (owned by the shell), for dnd-kit + React keys. */
  actionIds: string[];
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  /** Insert a fresh action at `atIndex` (0..actions.length); shell selects it. */
  onInsertAction: (atIndex: number) => void;
  onMoveAction: (fromIndex: number, toIndex: number) => void;
  /** Canvas zoom (1 = 100%); scales the flow visual. */
  zoom?: number;
}

export function FlowCanvas({
  name,
  status,
  maxDepth,
  trigger,
  conditions,
  actions,
  actionIds,
  selectedId,
  onSelect,
  onInsertAction,
  onMoveAction,
  zoom = 1,
}: FlowCanvasProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const dndId = React.useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  const activeIndex = activeId ? actionIds.indexOf(activeId) : -1;
  const activeAction = activeIndex >= 0 ? actions[activeIndex] : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleDragCancel() {
    setActiveId(null);
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = actionIds.indexOf(String(active.id));
    const to = actionIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onMoveAction(from, to);
  }

  return (
    <div className="ax-map__scroll">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        {/* The scaled flow. The DragOverlay lives OUTSIDE this wrapper so the
            lifted card isn't double-transformed by the zoom. */}
        <div className="ax-zoomwrap" style={{ '--ax-zoom': zoom } as React.CSSProperties}>
          <div className="ax-flow" data-dragging={activeId !== null}>
            <p className="ax-flow__hint">
              Click a step to edit it on the right. Drag a “Then” step to reorder.
            </p>

            <SettingsRow
              name={name}
              status={status}
              maxDepth={maxDepth}
              selected={selectedId === SETTINGS_NODE}
              onSelect={onSelect}
            />

            <TriggerStep
              trigger={trigger}
              selected={selectedId === TRIGGER_NODE}
              onSelect={onSelect}
            />
            <ConditionsStep
              group={conditions}
              selected={selectedId === CONDITIONS_NODE}
              onSelect={onSelect}
            />

            <SortableContext items={actionIds} strategy={verticalListSortingStrategy}>
              {actions.map((a, i) => (
                <React.Fragment key={actionIds[i] ?? i}>
                  <InsertRow atIndex={i} onInsert={onInsertAction} />
                  <ActionStep
                    id={actionIds[i] ?? `fallback-${i}`}
                    action={a}
                    index={i}
                    zoom={zoom}
                    selected={selectedId === actionIds[i]}
                    onSelect={onSelect}
                  />
                </React.Fragment>
              ))}
            </SortableContext>

            <AddStepRow
              onClick={() => onInsertAction(actions.length)}
              hasActions={actions.length > 0}
            />
          </div>
        </div>

        <DragOverlay>
          {activeAction ? (
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <DragCard action={activeAction} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
