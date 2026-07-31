'use client';

// The one loading state the whole workbench shares.
//
// Every pane, and the workspace itself while it boots, waits behind THIS — the
// brand mascot with a patient, half-lidded "content" face, blinking on its idle
// loop. A single component so a slow surface, a booting dock, and a lazy chunk
// all read as the same recognisable "sparky's on it" moment rather than three
// different spinners. Motion comes from @sparx/brand/mascot.css (imported once
// in globals); without it the face would sit frozen.

import { SparkMascot } from '@sparx/brand/react';
import { useDocumentTheme } from '../lib/use-document-theme';

// The mascot's face is two-tone — navy on a light surface, white on a dark one —
// so the loader reads the document's theme (see lib/use-document-theme) to pick
// the tone, and re-reads it live so a theme toggle mid-load flips the face too.

export function PaneWaiting({ label = 'Loading…' }: { label?: string }) {
  const theme = useDocumentTheme();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6" role="status">
      <SparkMascot expression="content" tone={theme} size={72} bob blink title="Loading" />
      {/* A real ink token, never faded — a loading caption is text meant to be
          read. Kept small because the mascot is the signal; the word is support. */}
      <span className="text-sm">{label}</span>
    </div>
  );
}
