'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE STAGE BOARD
//
// Columns you drag a card between. This is the shape of "work moving through a
// process", and the CRM has more than one of those: deals on a sales pipeline
// today, and service tickets on the same `Pipeline` / `PipelineStage` rows
// (docs/144 §7.2). So the board is generic from its first commit — the caller
// supplies the columns, the cards and what a card looks like; this file owns the
// arrangement, the drag, the keyboard path and the narrow-width collapse.
//
// WHOLE-CARD DRAG, NO HANDLE. The PointerSensor takes a 6px activation distance,
// so a plain click still reaches the card's own click handler and a
// press-and-move starts a drag. That is the house rule every draggable surface
// here already follows (invoicing/stage-canvas, automations/flow-canvas).
//
// KEYBOARD IS NOT AN AFTERTHOUGHT. Cards are focusable; Space lifts, arrows move
// between columns, Space drops, Escape cancels — dnd-kit's KeyboardSensor with
// live announcements. A board that can only be operated with a mouse would put
// the single most-used CRM interaction out of reach of anyone who doesn't use
// one.
//
// NARROW WIDTHS: ONE DOM, CSS DECIDES. Below the pane's `@3xl` container
// breakpoint the board is a stage picker plus the one selected column; at `@3xl`
// and up every column sits side by side. Nothing re-mounts across that boundary,
// so resizing mid-drag cannot drop the card. Container queries, not viewport —
// a pane's width has nothing to do with the screen's.
// ══════════════════════════════════════════════════════════════════════════

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { columnStep, nextColumnId } from './board-keyboard';
import { Badge, Select, Text } from '@wizeworks/silicaui-react';

/** The semantic tones a column may carry. Every one is a registered silica color. */
export type BoardTone = 'success' | 'danger' | 'info' | 'warning' | 'module';

export interface BoardColumn {
  id: string;
  name: string;
  /**
   * What this column MEANS, as color. A won stage is success, a lost stage
   * danger, everything in flight the module hue — so the shape of the pipeline
   * reads before any label does (DESIGN.md, RULE #4).
   */
  tone: BoardTone;
  /** One short line under the name. The caller formats it (count · total value). */
  summary?: string;
}

export interface BoardCard<T> {
  id: string;
  columnId: string;
  item: T;
}

export interface RecordBoardProps<T> {
  columns: BoardColumn[];
  cards: BoardCard<T>[];
  renderCard: (item: T) => ReactNode;
  /**
   * Fired when a card is dropped on a different column. The caller commits it —
   * which may mean prompting first (a deal moving to Lost is asked why), so this
   * is deliberately not a promise the board waits on.
   */
  onMove: (cardId: string, toColumnId: string) => void;
  onOpenCard: (item: T, event: { shiftKey: boolean; altKey: boolean }) => void;
  /** Singular noun for announcements and empty text, e.g. "deal". */
  noun: string;
  /** Shown inside a column holding nothing. */
  emptyColumnText?: string;
}

// Static maps, not template literals: Tailwind only emits classes it can SEE in
// the source, so `border-${tone}` would compile to nothing at all.
const TONE_BORDER: Record<BoardTone, string> = {
  success: 'border-success',
  danger: 'border-danger',
  info: 'border-info',
  warning: 'border-warning',
  module: 'border-module',
};

const TONE_HEAD: Record<BoardTone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  info: 'text-info',
  warning: 'text-warning',
  module: 'text-module',
};

/* ── One card ───────────────────────────────────────────────────────────── */

