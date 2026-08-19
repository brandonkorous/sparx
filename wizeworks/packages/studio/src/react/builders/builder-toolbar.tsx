'use client';

// The bar across the top of every builder — page, layout, piece, email and theme.
//
// ONE bar, not three. It was three near-identical copies, and they had already
// begun to disagree: the theme builder's light/dark switch wore labels where the
// page builder's did not, its undo was a circle where the others were squares, and
// its tooltip said what would be undone while theirs said "Undo". Three copies is
// three drift paths, and the drift is the part a person actually sees.
//
// ── WHY IT FOLDS, AND WHAT IT WILL NOT FOLD ────────────────────────────────
//
// The bar used to answer "too much content" by WRAPPING, which put it on two rows
// on any phone. Both files carried the same note about why: Save and Publish were
// one unwrappable group, so at 440px the bar overflowed by 24px and Publish sat off
// the right edge with no way to reach it. Wrapping fixed the unreachable button by
// spending a second row of a screen that has none to spare.
//
// So under BUILDER_COLLAPSE_PX the bar folds instead, and what stays is:
//
//   DEVICE and      The two `pinned` view groups, each collapsed to ONE button — a
//   LIGHT / DARK    toggle where there are two states, a menu where there are three.
//                   Neither is a setting: they are what the canvas is currently
//                   claiming to be, and an author flips between them every few
//                   seconds while judging a design. Behind a tap that stops being a
//                   comparison and becomes a trip.
//   UNDO and REDO   A builder is direct manipulation, and a touch screen has no
//                   ctrl+Z. A mis-drag with the way back behind a tap is the worst
//                   thing that can happen on this surface.
//   SAVE            The commit. Never folds, anywhere in this console — a Save in a
//                   popover is the one control a person came to press, hidden
//                   behind a tap they have no reason to expect.
//   The trigger     Everything else, one tap away and wearing labels.
//
// That core is 314px at its widest ("Saving…" is longer than "Save"), so one row is
// not a hope — it holds at any width a pane can be dragged to.
//
// ── FOLDING PUBLISH IS ONLY HONEST BECAUSE THE STATUS LINE STAYS ───────────
//
// The console's rule about a folded list toolbar is that hiding the reason a list
// is short is a screen lying about itself. Publish is the same shape: hiding it
// while there IS unpublished work would be a builder that looks finished and is
// not. It is safe here because the status bar underneath never folds and is already
// saying so in words — "Saved. Visitors still see the last published version" — and
// because `attention` marks the trigger on top of that.
//
// ── VALUES, NOT NODES ──────────────────────────────────────────────────────
//
// `views` and `actions` arrive as values so the BAR picks their shape: icon-only
// with a tooltip inline, labelled rows in the popover. A node cannot do that — a
// relocated icon button is an unlabelled glyph in a menu, which has no position to
// read it by and no hover to explain it.

import { type ReactNode } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Toolbar,
  ToolbarSeparator,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { useDocumentStore, useHistoryState } from '../context';
import { StudioIcon } from '../icon';
import { BuilderOverflow } from './builder-toolbar-overflow';

/** One of the app's own actions — Preview, History, Publish, Save as piece. */
export interface BuilderAction {
  /** The action's name. Its accessible name always; visible when there is room. */
  label: string;
  /**
   * The glyph, as a node.
   *
   * A node rather than a name because this is the APP's icon, out of the app's own
   * set, sitting beside the app's own Save. The engine's chrome takes names and
   * goes through `StudioHost.renderIcon`; an app action needs no round trip.
   */
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Hover text. Defaults to `label`; set it when the action needs the longer form. */
  title?: string;
  /**
   * Icon-only in the bar. Declares that the glyph carries the action alone — true
   * of an eye and a clock, not of a floppy disk. Never applies in the popover,
   * where nothing carries itself.
   */
  compact?: boolean;
  /** Filled and coloured: the one action loud enough to sit beside Save. */
  emphasis?: 'loud';
}

/** A choice about what the canvas is SHOWING — which device, which palette. */
export interface BuilderViewGroup {
  /** Names the group for a reader, e.g. "Show this page as". */
  label: string;
  value: string;
  onValue: (value: string) => void;
  options: readonly { value: string; label: string; icon: string }[];
}

