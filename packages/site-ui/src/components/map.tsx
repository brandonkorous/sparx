// Map — a keyless Google Maps embed (docs/46 §5.2). SERVER component. An
// explicit `embedUrl` wins; otherwise a `query` (place / address) is turned
// into an embed via `mapEmbed`. Neither → the placeholder.

import * as React from 'react';
import { EmbedFrame, type EmbedRatio } from './embed-frame';
import { mapEmbed } from '../utils/embed';

export interface MapProps {
  query?: string;
  embedUrl?: string;
  title?: string;
  ratio?: EmbedRatio;
  className?: string;
  style?: React.CSSProperties;
}

export function Map({
  query = '',
  embedUrl = '',
  title = 'Map',
  ratio = 'wide',
  className,
  style,
}: MapProps) {
  const src = mapEmbed(query, embedUrl) ?? undefined;
  return (
    <EmbedFrame
      src={src}
      title={title}
      ratio={ratio}
      placeholder="Add a place or address"
      className={className}
      style={style}
    />
  );
}
Map.displayName = 'Map';
