// Video — a YouTube embed (docs/46 §5.2). SERVER component. Derives a
// privacy-friendly embed URL from any YouTube link via `youtubeEmbed`, then
// renders it through EmbedFrame. An unusable/empty url shows the placeholder.

import * as React from 'react';
import { EmbedFrame, type EmbedRatio } from './embed-frame';
import { youtubeEmbed } from '../utils/embed';

export interface VideoProps {
  url: string;
  title?: string;
  ratio?: EmbedRatio;
  className?: string;
  style?: React.CSSProperties;
}

export function Video({ url, title = 'Video', ratio = 'wide', className, style }: VideoProps) {
  const src = youtubeEmbed(url) ?? undefined;
  return (
    <EmbedFrame
      src={src}
      title={title}
      ratio={ratio}
      placeholder="Add a YouTube link"
      className={className}
      style={style}
    />
  );
}
Video.displayName = 'Video';
