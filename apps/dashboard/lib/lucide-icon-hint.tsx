'use client';

// Icon-name input affordance.
//
// Several schema-driven fields ask a merchant to type the *name* of a Lucide
// icon (e.g. "truck", "shield-check") — most users have no idea what "Lucide"
// is or where the names come from. Wherever such a field renders, we drop a
// link to the searchable icon gallery so they can find and copy a name.
//
// Detection is intentionally loose (any help text mentioning a "lucide icon")
// so the link attaches to the built-in `feature.icon` field, its already-seeded
// copy in the DB, and any future content-type or site-builder field documented
// the same way — no new field type or migration required.

import { ExternalLink } from 'lucide-react';
import { cn } from '@sparx/ui';

export const LUCIDE_ICONS_URL = 'https://lucide.dev/icons/';

export function isLucideIconField(helpText?: string | null): boolean {
  return !!helpText && /lucide\s*icon/i.test(helpText);
}

/** Inline "Browse icons" link rendered beneath an icon-name input. */
export function LucideIconLink({ className }: { className?: string }) {
  return (
    <a
      href={LUCIDE_ICONS_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex w-fit items-center gap-1 text-xs text-[var(--module-active)] hover:underline',
        className
      )}
    >
      Browse icons
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
