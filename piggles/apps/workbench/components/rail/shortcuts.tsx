'use client';

// Yours, above the product: the screens this person favourited, and the ones
// they were just in.
//
// EACH IS ONE ROW, at every rail width. Both lists open into the app panel —
// the subrail — exactly as an app does, and for the same reason: the rail is the
// one element a person looks at every day, so it holds the NAMES of things and
// nothing else. Five favourites plus five recents plus fifteen apps is
// twenty-five rows in a column that has to stay readable at a glance; two rows
// plus fifteen apps is a rail you can still scan.
//
// This started as the collapsed-only treatment — five nameless icons above
// fifteen more is where people lose the rail — and the expanded rail had the
// same problem for the same reason, in words instead of glyphs.
//
// So there is no second shape any more: no inline rows, no fold on Recent, no
// per-row remove here. Managing either list happens where the list is opened up
// (../panel/shortcut-panel.tsx), which is also where Clear lives.
//
// Favourites is ALWAYS here, empty or not — a row that only exists once you have
// used a feature cannot teach you the feature; opened, it says how to fill it.
// Recent is not: a history nobody has made yet is a row that names nothing.

import { faClockRotateLeft, faStar } from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '@/lib/surfaces/registry';
import { ListRow } from './surface-row';

interface ShortcutRowProps {
  /** True while the panel is showing this list. */
  browsing: boolean;
  /** Labels showing beside the icons, so the row can drop its tooltip. */
  expanded: boolean;
  onBrowseList: () => void;
}

export function Favourites({ browsing, expanded, onBrowseList }: ShortcutRowProps) {
  return (
    <ListRow
      label="Favourites"
      glyph={faStar}
      outline
      active={browsing}
      expanded={expanded}
      onClick={onBrowseList}
    />
  );
}

export function Recent({
  surfaces,
  browsing,
  expanded,
  onBrowseList,
}: ShortcutRowProps & { surfaces: SurfaceDefinition[] }) {
  if (surfaces.length === 0) return null;

  return (
    <ListRow
      label="Recent"
      glyph={faClockRotateLeft}
      active={browsing}
      expanded={expanded}
      onClick={onBrowseList}
    />
  );
}
