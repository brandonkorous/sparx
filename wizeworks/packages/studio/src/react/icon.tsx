'use client';

// One glyph component, and no icon dependency of its own.
//
// silica bakes its icon set to inline SVG markup and hands it over through
// `iconSvg`, so this package renders icons without picking a library — which
// matters, because the two brands consuming it have picked different ones.
//
// That floor is right for a package and not enough inside an app. A builder's
// undo, its device buttons and its light/dark switch are drawn HERE; the Save and
// Publish beside them are drawn by the app, out of the app's own set. Two glyph
// families a few pixels apart read as two products, so a host may answer
// `renderIcon` and draw every one of them itself (host.ts). Nothing breaks if it
// does not — the baked set is still the floor.
//
// Sized in `em` by silica's own frame, so a text-size utility on the parent
// drives the glyph exactly as it would an icon font.

import { iconSvg } from '@wizeworks/silicaui-html';
import { useHostOrNull } from './context';

export function StudioIcon({ name, className }: { name: string; className?: string }) {
  // Not `useStudioHost`: this renders in rails, inspectors and tests that are not
  // always inside a provider, and a throwing hook would take those down.
  const host = useHostOrNull();

  const drawn = host?.renderIcon?.(name, className);
  if (drawn) return <>{drawn}</>;

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
