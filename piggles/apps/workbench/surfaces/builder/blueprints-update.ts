'use client';

// Updating an installed design to a newer version of itself.
//
// Split out of blueprints-data because it is its own concern: a three-way merge
// with a preview, a version pair and a conflict story, which nothing else in the
// gallery has to know about. Reads and writes both go through the same query keys
// so the pane stays in step.

import { useMutation, useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { blueprintKeys, useInvalidateBlueprints } from './blueprints-data';

/** The preview of what updating an install to the catalog's current version would
 *  change — a three-way merge summary. `new` are artifacts the new version adds
 *  (e.g. a page the design didn't have before), `updated` fast-forward cleanly,
 *  `conflicts` are things BOTH you and the design changed (kept on your side by
 *  default). `updatable` is false when there is nothing newer to apply. */
export interface UpdatePlanSummary {
  updated: number;
  conflicts: number;
  auto: number;
  new: number;
  removed: number;
}
export interface UpdatePlan {
  installId: string;
  blueprintKey: string;
  fromVersion: string;
  toVersion: string;
  updatable: boolean;
  summary: UpdatePlanSummary;
}
export interface UpdateResult {
  installId: string;
  fromVersion: string;
  toVersion: string;
  applied: number;
  conflicts: number;
}

/** Preview the update for one install (read-only — nothing is written). Enabled only
 *  when an update is actually available, so the pane doesn't fetch a plan for an
 *  up-to-date install. Not cached: the catalog can move, so a preview is always fresh. */
export function useUpdatePlan(installId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...blueprintKeys.installs(), 'update-plan', installId],
    queryFn: () => api.get<UpdatePlan>(`/v1/blueprints/installs/${installId}/update`),
    enabled: enabled && installId !== '',
    staleTime: 0,
  });
}

/** Apply the update — the three-way merge onto the install, keeping every edit you
 *  made by default (conflicts resolve to YOUR value; docs/55 U1). A live install
 *  re-publishes; a draft install stays draft. This is how a site picks up new pages a
 *  design added in a later version (e.g. the bespoke product page) without a
 *  delete-and-reinstall that would drop what you built on top. */
export function useUpdateInstall() {
  const invalidate = useInvalidateBlueprints();
  return useMutation({
    mutationFn: (installId: string) =>
      api.post<UpdateResult>(`/v1/blueprints/installs/${installId}/update`, { take_theirs: [] }),
    onSuccess: () => {
      invalidate();
    },
  });
}
