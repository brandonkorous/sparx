'use client';

/**
 * "On this page" table of contents with scroll-spy. The page passes an explicit
 * list of heading anchors (matching the ids on its <DocSection> components);
 * an IntersectionObserver highlights whichever section is currently in view.
 *
 * Explicit items (rather than DOM-scraping) keeps this a server-authored
 * contract: the author lists the same ids they gave their sections.
 */
import { useEffect, useState } from 'react';

export interface TocItem {
  id: string;
  label: string;
  /** Indented sub-entry (an h3 under an h2). */
  sub?: boolean;
}

export function OnThisPage({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const targets = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost visible section.
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveId(top.target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <aside className="docs-toc">
      <div className="label">On this page</div>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={[item.sub ? 'sub' : '', activeId === item.id ? 'active' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {item.label}
        </a>
      ))}
    </aside>
  );
}
