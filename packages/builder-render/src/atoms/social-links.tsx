// SocialLinks — a row of the site's own social-platform links.
//
// silicaui has no social-links component and never will: the glyphs are OTHER
// COMPANIES' brand marks, which belong to the consuming product rather than to a
// design system. So this is a sparx component filling that gap (root CLAUDE.md
// RULE #1).
//
// Each mark is drawn in `currentColor` inside a real silica `btn btn-ghost
// btn-circle`, so the link inherits the surrounding ink and the theme's own hover
// treatment. No third-party brand colour is used, which is also why none of this
// needs a light/dark variant. An unknown platform falls back to its name as text,
// so a link is never silently dropped.
//
// SERVER component. Renders nothing when there are no items.

import * as React from 'react';
import { buttonClasses, cx } from '@wizeworks/silicaui-react/server';

export interface SocialItem {
  platform: string;
  url: string;
}

export interface SocialLinksProps {
  items: SocialItem[];
  className?: string;
}

// 24×24 brand glyphs (single-path where possible). Instagram is drawn as an
// outline (stroke); the rest are filled.
const ICONS: Record<string, React.ReactElement> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 4h4l4 5.5L16.5 4H20l-6 7.8L20.5 20H16l-4.2-5.8L7 20H3.5l6.3-8.2z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 3c.3 2 1.6 3.6 3.7 4v3c-1.4 0-2.7-.4-3.7-1.1V15a5 5 0 1 1-5-5c.3 0 .7 0 1 .1v3.1a2 2 0 1 0 1.4 1.9V3z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12zM10 15.5v-7l6 3.5z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.94 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM3 8.5h3.9V21H3zM9.5 8.5h3.7v1.7h.05c.5-.95 1.8-1.95 3.7-1.95 4 0 4.7 2.6 4.7 6V21h-3.9v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9.5z" />
    </svg>
  ),
  pinterest: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.5 2 4 5.6 4 8.8c0 1.9.7 3.6 2.3 4.2.3.1.5 0 .5-.3l.2-.8c.1-.3 0-.4-.2-.6-.4-.5-.7-1.1-.7-2 0-2.6 1.9-4.9 5-4.9 2.7 0 4.2 1.7 4.2 3.9 0 2.9-1.3 5.4-3.2 5.4-1 0-1.8-.9-1.6-1.9.3-1.3.9-2.6.9-3.5 0-.8-.4-1.5-1.3-1.5-1.1 0-1.9 1.1-1.9 2.6 0 .9.3 1.6.3 1.6l-1.3 5.4c-.3 1.4-.1 3.1 0 3.5 0 .1.2.2.3.1.1-.2 1.7-2 2.2-3.9l.8-3c.4.8 1.6 1.4 2.8 1.4 3.7 0 6.2-3.4 6.2-7.9C20 5.1 17.1 2 12 2z" />
    </svg>
  ),
  threads: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 11.3c-.1 0-.2-.1-.3-.1-.2-3-1.8-4.7-4.5-4.7-1.6 0-3 .7-3.8 2l1.4 1c.6-.9 1.5-1.1 2.4-1.1 1.5 0 2.3.9 2.5 2.4-.6-.1-1.2-.2-1.9-.2-2.6 0-4.3 1.4-4.2 3.3.1 1.7 1.6 2.8 3.4 2.8 1.4 0 2.5-.5 3.2-1.5.5-.7.7-1.5.8-2.4.8.5 1.4 1.2 1.4 2.3 0 1.8-1.9 4-5.9 4-3.5 0-5.9-2.4-5.9-6.4S8 5.6 11.5 5.6c2.7 0 4.6 1.2 5.5 3.4l1.7-.5c-1.1-2.9-3.7-4.6-7.2-4.6C7 3.9 4 7.1 4 12s3 8.1 7.7 8.1c4.9 0 7.7-3 7.7-5.9 0-1.9-1-3.2-2.6-3.9zm-4.8 4.3c-.9 0-1.7-.4-1.7-1.2 0-.7.7-1.3 2.2-1.3.6 0 1.1.1 1.6.2-.2 1.5-1 2.3-2.1 2.3z" />
    </svg>
  ),
};

const ALIAS: Record<string, string> = {
  twitter: 'x',
  ig: 'instagram',
  insta: 'instagram',
  fb: 'facebook',
  yt: 'youtube',
  li: 'linkedin',
};

function iconFor(platform: string): React.ReactElement | null {
  const key = platform.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ICONS[ALIAS[key] ?? key] ?? null;
}

export function SocialLinks({ items, className }: SocialLinksProps): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div className={cx('flex flex-wrap items-center gap-1', className)}>
      {items.map((item, i) => {
        const icon = iconFor(item.platform);
        return (
          <a
            key={`${i}-${item.platform}`}
            href={item.url || '#'}
            aria-label={item.platform || 'social link'}
            className={buttonClasses({
              variant: 'ghost',
              size: 'sm',
              shape: icon ? 'circle' : undefined,
              className: icon ? '[&>svg]:size-5' : undefined,
            })}
          >
            {icon ?? item.platform}
          </a>
        );
      })}
    </div>
  );
}
SocialLinks.displayName = 'SocialLinks';
