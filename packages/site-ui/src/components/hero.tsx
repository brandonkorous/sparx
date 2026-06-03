// Hero — a prominent banner with optional background photo (docs/46 §5.2). SERVER
// component. Like Section but hero-specific: a min-height stage with centered (or
// edge-aligned) content; background via the shared `photoPanelStyle` (+ overlay/
// tone). Structural (the surface color comes from `photoPanelStyle`/children).

import * as React from 'react';
import type { Overlay, TextTone } from '@sparx/builder-schemas';
import { cx } from '../utils/cx';
import { photoPanelStyle } from '../utils/photo-panel';

export type HeroAlign = 'start' | 'center' | 'end';

export interface HeroProps {
  image?: string;
  overlay?: Overlay;
  tone?: TextTone;
  /** Content alignment. Defaults to `center`. */
  align?: HeroAlign;
  /** Minimum stage height (number → px). Defaults to `26rem`. */
  minHeight?: number | string;
  as?: 'section' | 'div' | 'header';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const dim = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v);

export function Hero({
  image,
  overlay = 'none',
  tone = 'default',
  align = 'center',
  minHeight = '26rem',
  as = 'section',
  className,
  style,
  id,
  children,
}: HeroProps): React.ReactElement {
  const Tag = as as React.ElementType;
  const bg = image ? photoPanelStyle({ image, overlay, tone }) : undefined;
  return (
    <Tag
      className={cx('sf-hero', `sf-hero--align-${align}`, className)}
      style={{ minHeight: dim(minHeight), ...bg, ...style }}
      id={id}
    >
      <div className="sf-hero__content">{children}</div>
    </Tag>
  );
}
Hero.displayName = 'Hero';