interface BuilderToolbarProps {
  /**
   * What this bar controls, e.g. "Page editor controls". Required, not optional: a
   * toolbar is an ARIA landmark, and an unlabelled one is announced as a bare
   * "toolbar" — useless in a console where several are open at once.
   */
  label: string;
  /** What the canvas is showing. Never folds — one button each once it is narrow. */
  views?: readonly BuilderViewGroup[];
  /** The app's commit, as a node — rendered exactly as written, at every width. */
  save?: ReactNode;
  /** Everything else the app offers. Folds, wearing labels. */
  actions?: readonly BuilderAction[];
  /** Anything bespoke of the app's. Relocated into the popover as-is. */
  controls?: ReactNode;
  /** Marks the trigger while something folded needs seeing — unpublished work. */
  attention?: boolean;
  /** From `useBuilderFit`, measured on the builder root. */
  collapsed: boolean;
}

export function BuilderToolbar({
  label,
  views,
  save,
  actions,
  controls,
  attention,
  collapsed,
}: BuilderToolbarProps) {
  const groups = views ?? [];
  const hasActions = Boolean(actions && actions.length > 0);
  const foldable = hasActions || Boolean(controls);

  return (
    <Toolbar
      aria-label={label}
      size="sm"
      // The bar's own bottom rule, from the component rather than a border utility
      // written onto it — and it replaces the hand-painted `w-px` dividers between
      // the groups, which were a separator this design system already ships.
      dividers="bottom"
      // `flex-wrap` stays ABOVE the fold as a safety net: the widest bar is worked
      // out rather than measured (use-builder-fit.ts), so a second row is a better
      // failure than an unreachable button if that arithmetic is ever off by a
      // control. Below the fold it is `nowrap`, because one row down there is the
      // whole point and the core is small enough to guarantee it — with `overflow-x`
      // as the floor under that, since a bar too narrow even for the core must
      // scroll rather than clip. Clipping is the exact bug this file exists to end.
      className={`bg-base-100 w-full gap-2 px-2 py-1.5 ${collapsed ? 'flex-nowrap overflow-x-auto' : 'flex-wrap'}`}
    >
      {collapsed
        ? groups.map((group) => <FoldedView key={group.label} group={group} />)
        : groups.map((group) => <ViewGroupButtons key={group.label} group={group} />)}

      {groups.length > 0 ? <ToolbarSeparator /> : null}

      <UndoRedo />

      {/* `ml-auto` on the GROUP, not on the Save, so it still pushes right on a
          builder with no Save — and, once the row wraps above the fold, keeps the
          whole group together and right-aligned on its own line. */}
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        {!collapsed && hasActions ? <ActionButtons actions={actions ?? []} /> : null}
        {collapsed ? null : controls}
        {save}
        {collapsed && foldable ? (
          <BuilderOverflow
            label={label}
            actions={actions}
            controls={controls}
            attention={attention}
          />
        ) : null}
      </div>
    </Toolbar>
  );
}

/**
 * Step back and forward.
 *
 * Visible, not only on the keyboard: the person moving these blocks is not expected
 * to know ctrl+Z, and on the screen this bar was folded for there is no ctrl to
 * know about. One drag is one step — the store folds every frame of it into a
 * single entry.
 *
 * The tooltip names what will happen, which the theme builder had and the other two
 * did not. "Undo" on a disabled button tells nobody anything; "Nothing to undo" is
 * the answer to the question they were asking by hovering it.
 */
function UndoRedo() {
  const store = useDocumentStore();
  const { canUndo, canRedo } = useHistoryState();

  return (
    <>
      {/* Secondary chrome: neither `color` nor `variant`, so a bare `.btn` resolves
          to `base-content` and stays theme-correct in both palettes. */}
      <Tooltip
        content={store.undoLabel ? `Undo ${store.undoLabel.toLowerCase()}` : 'Nothing to undo'}
      >
        <Button
          size="sm"
          shape="square"
          className="shrink-0"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => store.undo()}
        >
          <StudioIcon name="undo" className="inline-flex size-4" />
        </Button>
      </Tooltip>
      <Tooltip content={canRedo ? 'Redo' : 'Nothing to redo'}>
        <Button
          size="sm"
          shape="square"
          className="shrink-0"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={() => store.redo()}
        >
          <StudioIcon name="redo" className="inline-flex size-4" />
        </Button>
      </Tooltip>
    </>
  );
}

