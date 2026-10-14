'use client';

// What a surface shows when its FIRST load failed and nothing is on screen. A
// failed refetch over data still showing is an <Alert> banner instead, worded by
// `loadFailureWords`, and never tears the content down.

// It renders the message only. It goes INSIDE the surface's own content card, as
// a sibling of the loading and empty branches; never an early `return` that drops
// the toolbar and the card. The toolbar stays enabled: the failure is the data's.

import type { ReactNode } from 'react';
import { faExclamationTriangle } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Button, EmptyState } from '@wizeworks/silicaui-react';
import {
  LOAD_GONE,
  LOAD_OUR_FAULT,
  LOAD_REFUSED,
  paneLoadReason,
  type PaneLoadReason,
} from '../lib/api-error';
import { hasStateArt, StateArt } from './state-art';

interface PaneLoadErrorProps {
  /** Which module's pane this is, so a brand with per-app artwork can draw it. */
  module?: string;
  /** The surface's own glyph, so a failed pane still looks like itself. Defaults
   *  to a warning triangle. */
  icon?: ReactNode;
  /** What could not be loaded, in the person's terms: "Could not load your
   *  customers", never "Request failed" or a status code. */
  title: ReactNode;
  /** What it means and what it does NOT mean. Used only when the server could
   *  not be reached; every other cause has words owned by lib/api-error. */
  description?: ReactNode;
  /** WHY there is nothing to show. Pass `error` instead and it is worked out;
   *  pass this only to overrule it, and then your own words are kept. */
  reason?: PaneLoadReason;
  /** The query's error, so the reason is READ rather than assumed (issue 286). */
  error?: unknown;
  /** The thing, in her words ("product", "order"), to word the gone state. */
  noun?: string;
  /** Overrides for the gone wording, where the generic is too vague. */
  missingTitle?: ReactNode;
  missingDescription?: ReactNode;
  /** Re-runs the query. Ignored when retrying cannot work (gone or refused). */
  onRetry?: () => void;
  /** Overridden only when "Try again" would be the wrong verb. */
  retryLabel?: string;
  /** Extra recovery, rendered after the retry so retry stays the obvious move. */
  actions?: ReactNode;
}

// A caller that named its own `reason` keeps its own words. Otherwise its
// `description` was written about the unreachable case and is used only there.
function shownWords(p: PaneLoadErrorProps, resolved: PaneLoadReason) {
  if (resolved === 'missing') {
    return {
      title: p.missingTitle ?? (p.noun ? `That ${p.noun} is no longer here` : p.title),
      description: p.missingDescription ?? (p.noun ? LOAD_GONE : p.description),
    };
  }
  if (p.reason !== undefined || resolved === 'unreachable') {
    return { title: p.title, description: p.description };
  }
  return {
    title: p.title,
    description: resolved === 'refused' ? LOAD_REFUSED : LOAD_OUR_FAULT,
  };
}

export function PaneLoadError(props: PaneLoadErrorProps) {
  const { icon, module, reason, error, onRetry, retryLabel = 'Try again', actions } = props;
  const resolved = reason ?? paneLoadReason(error);
  const missing = resolved === 'missing';
  const refused = resolved === 'refused';
  // A retry against a deleted record, or a door this account may not open, fails
  // every time. A button that cannot work is worse than no button.
  const retry = missing || refused ? undefined : onRetry;
  // A refusal is about access, which is trust: plain and calm, no character.
  const branded = hasStateArt() && !refused;
  const words = shownWords(props, resolved);

  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-1 px-6 py-10">
      {refused ? null : <StateArt state={missing ? 'missing' : 'unreachable'} module={module} />}
      <EmptyState
        // Toned here, not at a hundred call sites: red for a failure, amber for
        // something gone or out of reach. The glyph fills `currentColor`.
        icon={
          branded ? undefined : (
            <span className={missing || refused ? 'text-warning' : 'text-error'}>
              {icon ?? <Icon glyph={faExclamationTriangle} className="size-6" aria-hidden />}
            </span>
          )
        }
        title={words.title}
        description={words.description}
        actions={
          retry || actions ? (
            <>
              {retry ? (
                // `module`, not `error`: coloring recovery as danger says the safe
                // move is the risky one.
                <Button size="sm" color="module" onClick={retry}>
                  {retryLabel}
                </Button>
              ) : null}
              {actions}
            </>
          ) : undefined
        }
      />
    </div>
  );
}
