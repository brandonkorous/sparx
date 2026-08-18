'use client';

// One glyph component, and no icon dependency.
//
// silica bakes its icon set to inline SVG markup and hands it over through
// `iconSvg`, so this package renders icons without picking a library — which
// matters, because the two brands consuming it have picked different ones. A host
// that wants its own set overrides `renderIcon`; everything still works if it
// doesn't.
//
// Sized in `em` by silica's own frame, so a text-size utility on the parent
// drives the glyph exactly as it would an icon font.

import { iconSvg } from '@wizeworks/silicaui-html';

export function StudioIcon({ name, className }: { name: string; className?: string }) {
  const markup = iconSvg(name);
  if (!markup) {
    // An unknown name is a bug in a catalog, not a reason to shift every row in a
    // list by the width of a missing glyph.
    return <span className={className} aria-hidden />;
  }
  return (
    <span
      className={className}
      aria-hidden
      // silica's own markup, generated at build time from Lucide — not user content.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
