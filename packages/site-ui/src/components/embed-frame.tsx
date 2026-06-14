// EmbedFrame — a responsive, ratio-locked iframe wrapper (docs/46 §5.2). SERVER
// component (an <iframe> needs no client runtime). Harvested from the site
// renderer's `embedFrame`. With no `src` it renders an accessible placeholder in
// the same ratio box (the unconfigured state shown in the editor canvas).

import * as React from 'react';
import { cx } from '../utils/cx';

export type EmbedRatio = 'wide' | 'square' | 'portrait' | 'pano';

export interface EmbedFrameProps {
  src?: string;
  title: string;
  ratio?: EmbedRatio;
  /** Shown in the ratio box when there's no `src`. Defaults to `title`. */
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

const RATIO_CLASS: Record<EmbedRatio, string> = {
  wide: 'st-embed--wide',
  square: 'st-embed--square',
  portrait: 'st-embed--portrait',
  pano: 'st-embed--pano',
};

export function EmbedFrame({
  src,
  title,
  ratio = 'wide',
  placeholder,
  className,
  style,
}: EmbedFrameProps) {
  const classes = cx('st-embed', RATIO_CLASS[ratio], className);
  if (!src) {
    return (
      <div className={classes} style={style}>
        <span className="st-embed__placeholder">{placeholder ?? title}</span>
      </div>
    );
  }
  return (
    <div className={classes} style={style}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="st-embed__frame"
      />
    </div>
  );
}
EmbedFrame.displayName = 'EmbedFrame';
