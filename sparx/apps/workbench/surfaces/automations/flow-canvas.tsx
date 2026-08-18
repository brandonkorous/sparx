'use client';

// The flow canvas — the LEFT pane and the readable "map" of the editor. It draws
// the rule as a vertical pipeline on a connecting spine: a Settings node, the
// Trigger ("When"), the Conditions ("Only if"), then each Action ("Then …") in
// order, with an end "add step". Clicking any node selects it (the inspector on
// the right edits it); the Action steps drag to reorder.
//
// Drag-and-drop (the headline interaction):
//   • The WHOLE action card is the drag surface (no handle) — a PointerSensor with
//     a 6px activation distance tells a click (select) apart from a drag.
//   • The lifted card rides in a DragOverlay (a portal, so the scroll container
//     never clips it) while its slot holds a placeholder; the other steps animate
//     to open the gap.
//   • Keyboard: focus a card, Space to pick up, ↑/↓ to move, Space to drop, Escape
//     to cancel; Enter selects (the keyboard sensor is scoped to Space so Enter
//     stays free for selection).
//   • The 1·2·3 markers renumber live from the array index.
// Insert-anywhere: a "+" sits on the spine in the gap before each action, and the
// end button appends — so a step can be inserted anywhere, not just the end.
//
// Everything is silica primitives + Tailwind utilities + tokens. The one inline
// style is dnd-kit's functional transform on the sortable node (inherent to the
// library, and the drag Brandon approved) — there is no other inline style.

import { Fragment, useId, useState, type KeyboardEvent } from 'react';
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
import { GripVertical, Plus, Target } from 'lucide-react';
import { Badge } from '@wizeworks/silicaui-react';
import type { Action, ConditionGroup, Trigger } from '@wizeworks/automation-schemas';
import {
  CONDITIONS_NODE,
  GOAL_NODE,
  NODE_ICONS,
  SETTINGS_NODE,
  TRIGGER_NODE,
  actionDetail,
  actionHeadline,
  actionIcon,
  automationState,
  branchArms,
  branchCounts,
  conditionChips,
  conditionsHeadline,
  conditionsOverflow,
  isCuratedTriggerEvent,
  triggerDetail,
  triggerHeadline,
  triggerIcon,
  type NodeId,
} from './automations-presentation';
import { nestedNodeId } from './branch-tree';

// Lock dragging to the vertical axis — the spine is a single column, so sideways
// drift would only ever be noise. Inline so we don't add @dnd-kit/modifiers.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

type MarkerTone = 'neutral' | 'module' | 'warning';

/** The marker on the spine — a numbered step or an icon in a rounded tile. The
 *  trigger and conditions markers carry their own resting hue (module / warning),
 *  like the dashboard; any marker gains the module ring when its node is selected. */
