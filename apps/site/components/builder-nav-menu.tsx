'use client';

// Builder header nav (docs/62 D2). A `row`-oriented NavMenu in the Builder-
// rendered site chrome renders here instead of the static @sparx/site-ui NavMenu:
// inline links on desktop, a hamburger + slide-in drawer on phones. The swap is a
// viewport @media (the bar width ≈ viewport; the drawer is position:fixed), so it
// reuses the existing .sf-nav__toggle + .sf-drawer-* CSS (docs/62 D4/D5). Closes
// on route select, Escape, and backdrop click; locks body scroll while open.

import { useEffect, useState } from 'react';

export interface BuilderNavItem {
  label: string;
  url: string;
  openInNewTab?: boolean;
}

const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

function HamburgerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function BuilderNavMenu({
  items,
  className,
}: {
  items: BuilderNavItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const linkAttrs = (item: BuilderNavItem) =>
    item.openInNewTab ? { target: '_blank', rel: 'noreferrer noopener' } : {};

  return (
    <div className={cx('sf-builder-nav', className)}>
      {/* Inline links — desktop (hidden < 768px). Same markup the static NavMenu
          emits, so it inherits the .sf-nav--row styling. */}
      <nav className="sf-nav sf-nav--row sf-builder-nav__inline" aria-label="Primary">
        {items.map((item, i) =>
          item.label ? (
            <a
              key={`${i}-${item.label}`}
              href={item.url || '#'}
              className="sf-nav__item"
              {...linkAttrs(item)}
            >
              {item.label}
            </a>
          ) : null
        )}
      </nav>

      {/* Hamburger — phones (hidden >= 768px). */}
      <button
        type="button"
        className="sf-iconbtn sf-nav__toggle sf-builder-nav__toggle"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <HamburgerIcon />
      </button>

      {open ? (
        <div className="sf-drawer-backdrop" role="presentation">
          <button
            type="button"
            aria-label="Close navigation"
            className="sf-drawer-backdrop__close"
            onClick={() => setOpen(false)}
          />
          <nav className="sf-drawer-panel sf-drawer-panel--right" aria-label="Site navigation">
            <div className="sf-drawer-panel__head">
              <span className="sf-text sf-text--meta">Menu</span>
              <button
                type="button"
                className="sf-iconbtn"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="sf-drawer-panel__links">
              {items.map((item, i) =>
                item.label ? (
                  <a
                    key={`${i}-${item.label}`}
                    href={item.url || '#'}
                    onClick={() => setOpen(false)}
                    {...linkAttrs(item)}
                  >
                    {item.label}
                  </a>
                ) : null
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
BuilderNavMenu.displayName = 'BuilderNavMenu';
