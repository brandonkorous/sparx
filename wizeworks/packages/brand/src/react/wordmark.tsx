import * as React from 'react';

// The WizeWorks wordmark: one word, medial capital W, with the `z` in pine.
//
// One letter carries the identity — the same move sparx makes with its "x",
// which gives a family resemblance without imitation. The `z` is the right
// letter because it is the name's own quirk: it is what makes it *Wize* and not
// *Wise*. Colouring the whole "ize" was the original brief; it was built and
// rejected, because it splits the read into "W-ize-Works" and dilutes a
// one-letter idea across three.
//
// Set as TYPE rather than shipped as the SVG asset, deliberately. The asset is
// 3492 × 798 and its colours are baked per surface (four files: light, dark,
// one-colour black, one-colour white); as type, the `z` reads from
// `--color-primary`, so it follows the theme in both modes with one component
// instead of a file-picking branch. The brand spec's own minimum — 92px wide,
// ≈20px cap-height — is what `size` defaults around.
//
// Spec: docs/wizeworks/04-brand-and-visual-identity.md §3.1.

export interface WordmarkProps {
  /** Cap height in px. Default 20, the spec's verified-legible minimum. */
  size?: number;
  /** Just the W, for a collapsed rail. The icon is the same letterform. */
  icon?: boolean;
  className?: string;
}

export function Wordmark({ size = 20, icon = false, className }: WordmarkProps) {
  const style: React.CSSProperties = {
    fontSize: size,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    // Inherits the surface's ink, so it works on the bone canvas and the warm
    // coal one without a second file.
    color: 'var(--color-base-content)',
    whiteSpace: 'nowrap',
  };

  if (icon) {
    return (
      <span className={className} style={style} aria-label="WizeWorks">
        W
      </span>
    );
  }

  return (
    <span className={className} style={style} aria-label="WizeWorks">
      Wi<span style={{ color: 'var(--color-primary)' }}>z</span>eWorks
    </span>
  );
}