function Card<T>({
  card,
  render,
  onOpen,
}: {
  card: BoardCard<T>;
  render: (item: T) => ReactNode;
  onOpen: (item: T, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      // The lifted card is rendered in the DragOverlay instead, so the original
      // fades rather than leaving a hole the columns would collapse into.
      className={`border-base-300 bg-base-100 hover:border-base-content/30 rounded-box cursor-pointer border p-3 text-left transition-colors ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      onClick={(event) => {
        onOpen(card.item, event);
      }}
      onKeyDown={(event) => {
        // Space belongs to the drag sensor (lift / drop); Enter opens. This prop
        // comes AFTER `{...listeners}`, so it REPLACES the sensor's own key
        // handler rather than adding to it: Space reached nothing, and a
        // keyboard move could never even start (issue 912). Hand every other
        // key on to the sensor.
        if (event.key !== 'Enter') {
          listeners?.onKeyDown?.(event);
          return;
        }
        event.preventDefault();
        onOpen(card.item, event);
      }}
    >
      {render(card.item)}
    </div>
  );
}

/* ── One column ─────────────────────────────────────────────────────────── */

function Column<T>({
  column,
  cards,
  render,
  onOpen,
  noun,
  emptyColumnText,
  visible,
}: {
  column: BoardColumn;
  cards: BoardCard<T>[];
  render: (item: T) => ReactNode;
  onOpen: (item: T, event: { shiftKey: boolean; altKey: boolean }) => void;
  noun: string;
  emptyColumnText?: string;
  /** Narrow widths show one column at a time; wide widths show them all. */
  visible: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={`min-w-0 shrink-0 flex-col gap-2 @3xl:flex @3xl:w-72 ${
        visible ? 'flex w-full' : 'hidden'
      }`}
    >
      <header
        className={`rounded-box border-b-2 px-1 pb-2 ${TONE_BORDER[column.tone]} ${
          isOver ? 'bg-base-200' : ''
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className={`truncate text-sm font-semibold ${TONE_HEAD[column.tone]}`}>
            {column.name}
          </h3>
          <Badge color={column.tone} variant="soft" size="sm">
            {cards.length}
          </Badge>
        </div>
        {column.summary ? <p className="mt-0.5 text-xs">{column.summary}</p> : null}
      </header>

      <div
        className={`rounded-box flex min-h-24 flex-col gap-2 p-1 transition-colors ${
          isOver
            ? `border-2 border-dashed ${TONE_BORDER[column.tone]} bg-base-200`
            : 'border-2 border-transparent'
        }`}
      >
        {cards.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm">
            {emptyColumnText ?? `No ${noun}s here yet. Drag one across to move it.`}
          </p>
        ) : (
          cards.map((card) => <Card key={card.id} card={card} render={render} onOpen={onOpen} />)
        )}
      </div>
    </section>
  );
}

/* ── The board ──────────────────────────────────────────────────────────── */

export function RecordBoard<T>({
  columns,
  cards,
  renderCard,
  onMove,
  onOpenCard,
  noun,
  emptyColumnText,
}: RecordBoardProps<T>) {
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  // Which column the narrow layout is showing. Defaults to the first stage —
  // where new work enters — rather than to nothing.
  const [shownColumnId, setShownColumnId] = useState<string | null>(null);

  // Where a KEYBOARD drag is headed. A mouse drop lands where the pointer is;
  // a keyboard drag has no pointer, and measuring the lifted card read about
  // one column off in the dock, so the board keeps the target itself: the
  // card's own column at lift, then one column per arrow press (issue 912,
  // see board-keyboard.ts).
  const keyboardTarget = useRef<string | null>(null);

  const visibleColumnIds = (rects: ReadonlyMap<UniqueIdentifier, { width: number }>) =>
    columns.map((c) => c.id).filter((id) => (rects.get(id)?.width ?? 0) > 0);

  const oneColumnPerKey: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
    const step = columnStep(event.code);
    if (step === null) return undefined;
    event.preventDefault();
    const from = keyboardTarget.current;
    const to = from ? nextColumnId(visibleColumnIds(context.droppableRects), from, step) : null;
    const fromRect = from ? context.droppableRects.get(from) : undefined;
    const toRect = to ? context.droppableRects.get(to) : undefined;
    if (!to || !fromRect || !toRect) return currentCoordinates;
    keyboardTarget.current = to;
    // The card is drawn moving by exactly the gap between the two columns.
    return { x: currentCoordinates.x + (toRect.left - fromRect.left), y: currentCoordinates.y };
  };

  const dropTarget: CollisionDetection = (args) => {
    if (args.pointerCoordinates) return pointerWithin(args);
    const target = keyboardTarget.current;
    const container = args.droppableContainers.find((c) => c.id === target);
    return container ? [{ id: container.id, data: { droppableContainer: container } }] : [];
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: oneColumnPerKey })
  );

  const byColumn = useMemo(() => {
    const map = new Map<string, BoardCard<T>[]>();
    for (const column of columns) map.set(column.id, []);
    for (const card of cards) map.get(card.columnId)?.push(card);
    return map;
  }, [columns, cards]);

  const activeCard = activeId ? (cards.find((c) => c.id === activeId) ?? null) : null;
  const shownColumn = shownColumnId ?? columns[0]?.id ?? null;

  const columnItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const column of columns) {
      items[column.id] = `${column.name} (${byColumn.get(column.id)?.length ?? 0})`;
    }
    return items;
  }, [columns, byColumn]);

  const nameOf = (id: string) => columns.find((c) => c.id === id)?.name ?? 'a stage';

  // Spoken aloud during a keyboard drag — without these a screen-reader user
  // gets a lift with no idea where the card went.
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const card = cards.find((c) => c.id === active.id);
      return `Picked up a ${noun} from ${card ? nameOf(card.columnId) : 'a stage'}. Use the arrow keys to choose a stage, space to drop, escape to cancel.`;
    },
    onDragOver: ({ over }) => (over ? `Over ${nameOf(String(over.id))}.` : undefined),
    onDragEnd: ({ over }) =>
      over ? `Moved the ${noun} to ${nameOf(String(over.id))}.` : `Left the ${noun} where it was.`,
    onDragCancel: () => `Canceled. The ${noun} stayed where it was.`,
  };

  function handleDragStart(event: DragStartEvent) {
    keyboardTarget.current = cards.find((c) => c.id === String(event.active.id))?.columnId ?? null;
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const card = cards.find((c) => c.id === String(active.id));
    const toColumnId = String(over.id);
    // Dropped back where it started — nothing happened, so don't emit an event
    // that would log a stage change and fire the automations keyed off it.
    if (!card || card.columnId === toColumnId) return;
    onMove(card.id, toColumnId);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* The narrow-width stage picker. Hidden once every column fits. */}
      <div className="@3xl:hidden">
        <Select
          size="sm"
          aria-label="Which stage to show"
          value={shownColumn ?? ''}
          items={columnItems}
          onValueChange={(next) => {
            setShownColumnId(next as string);
          }}
        />
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={dropTarget}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragCancel={() => {
          setActiveId(null);
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-auto pb-2">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              cards={byColumn.get(column.id) ?? []}
              render={renderCard}
              onOpen={onOpenCard}
              noun={noun}
              emptyColumnText={emptyColumnText}
              visible={column.id === shownColumn}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="border-base-content/40 bg-base-100 rounded-box border-2 p-3 shadow-none">
              {renderCard(activeCard.item)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Text size="sm" className="shrink-0 px-1">
        Drag a {noun} to another column to move it. With the keyboard: tab to one, press space, move
        with the arrow keys, then space again.
      </Text>
    </div>
  );
}
