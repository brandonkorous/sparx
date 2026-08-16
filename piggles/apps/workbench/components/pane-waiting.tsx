'use client';

// The one loading state the whole console shares.
//
// Every pane, and the workspace itself while it boots, waits behind THIS. A
// single component so a slow surface, a booting dock, and a lazy chunk all read
// as the same recognisable "someone's on it" moment rather than three different
// spinners.
//
// The picture is Piggles', resolved through the product adapter: `StateArt`
// first (lib/console/state-art.tsx draws every state as a POSE, waiting
// included), then the registered loading mark. Both are configured at module
// scope in lib/console/product.tsx, so neither branch below can be empty.
//
// There is no third fallback. This file carried one to sparx's mascot, which was
// unreachable the moment Piggles registered `StateArt` and was a build-time
// dependency on another brand's artwork for a branch that could never run.

import { productCopy, productLoadingMark } from '../lib/product';
import { useDocumentTheme } from '../lib/use-document-theme';
import { stateArtNode } from './state-art';

// The mascot's face is two-tone — navy on a light surface, white on a dark one —
// so the loader reads the document's theme (see lib/use-document-theme) to pick
// the tone, and re-reads it live so a theme toggle mid-load flips the face too.

export function PaneWaiting({ label, module }: { label?: string; module?: string }) {
  const theme = useDocumentTheme();
  const BrandMark = productLoadingMark();
  // A brand that draws its states gets first refusal, because a CHARACTER
  // waiting with you is a warmer thing than a logo — and it puts waiting in the
  // same family as empty and failed instead of leaving it the odd one out.
  const art = stateArtNode('waiting', module);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6" role="status">
      {art ?? (BrandMark ? <BrandMark tone={theme} /> : null)}
      {/* A real ink token, never faded — a loading caption is text meant to be
          read. Kept small because the picture is the signal; the word is
          support. Through the copy seam because "Loading…" is a technical word
          for the moment every person in the product meets most often. */}
      <span className="text-sm">{label ?? productCopy('pane.waiting', 'Loading…')}</span>
    </div>
  );
}
