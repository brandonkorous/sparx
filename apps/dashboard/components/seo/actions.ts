'use server';

// Server-action adapter for the SEO audit endpoint (docs/50 §7). Runs server-side
// so the api-rest JWT secret never reaches the browser; the client `SeoScoreChip`
// calls this on mount (editor) or first hover (lists).

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { EntityType, Scorecard } from '@sparx/seo-audit';

export interface SeoAuditResult {
  ok: boolean;
  data?: Scorecard;
  error?: string;
}

export async function getSeoAudit(type: EntityType, id: string): Promise<SeoAuditResult> {
  try {
    const data = await api.get<Scorecard>(
      `/v1/seo/audit?type=${type}&id=${encodeURIComponent(id)}`
    );
    return { ok: true, data };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'Could not run the SEO audit.' };
  }
}

export interface ReindexResult {
  ok: boolean;
  reindexed?: number;
  truncated?: boolean;
  error?: string;
}

/** Recompute + store a scorecard for every entity in the tenant. Powers the
 *  overview's "Re-scan" button. */
export async function reindexSeoAudits(): Promise<ReindexResult> {
  try {
    const r = await api.post<{ reindexed: number; truncated: boolean }>('/v1/seo/audits/reindex');
    return { ok: true, reindexed: r.reindexed, truncated: r.truncated };
  } catch (err) {
    const e = err as ApiRestError;
    return { ok: false, error: e.message ?? 'The re-scan failed.' };
  }
}
