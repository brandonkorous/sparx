'use client';

/**
 * Docs sidebar nav tree. Renders the DOC_NAV registry (lib/docs.ts) and marks
 * the current route active via usePathname. `soon` pages render as disabled
 * labels with a "Soon" pill rather than dead links, so the full IA is visible.
 *
 * Two surfaces share the same tree (NavGroups):
 *   - DocsSidebar    — the sticky desktop aside (>820px)
 *   - DocsMobileNav  — a tap-to-open drawer (≤820px), so docs stay navigable
 *     on phones (the desktop sidebar is hidden there).
 *
 * The search field is presentational for now — a ⌘K command palette is a
 * planned follow-up; it focuses nothing yet.
 */
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { DOC_NAV, type DocBadge } from '@/lib/docs';

function Pill({ badge }: { badge: DocBadge }) {
  const cls =
    badge === 'new' ? 'docs-pill-new' : badge === 'beta' ? 'docs-pill-beta' : 'docs-pill-soon';
  const label = badge === 'new' ? 'New' : badge === 'beta' ? 'Beta' : 'Soon';
  return <span className={`docs-pill ${cls}`}>{label}</span>;
}

function SearchBox() {
  return (
    <div className="docs-search" role="search" aria-label="Search docs (coming soon)">
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={2} />
        <path d="M21 21L16.5 16.5" stroke="currentColor" strokeWidth={2} />
      </svg>
      <span>Search docs</span>
      <span className="kbd">⌘K</span>
    </div>
  );
}

function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {DOC_NAV.map((group) => (
        <div key={group.key} className="docs-nav-group">
          <div className="label">{group.title}</div>
          {group.links.map((link) => {
            if (link.soon) {
              return (
                <span key={link.href} className="docs-nav-link soon" aria-disabled>
                  {link.title}
                  <Pill badge={link.badge ?? 'soon'} />
                </span>
              );
            }
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={active ? 'docs-nav-link active' : 'docs-nav-link'}
                aria-current={active ? 'page' : undefined}
              >
                {link.title}
                {link.badge ? <Pill badge={link.badge} /> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function DocsSidebar() {
  return (
    <aside className="docs-sidebar">
      <SearchBox />
      <NavGroups />
    </aside>
  );
}

export function DocsMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="docs-mobilebar">
      <button
        type="button"
        className="docs-mobile-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
          {open ? (
            <path d="M5 5L19 19M5 19L19 5" stroke="currentColor" strokeWidth={1.8} />
          ) : (
            <path d="M3 7H21M3 12H21M3 17H21" stroke="currentColor" strokeWidth={1.8} />
          )}
        </svg>
        Documentation
      </button>
      {open ? (
        <div className="docs-drawer open">
          <SearchBox />
          <NavGroups onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