function Marker({
  selected,
  tone = 'neutral',
  children,
}: {
  selected: boolean;
  tone?: MarkerTone;
  children: React.ReactNode;
}) {
  const resting =
    tone === 'module'
      ? 'border-module/30 bg-module/10 text-module'
      : tone === 'warning'
        ? 'border-warning/40 bg-warning/10 text-warning'
        : 'border-base-300 bg-base-100';
  return (
    <div
      className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold ${resting} ${
        selected ? 'border-module text-module' : ''
      }`}
    >
      {children}
    </div>
  );
}

/** The card body — headline + detail. Shared by the fixed nodes, action steps,
 *  and the drag overlay so they read identically. */
function NodeBody({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-base font-semibold">{title}</span>
      {children}
    </span>
  );
}

function nodeCardClass(selected: boolean): string {
  // Selection uses silica's own field ring — a 2px solid outline at a 2px offset
  // in the module hue, identical to what `<Input color="module">` shows on focus
  // (a real outline, not a box-shadow ring), so a selected node and a focused
  // field read as the same system.
  return `bg-base-100 flex w-full items-center gap-3 rounded-lg border border-base-300 px-3 py-2.5 text-left ${
    selected
      ? 'outline-2 outline-offset-2 outline-[color:var(--color-module)]'
      : 'hover:border-base-content/20'
  }`;
}

/** onKeyDown firing `select` on Enter/Space for the non-draggable nodes. */
function keySelect(select: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select();
    }
  };
}

type RailPos = 'first' | 'middle' | 'last';

/** One row on the spine: a marker in the rail column + the node body. The rail
 *  column draws its OWN segment of the connecting line, so the line trims to the
 *  first and last marker centers (22px = pt-1.5 + half of the size-8 marker) and
 *  extends into the flex gap (-8px = gap-2) to meet the neighbouring row — no
 *  stub above the first marker or below the last. The opaque marker paints over
 *  the segment, breaking it like a bead on a string. */
function StepRow({
  marker,
  children,
  rail = 'middle',
}: {
  marker: React.ReactNode;
  children: React.ReactNode;
  rail?: RailPos;
}) {
  const segment =
    rail === 'first'
      ? 'top-[22px] -bottom-2'
      : rail === 'last'
        ? '-top-2 bottom-[calc(100%-22px)]'
        : '-top-2 -bottom-2';
  return (
    <div className="flex items-stretch gap-3">
      <div className="relative flex w-8 shrink-0 justify-center pt-1.5">
        <span
          className={`bg-base-300 pointer-events-none absolute left-1/2 w-px -translate-x-1/2 ${segment}`}
        />
        {marker}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ── Settings node ─────────────────────────────────────────────────────────── */

function SettingsNode({
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
  const Glyph = NODE_ICONS.settings;
  const state = automationState(status as never);
  return (
    <StepRow
      rail="first"
      marker={
        <Marker selected={selected}>
          <Glyph className="size-4" aria-hidden />
        </Marker>
      }
    >
      <button
        type="button"
        className={nodeCardClass(selected)}
        onClick={() => onSelect(SETTINGS_NODE)}
      >
        <NodeBody title={name.trim() || 'Untitled automation'}>
          <span className="text-sm">
            {state.label} · loop-guard depth {maxDepth}
          </span>
        </NodeBody>
      </button>
    </StepRow>
  );
}

/* ── Trigger node ──────────────────────────────────────────────────────────── */

function TriggerNode({
  trigger,
  selected,
  onSelect,
}: {
  trigger: Trigger;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  const Glyph = NODE_ICONS[triggerIcon(trigger)];
  const detail = triggerDetail(trigger);
  return (
    <StepRow
      marker={
        <Marker selected={selected} tone="module">
          <Glyph className="size-4" aria-hidden />
        </Marker>
      }
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`When: ${triggerHeadline(trigger)}`}
        className={`${nodeCardClass(selected)} cursor-pointer`}
        onClick={() => onSelect(TRIGGER_NODE)}
        onKeyDown={keySelect(() => onSelect(TRIGGER_NODE))}
      >
        <NodeBody title={triggerHeadline(trigger)}>
          {isCuratedTriggerEvent(trigger) ? (
            <span className="truncate font-mono text-xs">{detail}</span>
          ) : (
            <span className="text-sm">{detail}</span>
          )}
        </NodeBody>
      </div>
    </StepRow>
  );
}

/* ── Conditions node ───────────────────────────────────────────────────────── */

function ConditionsNode({
  group,
  selected,
  onSelect,
}: {
  group: ConditionGroup;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  const Glyph = NODE_ICONS.filter;
  const empty = group.conditions.length === 0;
  const chips = conditionChips(group);
  const overflow = conditionsOverflow(group);
  return (
    <StepRow
      marker={
        <Marker selected={selected} tone="warning">
          <Glyph className="size-4" aria-hidden />
        </Marker>
      }
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Conditions"
        className={`${nodeCardClass(selected)} cursor-pointer`}
        onClick={() => onSelect(CONDITIONS_NODE)}
        onKeyDown={keySelect(() => onSelect(CONDITIONS_NODE))}
      >
        <NodeBody title={conditionsHeadline(group)}>
          {empty ? (
            <span className="text-sm">Runs on every trigger</span>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              {chips.map((c, i) => (
                <span key={i} className="bg-base-200 rounded px-1.5 py-0.5 font-mono text-xs">
                  {c}
                </span>
              ))}
              {overflow > 0 ? <span className="text-sm">+{overflow} more</span> : null}
            </span>
          )}
        </NodeBody>
      </div>
    </StepRow>
  );
}

/* ── Action node (sortable) ────────────────────────────────────────────────── */

function ActionNode({
  id,
  action,
  index,
  selected,
  onSelect,
  selectedId,
  onInsertIntoArm,
}: {
  id: string;
  action: Action;
  index: number;
  selected: boolean;
  onSelect: (id: NodeId) => void;
  /** The whole selection, so nested cards can highlight themselves. */
  selectedId: NodeId | null;
  onInsertIntoArm: (branchNodeId: string, arm: 'then' | 'otherwise', atIndex: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  // Pull the keyboard handler out of the drag listeners so we can compose it with
  // Enter-to-select (the listeners' onKeyDown reacts to Space only).
  const { onKeyDown: dndKeyDown, ...dragListeners } = listeners ?? {};

  // The drag source holds a placeholder (its content rides in the overlay), so it
  // must NOT also carry the sortable transform — only the OTHER cards animate.
  // This is dnd-kit's inherent functional transform, the one allowed inline style.
  const style = isDragging
    ? undefined
    : { transform: CSS.Transform.toString(transform), transition };

  function handleKeyDown(e: KeyboardEvent) {
    dndKeyDown?.(e);
    if (e.key === 'Enter') {
      e.preventDefault();
      onSelect(id);
    }
  }

  const isBranch = action.type === 'platform.if_else';
  const arms = isBranch ? branchArms(action) : null;
  const counts = branchCounts(action);

  return (
    <div ref={setNodeRef} style={style}>
      <StepRow marker={<Marker selected={selected}>{index + 1}</Marker>}>
        <div
          {...attributes}
          {...dragListeners}
          role="button"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={() => onSelect(id)}
          aria-label={`Step ${index + 1}: ${actionHeadline(action)}`}
          className={`${nodeCardClass(selected)} cursor-grab ${isDragging ? 'opacity-40' : ''}`}
        >
          <NodeBody title={actionHeadline(action)}>
            <span className="truncate font-mono text-xs">{actionDetail(action)}</span>
          </NodeBody>
          {counts ? (
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <Badge color="success" variant="soft" size="sm">
                {counts.then} if yes
              </Badge>
              <Badge color="neutral" variant="soft" size="sm">
                {counts.otherwise} if no
              </Badge>
            </span>
          ) : null}
          <GripVertical className="text-base-content/40 ml-auto size-4 shrink-0" aria-hidden />
        </div>
      </StepRow>

      {arms ? (
        // Outside the drag surface, so grabbing a nested step never lifts the
        // whole branch — and indented past the spine so the two sides read as
        // belonging to the card above rather than as steps of their own.
        <div className="mt-1.5 ml-11 flex flex-col gap-2">
          <BranchArmList
            branchNodeId={id}
            arm="then"
            label="If yes"
            steps={arms.then}
            selectedId={selectedId}
            onSelect={onSelect}
            onInsert={onInsertIntoArm}
            depth={1}
          />
          <BranchArmList
            branchNodeId={id}
            arm="otherwise"
            label="If no"
            steps={arms.otherwise}
            selectedId={selectedId}
            onSelect={onSelect}
            onInsert={onInsertIntoArm}
            depth={1}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ── Branch arms (docs/144 §9) ─────────────────────────────────────────────── */

/**
 * The steps inside one side of a branch, drawn indented under a labelled rail.
 *
 * Nested steps are SELECTABLE and INSERTABLE but not draggable, and the asymmetry
 * is deliberate rather than unfinished. Dragging across arms would mean a step
 * could be picked up in "yes" and dropped in "no" — a change of meaning disguised
 * as a change of order — and dnd-kit would need a sortable context per arm plus
 * cross-container collision handling to do it. Reordering within an arm is
 * delete-and-re-add, which is rare enough on a two-or-three-step branch to be
 * worth the honesty.
 */
function BranchArmList({
  branchNodeId,
  arm,
  label,
  steps,
  selectedId,
  onSelect,
  onInsert,
  depth,
}: {
  branchNodeId: string;
  arm: 'then' | 'otherwise';
  label: string;
  steps: Action[];
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  onInsert: (branchNodeId: string, arm: 'then' | 'otherwise', atIndex: number) => void;
  depth: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Badge color={arm === 'then' ? 'success' : 'neutral'} variant="soft" size="sm">
          {label}
        </Badge>
        {steps.length === 0 ? <span className="text-sm">Nothing happens</span> : null}
      </div>

      <div className="border-base-300 ml-2 flex flex-col gap-1.5 border-l pl-3">
        {steps.map((step, i) => {
          const id = nestedNodeId(branchNodeId, [{ arm, index: i }]);
          return (
            <BranchStep
              key={id}
              id={id}
              action={step}
              selected={selectedId === id}
              onSelect={onSelect}
              onInsert={onInsert}
              selectedIdForChildren={selectedId}
              depth={depth}
            />
          );
        })}

        <button
          type="button"
          className="border-base-300 hover:border-module hover:text-module flex w-full items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-left"
          onClick={() => onInsert(branchNodeId, arm, steps.length)}
        >
          <Plus className="size-3.5 shrink-0" aria-hidden />
          <span className="text-sm font-medium">Add a step here</span>
        </button>
      </div>
    </div>
  );
}

/** One step inside a branch — a compact card, and its own arms when it is itself
 *  a branch. */
function BranchStep({
  id,
  action,
  selected,
  onSelect,
  onInsert,
  selectedIdForChildren,
  depth,
}: {
  id: string;
  action: Action;
  selected: boolean;
  onSelect: (id: NodeId) => void;
  onInsert: (branchNodeId: string, arm: 'then' | 'otherwise', atIndex: number) => void;
  selectedIdForChildren: NodeId | null;
  depth: number;
}) {
  const isBranch = action.type === 'platform.if_else';
  const arms = isBranch ? branchArms(action) : null;
  const Glyph = NODE_ICONS[actionIcon(action)];

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="button"
        tabIndex={0}
        aria-label={actionHeadline(action)}
        className={`${nodeCardClass(selected)} cursor-pointer`}
        onClick={() => onSelect(id)}
        onKeyDown={keySelect(() => onSelect(id))}
      >
        <Glyph className="size-4 shrink-0" aria-hidden />
        <NodeBody title={actionHeadline(action)}>
          <span className="truncate font-mono text-xs">{actionDetail(action)}</span>
        </NodeBody>
      </div>

      {arms ? (
        <div className="ml-2 flex flex-col gap-2 pl-3">
          <BranchArmList
            branchNodeId={id}
            arm="then"
            label="If yes"
            steps={arms.then}
            selectedId={selectedIdForChildren}
            onSelect={onSelect}
            onInsert={onInsert}
            depth={depth + 1}
          />
          <BranchArmList
            branchNodeId={id}
            arm="otherwise"
            label="If no"
            steps={arms.otherwise}
            selectedId={selectedIdForChildren}
            onSelect={onSelect}
            onInsert={onInsert}
            depth={depth + 1}
          />
        </div>
      ) : null}
    </div>
  );
}

/** The lifted card in the DragOverlay — just the card, picked up off the surface. */
function DragCard({ action }: { action: Action }) {
  return (
    <div className="border-base-300 bg-base-100 flex items-center gap-3 rounded-lg border px-3 py-2.5 outline-2 outline-offset-2 outline-[color:var(--color-module)]">
      <NodeBody title={actionHeadline(action)}>
        <span className="truncate font-mono text-xs">{actionDetail(action)}</span>
      </NodeBody>
      <GripVertical className="text-base-content/40 ml-auto size-4 shrink-0" aria-hidden />
    </div>
  );
}

/** A "+" on the spine in the gap before an action, inserting a step at `atIndex`. */
function InsertRow({
  atIndex,
  onInsert,
}: {
  atIndex: number;
  onInsert: (atIndex: number) => void;
}) {
  return (
    <div className="flex justify-start">
      <div className="relative flex w-8 justify-center">
        <span className="bg-base-300 pointer-events-none absolute top-[-8px] bottom-[-8px] left-1/2 w-px -translate-x-1/2" />
        <button
          type="button"
          className="bg-base-100 text-base-content/50 hover:border-module hover:text-module border-base-300 relative z-10 flex size-5 items-center justify-center rounded-full border"
          onClick={() => onInsert(atIndex)}
          aria-label={
            atIndex === 0
              ? 'Insert a step at the start'
              : `Insert a step before step ${atIndex + 1}`
          }
        >
          <Plus className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function AddStepRow({ onClick, hasActions }: { onClick: () => void; hasActions: boolean }) {
  const Glyph = NODE_ICONS.action;
  return (
    <StepRow
      rail="last"
      marker={
        <div className="bg-base-100 border-base-300 relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed">
          <Plus className="size-4" aria-hidden />
        </div>
      }
    >
      <button
        type="button"
        className={`border-base-300 hover:border-module hover:text-module flex w-full gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left ${
          hasActions ? 'items-center' : 'items-start'
        }`}
        onClick={onClick}
      >
        <Glyph className={`size-4 shrink-0 ${hasActions ? '' : 'mt-0.5'}`} aria-hidden />
        {hasActions ? (
          <span className="text-sm font-medium">Add a step — an action or a wait</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Add the first thing to do</span>
            <span className="text-sm">
              Send an email, create a task, add a label, or wait a while.
            </span>
          </span>
        )}
      </button>
    </StepRow>
  );
}

/* ── Canvas ────────────────────────────────────────────────────────────────── */

export interface FlowCanvasProps {
  name: string;
  status: string;
  maxDepth: number;
  trigger: Trigger;
  conditions: ConditionGroup;
  actions: Action[];
  /** What the rule is aiming to cause (docs/144 §9); null = no goal. */
  goal: ConditionGroup | null;
  /** Stable ids parallel to `actions` (owned by the editor), for dnd-kit + keys. */
  actionIds: string[];
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  /** Insert a fresh action at `atIndex` (0..actions.length); the editor selects it. */
  onInsertAction: (atIndex: number) => void;
  onMoveAction: (fromIndex: number, toIndex: number) => void;
  /** Insert a fresh action into one side of a branch (docs/144 §9). */
  onInsertIntoArm: (branchNodeId: string, arm: 'then' | 'otherwise', atIndex: number) => void;
}

export function FlowCanvas({
  name,
  status,
  maxDepth,
  trigger,
  conditions,
  actions,
  goal,
  actionIds,
  selectedId,
  onSelect,
  onInsertAction,
  onMoveAction,
  onInsertIntoArm,
}: FlowCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const dndId = useId();

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
    // A fixed, readable column centered in the (spanning) gray map — the pane
    // fills the space, the step cards stay a consistent 640px width, matching the
    // dashboard and the workbench's other narrow-content panes.
    <div className="mx-auto flex w-full max-w-[40rem] flex-col px-6 py-6">
      <p className="mb-3 pl-11 text-sm">
        Click a step to edit it on the right. Drag a “Then” step to reorder.
      </p>

      <div className="flex flex-col gap-2">
        <SettingsNode
          name={name}
          status={status}
          maxDepth={maxDepth}
          selected={selectedId === SETTINGS_NODE}
          onSelect={onSelect}
        />
        <TriggerNode trigger={trigger} selected={selectedId === TRIGGER_NODE} onSelect={onSelect} />
        <ConditionsNode
          group={conditions}
          selected={selectedId === CONDITIONS_NODE}
          onSelect={onSelect}
        />

        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={actionIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {actions.map((action, i) => (
                <Fragment key={actionIds[i] ?? `fallback-${String(i)}`}>
                  <InsertRow atIndex={i} onInsert={onInsertAction} />
                  <ActionNode
                    id={actionIds[i] ?? `fallback-${String(i)}`}
                    action={action}
                    index={i}
                    selected={selectedId === actionIds[i]}
                    onSelect={onSelect}
                    selectedId={selectedId}
                    onInsertIntoArm={onInsertIntoArm}
                  />
                </Fragment>
              ))}
            </div>
          </SortableContext>

          <DragOverlay>{activeAction ? <DragCard action={activeAction} /> : null}</DragOverlay>
        </DndContext>

        <AddStepRow
          onClick={() => onInsertAction(actions.length)}
          hasActions={actions.length > 0}
        />

        <GoalNode goal={goal} selected={selectedId === GOAL_NODE} onSelect={onSelect} />
      </div>
    </div>
  );
}

/** The goal sits at the BOTTOM of the pipeline, after the steps — because it is
 *  what the steps are for, and reading it there is reading the rule's ending. */
function GoalNode({
  goal,
  selected,
  onSelect,
}: {
  goal: ConditionGroup | null;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  const chips = goal ? conditionChips(goal) : [];
  return (
    <StepRow
      rail="last"
      marker={
        <Marker selected={selected} tone={goal ? 'module' : 'neutral'}>
          <Target className="size-4" aria-hidden />
        </Marker>
      }
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="What you’re aiming for"
        className={`${nodeCardClass(selected)} cursor-pointer`}
        onClick={() => onSelect(GOAL_NODE)}
        onKeyDown={keySelect(() => onSelect(GOAL_NODE))}
      >
        <NodeBody title={goal ? 'What you’re aiming for' : 'No goal set'}>
          {goal ? (
            <span className="flex flex-wrap items-center gap-1">
              {chips.map((c, i) => (
                <span key={i} className="bg-base-200 rounded px-1.5 py-0.5 font-mono text-xs">
                  {c}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-sm">Add one to find out how often this actually works</span>
          )}
        </NodeBody>
      </div>
    </StepRow>
  );
}
