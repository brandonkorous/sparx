// SocialLinks — a row of platform links (docs/46 §5.2). SERVER component.
// Harvested from the site renderer's SocialLinks leaf. Renders nothing
// when there are no items.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface SocialItem {
  platform: string;
  url: string;
}

export interface SocialLinksProps {
  items: SocialItem[];
  className?: string;
  style?: React.CSSProperties;
}

export function SocialLinks({ items, className, style }: SocialLinksProps) {
  if (items.length === 0) return null;
  return (
    <div className={cx('st-social', className)} style={style}>
      {items.map((item, i) => (
        <a
          key={`${i}-${item.platform}`}
          href={item.url || '#'}
          aria-label={item.platform || 'social link'}
          className="st-social__link"
        >
          {item.platform}
        </a>
      ))}
    </div>
  );
}
SocialLinks.displayName = 'SocialLinks';
