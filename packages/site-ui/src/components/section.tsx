// Section — the keystone layout archetype (docs/47 §11 B1). Re-homes the one bit
// of "box magic": a full-bleed background band with contained content. The outer
// element carries the surface fill / background photo + scrim + tone; the inner
// element constrains the content to the tenant container width (or runs full).
//
// SERVER component — markup + classes + the background style the renderer's box
// layer would otherwise compose. The `surface` axis is the shared role-var recipe
// (a colored band reads --c-bg / --c-fg); the background image goes through the
// existing `photoPanelStyle()` helper so it matches the storefront renderer
// exactly. `padding` is the section's own vertical-rhythm scale.

import * as React from 'react';
import type { Overlay, TextTone } from '@sparx/builder-schemas';
import { cx } from '../utils/cx';
import { photoPanelStyle } from '../utils/photo-panel';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export type SectionContentWidth = 'full' | 'contained';

export interface SectionProps {
  /** Surface color band — the shared role-var recipe (`.sf-c-*`). A band reads
   *  `--c-bg` for its fill and `--c-fg` for legible text. Omit for a transparent
   *  band. Any string is accepted so a runtime custom color works. */
  surface?: ColorKey | (string & {});
  /** Content width: `contained` (centered, capped at `--sf-container`) or `full`
   *  (edge-to-edge). Defaults to `contained`. */
  contentWidth?: SectionContentWidth;
  /** Vertical rhythm scale. Defaults to `lg`. */
  padding?: SizeKey;
  /** Full-bleed background image URL (composed via `photoPanelStyle`). */
  image?: string;
  /** Legibility scrim laid over the image. Defaults to `none`. */
  overlay?: Overlay;
  /** Text tone over the background, independent of surface. Defaults to `default`. */
  tone?: TextTone;
  /** Semantic element. Defaults to `section`. */
  as?: 'section' | 'div' | 'header' | 'footer' | 'article' | 'aside';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const PAD_CLASS: Record<SizeKey, string> = {
  xs: 'sf-section--pad-xs',
  sm: 'sf-section--pad-sm',
  md: 'sf-section--pad-md',
  lg: 'sf-section--pad-lg',
  xl: 'sf-section--pad-xl',
};

export function Section({
  surface,
  contentWidth = 'contained',
  padding = 'lg',
  image,
  overlay = 'none',
  tone = 'default',
  as = 'section',
  className,
  style,
  id,
  children,
}: SectionProps): React.ReactElement {
  const Tag = as as React.ElementType;
  // Only compose the photo style when there's actually an image, so the no-image
  // surface fill (CSS `--c-bg`) isn't clobbered by an inline `background:transparent`.
  const bg = image ? photoPanelStyle({ image, overlay, tone }) : undefined;
  return (
    <Tag
      className={cx('sf-section', colorClass(surface), PAD_CLASS[padding], className)}
      style={bg ? { ...bg, ...style } : style}
      id={id}
    >
      <div
        className={cx(
          'sf-section__inner',
          contentWidth === 'contained' ? 'sf-section__inner--contained' : 'sf-section__inner--full'
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
Section.displayName = 'Section';
