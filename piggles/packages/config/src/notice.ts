// The header notice: what Piggles announces above every page right now, authored
// in the admin console and served by api-rest. Shared so all three surfaces say
// the same thing. SERVER ONLY: one cached fetch per render, never per visitor.

import { apiOrigin, REVALIDATE_ONE_MINUTE } from './api-origin';

/** A notice as it is shown: none of the operator's window, switch or audit fields. */
export interface HeaderNotice {
  id: string;
  message: string;
  linkLabel: string | null;
  linkHref: string | null;
  /** A silica color name — the bar resolves its own ink from it. */
  tone: 'primary' | 'info' | 'success' | 'warning' | 'danger';
  dismissible: boolean;
}

export type NoticeSurface = 'marketing' | 'account' | 'console';

/** The one notice for this surface, or null. NEVER THROWS: a layout calls this,
 *  and a missing banner must not take out every page. Cached a minute. */
export async function fetchHeaderNotice(surface: NoticeSurface): Promise<HeaderNotice | null> {
  try {
    const url = `${apiOrigin()}/v1/public/announcements?brand=piggles&surface=${surface}`;
    const res = await fetch(url, REVALIDATE_ONE_MINUTE);
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const announcement = (body as { data?: { announcement?: HeaderNotice | null } })?.data
      ?.announcement;
    return announcement ?? null;
  } catch {
    return null;
  }
}
