'use client';

/**
 * Docs sidebar nav tree. Renders the DOC_NAV registry (lib/docs.ts) and marks
 * the current route active via usePathname. `soon` pages render as disabled
 * labels with a "Soon" pill rather than dead links, so the full IA is visible.
 *
 * The search field is presentational for now — a ⌘K command palette is a
 * planned follow-up; it focuses nothing yet.
 */
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { DOC_NAV, type DocBadge } from '@/lib/docs';

function Pill({ badge }: { badge: DocBadge }) {
  const cls =
    badge === 'new' ? 'docs-pill-new' : badge === 'beta' ? 'docs-pill-beta' : 'docs-pill-soon';
  const label = badge === 'new' ? 'New' : badge === 'beta' ? 'Beta' : 'Soon';
  return <span className={`docs-pill ${cls}`}>{label}</span>;
}

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="docs-sidebar">
      <div className="docs-search" role="search" aria-label="Search docs (coming soon)">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={2} />
          <path d="M21 21L16.5 16.5" stroke="currentColor" strokeWidth={2} />
        </svg>
        <span>Search docs</span>
        <span className="kbd">⌘K</span>
      </div>

      {DOC_NAV.map((group) => (
        <div key={group.key} className="docs-nav-group">
          <div className="label">{group.title}</div>
          {group.links.map((link) => {
            const active = pathname === link.href;
            if (link.soon) {
              return (
                <span key={link.href} className="docs-nav-link soon" aria-disabled>
                  {link.title}
                  {link.badge ? <Pill badge={link.badge} /> : <Pill badge="soon" />}
                </span>
              );
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`docs-nav-link${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {link.title}
                {link.badge ? <Pill badge={link.badge} /> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
