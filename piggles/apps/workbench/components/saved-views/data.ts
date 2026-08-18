'use client';

// A saved view stores the QUESTION — the filters, the sort, the columns — and
// never the rows it produced. That is what makes "Running low at the warehouse"
// mean the same thing in March as it did in January.
//
// CRM keeps its own views over its own table, for its object-key vocabulary
// (surfaces/crm/saved-views-menu.tsx). This is the platform one, and any list
// can use it. docs/146 Phase 10.2.

import { useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';

export interface SavedViewConfig {
  /** The list's own filter vocabulary, as strings. Opaque on purpose: a new
   *  filter on any list must never need a change in this component. */
  params: Record<string, string>;
}

export interface SavedView {
  id: string;
  target: string;
  name: string;
  config: SavedViewConfig;
  isDefault: boolean;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One column a list can show. `required` marks the one or two that identify a
 *  row — a table with no name column is a grid of numbers. */
export interface ColumnOption {
  key: string;
  label: string;
  required?: boolean;
}

export const savedViewKeys = {
  list: (target: string) => ['saved-views', target] as const,
};

export function useSavedViews(target: string) {
  return useQuery({
    queryKey: savedViewKeys.list(target),
    queryFn: () => api.get<{ items: SavedView[] }>('/v1/saved-views', { target }),
    staleTime: 60_000,
  });
}

export function useInvalidateViews(target: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: savedViewKeys.list(target) });
  };
}

/** Drop empty values so "filter cleared" and "filter never set" compare equal —
 *  otherwise a saved view never matches the list that produced it. */
export function normalise(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

/** Read the column list out of a saved view's params, falling back to the list's
 *  own default set. Every list applying a view needs the same reading of it. */
export function columnsFromView(params: Record<string, string>, fallback: string[]): string[] {
  const raw = params.columns;
  if (!raw) return fallback;
  const keys = raw.split(',').filter((key) => key !== '');
  return keys.length > 0 ? keys : fallback;
}
