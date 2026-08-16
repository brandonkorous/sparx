'use client';

// The stage canvas — the LEFT pane and the readable "map" of the workflow editor.
// It draws the workflow as a vertical pipeline on a connecting spine: a Settings
// node, then each stage in order, then an end "add stage". Clicking any node
// selects it (the inspector on the right edits it); the stages drag to reorder.
// This is the invoicing sibling of the automations flow-canvas — same interaction
// and visual language, adapted to a document's journey through its stages.
//
// Drag-and-drop (the headline interaction):
//   • The WHOLE stage card is the drag surface (no handle) — a PointerSensor with
//     a 6px activation distance tells a click (select) apart from a drag.
//   • The lifted card rides in a DragOverlay (a portal, so the scroll container
//     never clips it) while its slot holds a placeholder; the other stages animate
//     to open the gap.
//   • Keyboard: focus a card, Space to pick up, ↑/↓ to move, Space to drop, Escape
//     to cancel; Enter selects (the keyboard sensor is scoped to Space so Enter
//     stays free for selection).
//   • The 1·2·3 markers renumber live from the array index.
// Insert-anywhere: a "+" sits on the spine in the gap before each stage, and the
// end button appends — so a stage can be inserted anywhere, not just the end.
//
// A stage already carries a stable session `key`, so that is the dnd id AND the
// React key — no parallel id array like automations needs for its actions.
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
import { faDiagramProject, faGripDots, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Badge } from '@wizeworks/silicaui-react';
import type { StageDraft } from './workflow-data';
import { stageTone } from './types';
import { effectSummary, typeLabel } from './stage-presentation';

export const SETTINGS_NODE = 'settings';

// Lock dragging to the vertical axis — the spine is a single column, so sideways
// drift would only ever be noise. Inline so we don't add @dnd-kit/modifiers.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

type StageToneName = ReturnType<typeof stageTone>;
type MarkerTone = 'neutral' | StageToneName;

/** The marker on the spine — a numbered step or an icon in a rounded tile. A stage
 *  marker carries its own resting hue from the stage TYPE (the same status axis as
 *  its badge), like the automations trigger/conditions markers; any marker gains
 *  the module ring when its node is selected. */
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
    tone === 'success'
      ? 'border-success/40 bg-success/10 text-success'
      : tone === 'warning'
        ? 'border-warning/40 bg-warning/10 text-warning'
        : tone === 'danger'
          ? 'border-danger/40 bg-danger/10 text-danger'
          : tone === 'info'
            ? 'border-info/40 bg-info/10 text-info'
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

/** The card body — headline + detail. Shared by the Settings node, the stage
 *  cards, and the drag overlay so they read identically. */
function NodeBody({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-base font-semibold">{title}</span>
      {children}
    </span>
  );
}

function nodeCardClass(selected: boolean): string {
  // Selection uses silica's own field ring — a 2px solid outline at a 2px offset
  // in the module hue, identical to what `<Input color="module">` shows on focus,
  // so a selected node and a focused field read as the same system.
  return `bg-base-100 flex w-full items-center gap-3 rounded-lg border border-base-300 px-3 py-2.5 text-left ${
    selected
      ? 'outline-2 outline-offset-2 outline-[color:var(--color-module)]'
      : 'hover:border-base-content/20'
  }`;
}

type RailPos = 'first' | 'middle' | 'last';

/** One row on the spine: a marker in the rail column + the node body. The rail
 *  column draws its OWN segment of the connecting line, so the line trims to the
 *  first and last marker centers (22px = pt-1.5 + half of the size-8 marker) and
 *  extends into the flex gap (-8px) to meet the neighbouring row — no stub above
 *  the first marker or below the last. The opaque marker paints over the segment,
 *  breaking it like a bead on a string. */
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
  slug,
  isDefault,
  selected,
  onSelect,
}: {
  name: string;
  slug: string;
  isDefault: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const reference = slug.trim() || 'no reference name yet';
  const subtitle = isDefault ? `${reference} · used by default` : reference;
  return (
    <StepRow
      rail="first"
      marker={
        <Marker selected={selected}>
          <Icon glyph={faDiagramProject} className="size-4" aria-hidden />
        </Marker>
      }
    >
      <button
        type="button"
        className={nodeCardClass(selected)}
        onClick={() => {
          onSelect(SETTINGS_NODE);
        }}
      >
        <NodeBody title={name.trim() || 'Untitled workflow'}>
          <span className="text-sm">{subtitle}</span>
        </NodeBody>
      </button>
    </StepRow>
  );
}

/* ── Stage node (sortable) ─────────────────────────────────────────────────── */

