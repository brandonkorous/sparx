'use client';

// Version history panel (docs/84 Slice G-versioning) — the right pane in "history"
// mode, a sibling of the inspector. Lists the immutable published snapshots
// newest-first; the live version is tagged, older ones offer "Restore" (stages
// that snapshot as a new draft to review + publish). A banner at the top lets the
// tenant discard unpublished changes. Pure presentational — all mutations are
// lifted to the editor shell.

import * as React from 'react';
import { History, RotateCcw } from 'lucide-react';

import type { AutomationVersionDto } from '../_lib/types';

interface Props {
  versions: AutomationVersionDto[] | null;
  loading: boolean;
  error: string | null;
  /** The currently-live published version (tagged, not restorable). */
  currentVersion: number;
  /** A draft (saved or unsaved) exists — show the discard banner. */
  hasUnpublished: boolean;
  pending: boolean;
  onRestore: (version: number) => void;
  onDiscard: () => void;
}

/** Deterministic, locale-formatted publish time. Rendered only after a client
 *  fetch (never SSR'd with data), so toLocaleString is hydration-safe here. */
function publishedWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function HistoryPanel({
  versions,
  loading,
  error,
  currentVersion,
  hasUnpublished,
  pending,
  onRestore,
  onDiscard,
}: Props) {
  return (
    <div className="ax-hist">
      {hasUnpublished && (
        <div className="ax-hist__draft">
          <span className="ax-hist__draft-text">You have unpublished changes.</span>
          <button type="button" className="ax-hist__discard" onClick={onDiscard} disabled={pending}>
            Discard
          </button>
        </div>
      )}

      {loading && <p className="ax-hist__empty">Loading history…</p>}
      {error && <p className="ax-hist__empty ax-hist__empty--error">{error}</p>}

      {!loading && !error && versions?.length === 0 && (
        <div className="ax-hist__none">
          <History aria-hidden />
          <p>No published versions yet.</p>
          <span>Publishing records the first immutable snapshot.</span>
        </div>
      )}

      {!loading &&
        !error &&
        versions?.map((v) => {
          const isCurrent = v.version === currentVersion;
          // `||` (not `??`): an empty/whitespace note should fall back too.
          const noteLabel = v.note?.trim() ? v.note.trim() : `Version ${v.version}`;
          return (
            <div key={v.id} className="ax-hist__item" data-current={isCurrent}>
              <span className="ax-hist__ver">v{v.version}</span>
              <span className="ax-hist__body">
                <span className="ax-hist__note">{noteLabel}</span>
                <span className="ax-hist__time">{publishedWhen(v.publishedAt)}</span>
              </span>
              {isCurrent ? (
                <span className="ax-hist__cur">Live</span>
              ) : (
                <button
                  type="button"
                  className="ax-hist__restore"
                  onClick={() => onRestore(v.version)}
                  disabled={pending}
                >
                  <RotateCcw aria-hidden />
                  Restore
                </button>
              )}
            </div>
          );
        })}
    </div>
  );
}
