'use server';

// Sample-data actions — back the settings → Sample data panel. They talk to the
// /v1/sample-data seam, which loads (or clears) the tenant's industry dataset
// across its enabled modules. The page reads status via `api.get`; these perform
// the load/clear (admin+ — bulk, cross-module, like the Industry + Modules pages).

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';

export interface SampleDataCounts {
  products: number;
  collections: number;
  categories: number;
  articles: number;
  customers: number;
  orders: number;
  returns: number;
  reviews: number;
  questions: number;
  bookings: number;
  quotes: number;
  deals: number;
  billingDocuments: number;
  bundles: number;
  movements: number;
  images: number;
  aiPrompts: number;
  toolCalls: number;
}

export interface SampleDataStatus {
  industry: string | null;
  packIndustry: string;
  packLabel: string;
  packSummary: string;
  modules: string[];
  loaded: boolean;
  counts: SampleDataCounts;
}

export type SampleDataActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function fail(err: unknown): { ok: false; error: { code: string; message: string } } {
  const e = err as ApiRestError;
  return {
    ok: false,
    error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unexpected error' },
  };
}

export async function loadSampleDataAction(): Promise<
  SampleDataActionResult<{ pack: string; counts: SampleDataCounts }>
> {
  try {
    const data = await api.post<{ pack: string; counts: SampleDataCounts }>(
      '/v1/sample-data/load',
      {}
    );
    revalidatePath('/settings/sample-data');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function clearSampleDataAction(): Promise<
  SampleDataActionResult<{ counts: SampleDataCounts }>
> {
  try {
    const data = await api.post<{ counts: SampleDataCounts }>('/v1/sample-data/clear', {});
    revalidatePath('/settings/sample-data');
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}
