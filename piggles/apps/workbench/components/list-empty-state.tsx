'use client';

// The empty state a LIST shows when it has no rows — and the one place the rule
// that governs it lives.
//
// A list can be empty for two different reasons, and they must never share a
// message: a search or filter that matched nothing is a NO-RESULTS state (the
// query is why it's empty, so inviting someone to "add your first" when they
// have four hundred and mistyped a name is the worse mistake), while a
// genuinely empty list is FIRST-RUN — an invitation to make the first one.
//
// Callers describe BOTH states and pass the one boolean that distinguishes
// them; this component owns the choice. That is the whole point: "which message
// does an empty list show" is decided here, once, not re-decided (and
// potentially mis-decided) at every list in the app. Error and loading are
// separate branches the caller still owns — this is only the no-rows node.
//
// Both branches render silica's <EmptyState> with the list's own glyph. The
// mascot used to sit on the first-run branch and no longer appears in ANY empty
// state: an empty list is a state to resolve, not a moment to be greeted, and a
// character stamped across every void is exactly what stops it reading as a
// character. Sparky's home is the brand chrome — the auth pane he roams behind
// and the marketing footer he leans over.

import type { ReactNode } from 'react';
import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { hasStateArt, StateArt } from './state-art';

interface NoResultsState {
  /** The list's own glyph, reused — so the no-results state still looks like this list. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Optional recovery action — typically a "Clear filters" / "Clear search" button. */
  actions?: ReactNode;
}

interface FirstRunState {
  /** Defaults to the no-results glyph, so a list names itself in both states
   *  without every caller passing the same icon twice. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /**
   * The create action, as the SAME object the pane toolbar is given.
   *
   * A first-run state is an invitation to make the first one, and sixteen lists
   * said "Add your first one to get started" over an empty card with nothing to
   * press. The only way in was the toolbar's round plus, which carries its label
   * in a tooltip and never on screen at any pane width — measured from 360px to
   * 1100px — so the screen asked for something and pointed at nothing.
   *
   * Taking the ACTION rather than a rendered button is what keeps the label in
   * one place: the surface hoists its `primaryAction` to a const and hands the
   * same object to both, so renaming "Add a bundle" cannot leave the empty state
   * saying something else. No icon here on purpose — the two consoles draw their
   * glyphs from different libraries, and a labelled button needs none.
   */
  action?: { label: string; onClick: (event: ActionEvent) => void };
  /** A rendered action row, for the lists that want more than one button or an
   *  icon on it. Wins over `action` when both are given. */
  actions?: ReactNode;
}

/** What a create handler reads off the click: the modifier contract every list
 *  in the app shares (Shift opens alongside, Alt opens a new window). */
interface ActionEvent {
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * The one button a first-run state offers, built from the surface's own action.
 *
 * `color="module"` because it belongs to the app inviting you, matching the
 * module-toned glyph above it and the lists that already pass a button by hand.
 */
function FirstRunAction({ action }: { action: FirstRunState['action'] }) {
  if (!action) return null;
  return (
    <Button
      size="sm"
      color="module"
      onClick={(event) => {
        action.onClick(event);
      }}
    >
      {action.label}
    </Button>
  );
}

export function ListEmptyState({
  filtered,
  module,
  noResults,
  firstRun,
}: {
  /** True while a search or filter is narrowing the list — so the reason it is
   *  empty is the query, not that nothing exists yet. */
  filtered: boolean;
  /** Which module's list this is, so a brand with per-app artwork can draw the
   *  right picture. Optional: a list that does not pass it gets the brand's
   *  generic empty picture, which is still better than no picture. */
  module?: string;
  noResults: NoResultsState;
  firstRun: FirstRunState;
}) {
  const branded = hasStateArt();
  const state = filtered ? 'no-results' : 'first-run';
  const chosen = filtered ? noResults : firstRun;

  return (
    // The art sits ABOVE silica's EmptyState rather than inside its icon chip —
    // see components/state-art.tsx for why it replaces the chip instead of
    // decorating it.
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-1 px-6 py-10">
      <StateArt state={state} module={module} />
      <EmptyState
        icon={
          branded ? undefined : (
            <Glyph tone={filtered ? 'warning' : 'module'}>
              {filtered ? noResults.icon : (firstRun.icon ?? noResults.icon)}
            </Glyph>
          )
        }
        title={chosen.title}
        description={chosen.description}
        actions={chosen.actions ?? <FirstRunAction action={firstRun.action} />}
      />
    </div>
  );
}

/**
 * The action row under an empty state's copy, for the cases with more than one.
 *
 * Buttons sized to their own labels and centered read as ragged once they wrap:
 * "Start from a ready-made list" is half again the width of "Build one from
 * scratch", so a narrow pane stacks two different-length pills down the middle.
 * Stacked, they should match; side by side, they need not.
 */
export function EmptyStateActions({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2 @md:max-w-none @md:flex-row @md:flex-wrap @md:items-center @md:justify-center">
      {children}
    </div>
  );
}

/**
 * Tones the list's own glyph, because silica's EmptyState will not.
 *
 * Its icon chip paints a 55%-faded base-content glyph on base-200 and takes no
 * color — so every state in the app drew the same grey picture and the ONLY
 * thing distinguishing "nothing matched your filter" from "you have none yet"
 * from "this failed to load" was a sentence you had to stop and read. Two facts
 * cannot share one appearance (DESIGN.md RULE #4), and a faded glyph is not
 * readable ink (RULE #3).
 *
 * So the three states are three tones, and the picture answers before the words
 * do:
 *
 *   warning  no results — a filter is hiding things; nothing is wrong, but
 *            something IS being withheld, and that is the fact to convey
 *   module   first run  — an invitation, in the color of the app inviting you
 *   error    could not load — see components/pane-load-error.tsx
 *
 * Decided here rather than at the call site because there are a hundred call
 * sites: they pass the glyph, this decides what each state looks like, and
 * changing that is one edit. Wrapping is how the tone lands at all — the icon
 * strokes `currentColor`, and silica's chip exposes no prop to reach it, so
 * re-skinning it from outside would be the RULE #1 violation this avoids.
 */
function Glyph({ tone, children }: { tone: 'warning' | 'module'; children: ReactNode }) {
  if (!children) return null;
  return <span className={tone === 'warning' ? 'text-warning' : 'text-module'}>{children}</span>;
}
