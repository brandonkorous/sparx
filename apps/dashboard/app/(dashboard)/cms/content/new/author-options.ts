import 'server-only';

// Server-side loader for the content wizard's "Author & media" step. Lists the
// tenant's CMS authors and maps them to the minimal shape the client wizard
// needs to offer author attribution. Both the full-page `/new` route and the
// drawer/modal overlay (detail-slot) call this so the author picker behaves
// identically in either presentation. New authors created inline during the
// wizard are appended client-side, so a stale seed here is self-healing.
// Returns `[]` if the fetch fails — the picker then offers only "create new".

import { api } from '@/lib/api-rest-client';
import type { AuthorOption } from './content-entry-wizard';

interface WireAuthor {
  id: string;
  display_name: string;
}

export async function loadAuthorOptions(): Promise<AuthorOption[]> {
  try {
    const rows = await api.get<WireAuthor[]>('/v1/authors?take=250');
    return rows.map((a) => ({ id: a.id, displayName: a.display_name }));
  } catch {
    return [];
  }
}
