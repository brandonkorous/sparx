// @piggles/mascot — Piggles the character.
//
// The split across the three Piggles packages, so a value lands in one place
// rather than three:
//
//   @piggles/brand   what the BRAND looks like — tokens, the mark, group hues
//   @piggles/config  what the PRODUCT is — the app registry, the lexicon
//   @piggles/mascot  who the CHARACTER is — poses, when she appears, how she renders
//
// The brand mark and the mascot are genuinely different things and are wrong to
// merge: the mark is geometry that renders in `currentColor` at 16px in a favicon,
// the mascot is raster artwork that renders at 96–448px and never in a nav.
//
// Nothing here imports React, so this entrypoint is safe from an edge OG route, a
// worker, or an email renderer. The component lives behind ./react.
//
// ── THE CONTRACT ─────────────────────────────────────────────────────────────
//
//   <PigglesMascot intent="no-results" />     ← name the situation
//   <PigglesMascot app="bookings" />          ← or the app whose empty state it is
//   <PigglesMascot pose="celebrate" />        ← a pose only when the art IS the point
//
// Never a filename, and never a raw <img> against /mascot/*. The assets in each
// app's public/ directory are GENERATED — `pnpm --filter @piggles/mascot ingest`
// rewrites them wholesale, so anything referencing one by hand breaks silently the
// first time a pose is re-cut or retired.

export * from './catalog';
export * from './intents';
