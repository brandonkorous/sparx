'use client';

// The writer's own published pages, for the editor's Link box.
//
// Linking one piece to another is daily work for a writer, and the box used to take
// a typed address only, so she had to open the other piece and copy its address out
// (persona P09). This finds published entries by title and gives each one the address
// the console already shows under its Web address box, so the two never disagree.

import * as React from 'react';
import { useQueryClient } from '@wizeworks/query';
import type { LinkSuggestion } from '@wizeworks/cms-editor/editor';
import { api } from '../../lib/api/client';
import { contentKeys, entryTitle, type ContentEntry, type ContentType } from './data';
import { entryHref } from './routable';

/** A stable search function for `ContentBlockEditor`'s `suggestLinks`. */
export function useLinkSuggest(): (query: string) => Promise<LinkSuggestion[]> {
  const queryClient = useQueryClient();
  return React.useCallback(
    async (query: string) => {
      const [types, found] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: contentKeys.types(),
          queryFn: () =>
            api.list<ContentType>('/v1/content/types', { take: 250 }).then((r) => r.items),
          staleTime: 5 * 60_000,
        }),
        api.list<ContentEntry>('/v1/content/entries', { q: query, status: 'published', take: 8 }),
      ]);
      const byKey = new Map(types.map((type) => [type.key, type]));
      return found.items.flatMap((entry) => {
        const type = byKey.get(entry.type_key);
        const href = entryHref(entry, type);
        return href ? [{ label: entryTitle(entry), href, hint: type?.name }] : [];
      });
    },
    [queryClient]
  );
}
