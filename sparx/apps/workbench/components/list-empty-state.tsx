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
import { EmptyState } from '@wizeworks/silicaui-react';

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
  /** The create action — a <Button color="module"> that makes the first one. */
  actions?: ReactNode;
}

export function ListEmptyState({
  filtered,
  noResults,
  firstRun,
}: {
  /** True while a search or filter is narrowing the list — so the reason it is
   *  empty is the query, not that nothing exists yet. */
  filtered: boolean;
  noResults: NoResultsState;
  firstRun: FirstRunState;
}) {
  if (filtered) {
    return (
      <EmptyState
        icon={noResults.icon}
        title={noResults.title}
        description={noResults.description}
        actions={noResults.actions}
      />
    );
  }

  return (
    <EmptyState
      icon={firstRun.icon ?? noResults.icon}
      title={firstRun.title}
      description={firstRun.description}
      actions={firstRun.actions}
    />
  );
}
