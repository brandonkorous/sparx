'use server';

// Server-action adapters for the Search Console connection (docs/50 §7). Each
// runs server-side so the api-rest JWT secret never reaches the browser. The
// connect flow returns the Google consent URL the client navigates to; the
// dashboard-hosted callback route posts the code back via /exchange.

import { api, type ApiRestError } from '@/lib/api-rest-client';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? '';
const CALLBACK_PATH = '/seo/search-console/callback';

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

function fail(err: unknown, fallback: string): ActionResult<never> {
  const e = err as ApiRestError;
  return { ok: false, error: e.message ?? fallback };
}

/** Build the Google consent URL (the client then navigates the browser there). */
export async function startSearchConsoleConnect(): Promise<ActionResult<{ url: string }>> {
  try {
    const callbackUrl = `${DASHBOARD_URL}${CALLBACK_PATH}`;
    const data = await api.get<{ url: string }>(
      `/v1/seo/search-console/connect-url?redirect_uri=${encodeURIComponent(callbackUrl)}`
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Could not start the Search Console connection.');
  }
}

/** The verified sites the grant can read — shown in the site picker. */
export async function listSearchConsoleSites(): Promise<ActionResult<{ sites: GscSite[] }>> {
  try {
    const data = await api.get<{ sites: GscSite[] }>('/v1/seo/search-console/sites');
    return { ok: true, data };
  } catch (err) {
    return fail(err, 'Could not load your Search Console sites.');
  }
}

/** Choose a site → connects it and runs the first ingestion. */
export async function selectSearchConsoleSite(siteUrl: string): Promise<ActionResult> {
  try {
    await api.post('/v1/seo/search-console/select-site', { siteUrl });
    return { ok: true };
  } catch (err) {
    return fail(err, 'Could not connect that site.');
  }
}

/** Re-ingest the latest Search Console data now. */
export async function syncSearchConsole(): Promise<ActionResult<{ days: number; queries: number }>> {
  try {
    const data = await api.post<{ sync: { days: number; queries: number } }>(
      '/v1/seo/search-console/sync'
    );
    return { ok: true, data: data.sync };
  } catch (err) {
    return fail(err, 'The Search Console sync failed.');
  }
}

/** Disconnect — clears the stored grant (the historical rollup is retained). */
export async function disconnectSearchConsole(): Promise<ActionResult> {
  try {
    await api.delete('/v1/seo/search-console');
    return { ok: true };
  } catch (err) {
    return fail(err, 'Could not disconnect Search Console.');
  }
}
