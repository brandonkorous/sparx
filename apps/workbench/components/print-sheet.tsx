'use client';

// PRINT SHEET — the one place the workbench hands a page to a printer.
//
// ── The bug this exists to fix ────────────────────────────────────────────
//
// `window.print()` prints the DOCUMENT, and the document here is the whole
// workbench: the rail, the launcher, the tab strips, the status bar, and every
// other pane that happens to be open. A `print:hidden` on a surface's own
// toolbar hides the toolbar and nothing else — so "print shelf labels" came out
// of the printer as a screenshot of the application with a couple of labels
// wedged into the corner of page one.
//
// ── Why it is not a CSS problem ───────────────────────────────────────────
//
// The obvious fix is to walk the sheet's ancestors in `@media print` and undo
// the shell — strip `overflow: hidden`, release `h-dvh`, hide each ancestor's
// other children. That cannot be done safely. Panes live in a dockview group
// that hides or wholly detaches the ones you are not looking at, and any rule
// forceful enough to unwind those ancestors is also forceful enough to bring a
// hidden pane back for the printout.
//
// So the sheet is rendered TWICE from one definition: once in place, which is
// the on-screen preview, and once through a portal into <body>, which is what
// the printer gets. Being a direct child of <body> is the whole trick — the
// print rules in app/globals.css then only have to hide body's OWN children,
// and never reach inside the dock at all.
//
// ── Why `data-print-sheet` is stamped at print time, not at render ────────
//
// The workbench keeps background panes mounted. Marking every portal eligible
// would mean a Ctrl+P printed labels from a pane nobody was looking at — or,
// with two label panes open, both sheets at once. So eligibility is decided in
// the `beforeprint` handler, from whether the on-screen copy is actually on
// screen.
//
// The attribute is set on the node directly rather than through React state
// because the portal's QR and barcode images must ALREADY be decoded when the
// browser takes its snapshot. Mounting the images inside `beforeprint` risks a
// sheet of empty squares; toggling one attribute on images that have been sat
// in the DOM since the pane opened cannot.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Fixed white and black, deliberately outside the theme: paper has no dark
 *  mode, and previewing a label in the app's colours would show something the
 *  printer will never produce. */
const SHEET = 'flex flex-wrap gap-2 bg-white p-2';

export function PrintSheet({ children, className }: { children: ReactNode; className?: string }) {
  // The portal cannot exist during the server render — <body> is not there yet.
  const [mounted, setMounted] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onBeforePrint = () => {
      const sheet = printRef.current;
      if (!sheet) return;
      const screen = screenRef.current;
      // `getClientRects()` is empty both for a node inside a `display: none`
      // pane and for one dockview has detached — which are exactly the two ways
      // a pane can be open without being on screen.
      const onScreen = screen != null && screen.isConnected && screen.getClientRects().length > 0;
      if (onScreen) sheet.setAttribute('data-print-sheet', '');
      // Cleared as well as set: `afterprint` does not always arrive (a cancelled
      // preview in some browsers), and a stale flag would print this pane's
      // sheet in place of whatever the operator is looking at next time.
      else sheet.removeAttribute('data-print-sheet');
    };
    const onAfterPrint = () => printRef.current?.removeAttribute('data-print-sheet');

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);

  const classes = className ? `${SHEET} ${className}` : SHEET;

  return (
    <>
      <div ref={screenRef} className={`${classes} print:hidden`}>
        {children}
      </div>
      {mounted
        ? createPortal(
            // `hidden` on screen; globals.css brings it back for print, but only
            // once `beforeprint` has judged this pane to be the visible one.
            <div ref={printRef} className={`${classes} hidden`}>
              {children}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
