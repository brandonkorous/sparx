'use client';

// Crash isolation for the shell's CHROME — the counterpart to the per-pane
// boundary in components/surface-mount.tsx.
//
// The pane boundary already holds the line that "one surface throwing must take
// out one pane, not the operator's whole arrangement." The chrome had no such
// line: the toolbar, rail, module panel, billing banner and status bar all sat
// bare under app/error.tsx, so a throw in any of them replaced the entire
// workbench with the route-level crash screen — every open pane with it.
//
// That is a worse outcome than it sounds, and the reason is unsaved work. Pane
// LAYOUT is persisted and comes back; pane DRAFTS are in memory and do not (see
// lib/drafts.ts). So a status-bar chip failing to render used to discard a
// half-written invoice in a pane that was working perfectly — and the only
// offered recoveries, `reset()` and Reload, both discarded it again. The panes
// are where the work is; nothing in the chrome is allowed to take them down.
//
// Hence a boundary per REGION rather than one around the chrome as a whole. A
// broken status bar should cost the status bar, not also the toolbar's site
// switcher and the rail's navigation — and every region here is independently
// useful, so degrading them independently is the honest shape.
//
// What this deliberately does NOT do is retry. A pane's "Try again" is worth
// offering because a pane is usually failing on ONE record and re-mounting it is
// a real second chance. Chrome renders the same global state every time, so a
// button that re-mounts it is a button that fails again — the honest options are
// carrying on without that strip, or reloading.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { faExclamationTriangle } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Button } from '@wizeworks/silicaui-react';
import { isChunkLoadError, reloadOnceForStaleBuild } from '@wizeworks/app-kit';
import { reportCrash } from '../lib/analytics';

interface ChromeBoundaryProps {
  children: ReactNode;
  /**
   * What the operator has LOST, as a complete sentence in their words —
   * "Live updates have stopped.", "Search and your account menu have stopped
   * working."
   *
   * Not the name of the thing that broke. "The status bar ran into a problem"
   * names a piece of OUR interface: the person reading it runs a business, has
   * never called that strip anything, and is left knowing something is wrong
   * without knowing what it costs them or whether to worry. Naming the
   * CONSEQUENCE answers both in the same breath — and it is the half that
   * decides whether they need to act now or can finish what they were doing.
   */
  readonly whatStopped: string;
  /**
   * Stable identifier for the crash report. Developer-facing and NEVER rendered:
   * it is kept apart from `whatStopped` so the operator's copy can be rewritten
   * whenever it reads badly without silently splitting one region's telemetry
   * into two.
   */
  readonly region: string;
  /**
   * Narrow region (the module rail). Drops to the icon alone with the message on
   * its tooltip — a 48px column cannot hold a sentence, and a fallback that
   * overflows its own strip breaks the layout it was supposed to protect.
   */
  readonly compact?: boolean;
  /**
   * Render NOTHING on failure. For a region that occupies no space until it is
   * summoned — the command palette, the nav drawer. Those sit in the layout as
   * zero-height overlays, so any visible fallback would appear as an unexplained
   * warning wedged into the chrome, permanently, with nothing to dismiss it. The
   * honest degradation is that ⌘K stops opening; the crash still reports.
   */
  readonly silent?: boolean;
}

export class ChromeBoundary extends Component<ChromeBoundaryProps, { failed: boolean }> {
  override state: { failed: boolean } = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[workbench] chrome crashed: ${this.props.region}`, error, info.componentStack);
    // Reported, not just logged. A chrome region that quietly disappears looks
    // to the operator like a feature that was never there — the one failure mode
    // nobody ever files a ticket about.
    reportCrash(error, { boundary: 'chrome', region: this.props.region });
    // A release purged the chunk this region needed. Nothing local can recover
    // that; the shared cooldown keeps a genuinely broken build from looping.
    if (isChunkLoadError(error)) reloadOnceForStaleBuild();
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.silent) return null;
    // Consequence, then reassurance, then the one thing to do — in that order,
    // because the first question is "did I just lose something?" and leaving it
    // unanswered is what makes an error message frightening. "Save your work
    // first" rather than a bare Reload: the panes are still holding drafts a
    // reload would discard, and this strip is the only place that knows it.
    const message = `${this.props.whatStopped} Anything you have open is safe — save your work, then reload.`;

    // A warning SURFACE, not warning-colored text on the page background. The
    // fallback stands in for regions with different chrome (the toolbar has a
    // bottom border, the status bar a top one, the rail none), so impersonating
    // each one would mean a variant per region. Carrying its own identity
    // instead reads correctly everywhere — and this is what `soft` is for: one
    // thing on screen, de-emphasised against nothing, deliberately tinted
    // because it is the exception. Ink comes from the treatment, never a text
    // color written on top.
    if (this.props.compact) {
      return (
        <div
          className="bg-warning bg-soft flex items-center justify-center rounded-md p-2"
          role="status"
          title={message}
        >
          <Icon glyph={faExclamationTriangle} className="size-5" aria-label={message} />
        </div>
      );
    }

    return (
      <div
        // The dev-only padding is the same allowance the status bar makes for
        // itself: Next's dev tools float bottom-left and the query devtools
        // bottom-right, and this strip most often stands in for that footer — so
        // without it the one control that recovers anything sits under a
        // framework button. Production floats neither.
        className={`bg-warning bg-soft border-warning flex items-center gap-2 border-y py-2 text-sm ${
          process.env.NODE_ENV === 'production' ? 'px-3' : 'px-14'
        }`}
        role="status"
      >
        <Icon glyph={faExclamationTriangle} className="size-4 shrink-0" aria-hidden />
        {/* Wraps rather than truncates. The sentence ENDS in the instruction, so
            clipping it drops the only actionable half and leaves a warning with
            no way out — a two-line strip is cheap by comparison, and this state
            is exceptional anyway. */}
        <span className="min-w-0 flex-1">{message}</span>
        <Button
          color="warning"
          variant="soft"
          size="sm"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </Button>
      </div>
    );
  }
}