function StageNode({
  stage,
  index,
  selected,
  onSelect,
}: {
  stage: StageDraft;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.key,
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

  const headline = stage.customerLabel.trim() || stage.name.trim() || 'Untitled stage';

  function handleKeyDown(e: KeyboardEvent) {
    dndKeyDown?.(e);
    if (e.key === 'Enter') {
      e.preventDefault();
      onSelect(stage.key);
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      <StepRow
        marker={
          <Marker selected={selected} tone={stageTone(stage.stageType)}>
            {index + 1}
          </Marker>
        }
      >
        <div
          {...attributes}
          {...dragListeners}
          role="button"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={() => {
            onSelect(stage.key);
          }}
          aria-label={`Stage ${String(index + 1)}: ${headline}`}
          className={`${nodeCardClass(selected)} cursor-grab ${isDragging ? 'opacity-40' : ''}`}
        >
          <NodeBody title={headline}>
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge color={stageTone(stage.stageType)} variant="soft" size="sm">
                {typeLabel(stage.stageType)}
              </Badge>
              {index === 0 ? (
                <Badge color="module" variant="soft" size="sm">
                  Documents start here
                </Badge>
              ) : null}
            </span>
            <span className="text-sm">{effectSummary(stage)}</span>
          </NodeBody>
          <Icon
            glyph={faGripDots}
            className="text-base-content/40 ml-auto size-4 shrink-0"
            aria-hidden
          />
        </div>
      </StepRow>
    </div>
  );
}

/** The lifted card in the DragOverlay — just the card, picked up off the surface. */
function DragCard({ stage }: { stage: StageDraft }) {
  const headline = stage.customerLabel.trim() || stage.name.trim() || 'Untitled stage';
  return (
    <div className="border-base-300 bg-base-100 flex items-center gap-3 rounded-lg border px-3 py-2.5 outline-2 outline-offset-2 outline-[color:var(--color-module)]">
      <NodeBody title={headline}>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge color={stageTone(stage.stageType)} variant="soft" size="sm">
            {typeLabel(stage.stageType)}
          </Badge>
        </span>
      </NodeBody>
      <Icon
        glyph={faGripDots}
        className="text-base-content/40 ml-auto size-4 shrink-0"
        aria-hidden
      />
    </div>
  );
}

/** A "+" on the spine in the gap before a stage, inserting a stage at `atIndex`. */
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
          onClick={() => {
            onInsert(atIndex);
          }}
          aria-label={
            atIndex === 0
              ? 'Insert a stage at the start'
              : `Insert a stage before stage ${String(atIndex + 1)}`
          }
        >
          <Icon glyph={faPlus} className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function AddStageRow({ onClick, hasStages }: { onClick: () => void; hasStages: boolean }) {
  return (
    <StepRow
      rail="last"
      marker={
        <div className="bg-base-100 border-base-300 relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed">
          <Icon glyph={faPlus} className="size-4" aria-hidden />
        </div>
      }
    >
      <button
        type="button"
        className={`border-base-300 hover:border-module hover:text-module flex w-full gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left ${
          hasStages ? 'items-center' : 'items-start'
        }`}
        onClick={onClick}
      >
        <Icon
          glyph={faPlus}
          className={`size-4 shrink-0 ${hasStages ? '' : 'mt-0.5'}`}
          aria-hidden
        />
        {hasStages ? (
          <span className="text-sm font-medium">Add a stage</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Add the first stage</span>
            <span className="text-sm">
              A step a document sits at — a draft, a sent invoice, a paid receipt.
            </span>
          </span>
        )}
      </button>
    </StepRow>
  );
}

/* ── Canvas ────────────────────────────────────────────────────────────────── */

export interface StageCanvasProps {
  name: string;
  slug: string;
  isDefault: boolean;
  stages: StageDraft[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Insert a fresh stage at `atIndex` (0..stages.length); the editor selects it. */
  onInsertStage: (atIndex: number) => void;
  onMoveStage: (fromIndex: number, toIndex: number) => void;
}

export function StageCanvas({
  name,
  slug,
  isDefault,
  stages,
  selectedId,
  onSelect,
  onInsertStage,
  onMoveStage,
}: StageCanvasProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  const keys = stages.map((stage) => stage.key);
  const activeStage = activeKey ? (stages.find((stage) => stage.key === activeKey) ?? null) : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveKey(String(e.active.id));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveKey(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onMoveStage(from, to);
  }

  return (
    // A fixed, readable column centered in the (spanning) gray map — the pane
    // fills the space, the stage cards stay a consistent 640px width, matching the
    // automations canvas and the workbench's other narrow-content panes.
    <div className="mx-auto flex w-full max-w-[40rem] flex-col px-6 py-6">
      <p className="mb-3 pl-11 text-sm">
        Click a stage to edit it on the right. Drag a stage to reorder.
      </p>

      <div className="flex flex-col gap-2">
        <SettingsNode
          name={name}
          slug={slug}
          isDefault={isDefault}
          selected={selectedId === SETTINGS_NODE}
          onSelect={onSelect}
        />

        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragCancel={() => {
            setActiveKey(null);
          }}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={keys} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {stages.map((stage, i) => (
                <Fragment key={stage.key}>
                  <InsertRow atIndex={i} onInsert={onInsertStage} />
                  <StageNode
                    stage={stage}
                    index={i}
                    selected={selectedId === stage.key}
                    onSelect={onSelect}
                  />
                </Fragment>
              ))}
            </div>
          </SortableContext>

          <DragOverlay>{activeStage ? <DragCard stage={activeStage} /> : null}</DragOverlay>
        </DndContext>

        <AddStageRow
          onClick={() => {
            onInsertStage(stages.length);
          }}
          hasStages={stages.length > 0}
        />
      </div>
    </div>
  );
}