/** A view group in the bar: icon-only, because the bar carries a row of them. */
function ViewGroupButtons({ group }: { group: BuilderViewGroup }) {
  return (
    <div role="group" aria-label={group.label} className="flex shrink-0 items-center gap-0.5">
      {group.options.map((option) => (
        <Tooltip key={option.value} content={option.label}>
          <Button
            size="sm"
            shape="square"
            aria-label={option.label}
            aria-pressed={group.value === option.value}
            {...(group.value === option.value ? { color: 'primary' as const } : {})}
            onClick={() => group.onValue(option.value)}
          >
            <StudioIcon name={option.icon} className="inline-flex size-4" />
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}

/**
 * A view group in a folded bar: one button, in whichever shape the group's own
 * length makes predictable.
 *
 * View groups do not fold into the popover at all, at any width. They are not
 * settings — which device and which palette are what the canvas is currently
 * CLAIMING TO BE, and an author flips between them every few seconds while judging a
 * design. Behind a tap that stops being a comparison and becomes a trip.
 */
function FoldedView({ group }: { group: BuilderViewGroup }) {
  return group.options.length === 2 ? (
    <ViewToggleButton group={group} />
  ) : (
    <ViewMenuButton group={group} />
  );
}

/**
 * Two states, so: one button that switches to the other one.
 *
 * It shows the state it will GIVE you, not the one you are in. The canvas behind it
 * is already saying which palette is on screen, loudly and in full colour, so a
 * button repeating that would be the second answer to a question nothing asked —
 * whereas "what happens if I press this" has no other answer anywhere.
 *
 * Bare chrome, no `color`: filled, it would compete with the Save two controls
 * along, and this is a way of LOOKING rather than a thing to do.
 */
function ViewToggleButton({ group }: { group: BuilderViewGroup }) {
  const index = group.options.findIndex((option) => option.value === group.value);
  const next = group.options[(index + 1) % group.options.length];
  if (!next) return null;
  const name = `Switch to ${next.label.toLowerCase()}`;

  return (
    <Tooltip content={name}>
      <Button
        size="sm"
        shape="square"
        className="shrink-0"
        aria-label={name}
        onClick={() => group.onValue(next.value)}
      >
        <StudioIcon name={next.icon} className="inline-flex size-4" />
      </Button>
    </Tooltip>
  );
}

/**
 * More than two, so: one button that OPENS the choice.
 *
 * The opposite showing rule from the toggle, and for the same reason. A toggle's
 * whole meaning is what it will do next, so it shows that; a menu's button does
 * nothing but open, so it is free to answer the more useful question — WHICH FRAME
 * AM I LOOKING AT. That matters most on the screen this bar folded for, where the
 * canvas fills the pane at every device and cannot answer it by itself.
 */
function ViewMenuButton({ group }: { group: BuilderViewGroup }) {
  const current = group.options.find((option) => option.value === group.value);
  const name = current ? `${group.label} ${current.label.toLowerCase()}` : group.label;

  return (
    <DropdownMenu>
      <Tooltip content={name}>
        <DropdownMenuTrigger>
          <Button size="sm" shape="square" className="shrink-0" aria-label={name}>
            <StudioIcon name={current?.icon ?? 'monitor'} className="inline-flex size-4" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="start">
        {group.options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="gap-2"
            onClick={() => group.onValue(option.value)}
          >
            <StudioIcon name={option.icon} className="inline-flex size-4" />
            <span>{option.label}</span>
            {/* The chosen one is MARKED, not merely absent from the choice. A menu
                that closes leaving no trace of what it did is a control you have to
                re-open in order to read. */}
            {group.value === option.value ? (
              <StudioIcon name="check" className="ml-auto inline-flex size-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The app's actions in the bar. A `compact` one keeps only its glyph. */
function ActionButtons({ actions }: { actions: readonly BuilderAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <Tooltip key={action.label} content={action.title ?? action.label}>
          <Button
            size="sm"
            className="shrink-0 whitespace-nowrap"
            aria-label={action.label}
            disabled={action.disabled}
            loading={action.loading}
            {...(action.compact ? { shape: 'square' as const } : {})}
            {...(action.emphasis === 'loud' ? { color: 'primary' as const } : {})}
            onClick={action.onClick}
          >
            {action.icon}
            {action.compact ? null : <span>{action.label}</span>}
          </Button>
        </Tooltip>
      ))}
    </>
  );
}
