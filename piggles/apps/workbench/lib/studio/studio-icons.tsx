'use client';

// The builders' own glyphs, drawn in the console's icon set.
//
// `@wizeworks/studio` draws silica's baked Lucide, because a package serving two
// brands cannot pick one brand's icons. On a builder bar that puts Lucide chrome
// beside a FontAwesome Save, so the app answers `StudioHost.renderIcon` instead.
//
// Unnamed glyphs fall back to the baked set, which is the point of a map rather
// than a switch: layer rows keep silica's catalog icons, the bar wears ours.
// `menu` is the overflow trigger, the same glyph PaneToolbar's popup wears — one
// idea, one thing to learn.

import {
  faArrowRotateLeft,
  faArrowRotateRight,
  faBars,
  faDisplay,
  faFile,
  faMobileScreen,
  faMoon,
  faPlus,
  faSliders,
  faSun,
  faTabletScreen,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon, type IconGlyph } from '@piggles/ui';

/** The builder chrome, by the name the engine asks for. */
const CHROME: Record<string, IconGlyph> = {
  // The toolbar.
  undo: faArrowRotateLeft,
  redo: faArrowRotateRight,
  smartphone: faMobileScreen,
  tablet: faTabletScreen,
  monitor: faDisplay,
  sun: faSun,
  moon: faMoon,
  menu: faBars,
  // The narrow-screen column switch along the bottom.
  plus: faPlus,
  page: faFile,
  sliders: faSliders,
};

/** Draw one of the engine's glyphs, or nothing — which tells `StudioIcon` to fall
 *  back to the baked set rather than leave a hole where an icon should be. */
export function renderStudioIcon(name: string, className?: string) {
  const glyph = CHROME[name];
  if (!glyph) return null;
  // The class comes through rather than wrapping the result: FontAwesome sizes its
  // own svg, and a `size-4` on a box around it does nothing.
  return <Icon glyph={glyph} className={className} aria-hidden />;
}
