// The sparx brand marks live in @sparx/brand (the single source of truth for the
// spark, the wordmark, and the mascot). market used to carry its own hardcoded
// copies; it now re-exports the canonical components so a brand refresh is a
// one-file change in @sparx/brand, never a per-app hunt. (market transpiles
// @sparx/brand and deliberately avoids the @sparx/ui shell graph — these leaf
// components have no such coupling.)
export { Spark, SparxMark, AppIcon, Wordmark, type WordmarkProps } from '@sparx/brand/react';
