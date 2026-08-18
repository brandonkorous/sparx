'use client';

// The one loading state the whole workbench shares.
//
// Every pane, and the workspace itself while it boots, waits behind THIS — the
// brand's mascot with a patient, half-lidded "content" face, blinking on its
// idle loop. A single component so a slow surface, a booting dock, and a lazy
// chunk all read as the same recognisable "someone's on it" moment rather than
// three different spinners. Motion comes from @sparx/brand/mascot.css (imported
// once in globals); without it the face would sit frozen.
//
// ── WHICH MASCOT ────────────────────────────────────────────────────────────
//
// This component is rendered from `surface-mount.tsx`, which every SHARED
// surface loads behind — and shared surfaces are rendered by two shells now.
// Sparky in a Piggles console would be the one brand leak that reaches every
// pane in the app, so the mark comes from the product adapter (lib/product.ts)
// and falls back to sparx's when nothing has been registered. That fallback is
// what keeps sparx's own shell from having to configure anything.

import { SparkMascot } from '@sparx/brand/react';
import { productLoadingMark } from '../lib/product';
import { useDocumentTheme } from '../lib/use-document-theme';

// The mascot's face is two-tone — navy on a light surface, white on a dark one —
// so the loader reads the document's theme (see lib/use-document-theme) to pick
// the tone, and re-reads it live so a theme toggle mid-load flips the face too.

export function PaneWaiting({ label = 'Loading…' }: { label?: string }) {
  const theme = useDocumentTheme();
  const BrandMark = productLoadingMark();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6" role="status">
      {BrandMark ? (
        <BrandMark tone={theme} />
      ) : (
        <SparkMascot expression="content" tone={theme} size={72} bob blink title="Loading" />
      )}
      {/* A real ink token, never faded — a loading caption is text meant to be
          read. Kept small because the mascot is the signal; the word is support. */}
      <span className="text-sm">{label}</span>
    </div>
  );
}
