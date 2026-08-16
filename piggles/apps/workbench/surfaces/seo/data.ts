'use client';

// Search / SEO data — how easily people find this site on a search engine, the
// checks that make that easier or harder, and the connection to Google's own
// numbers.
//
// This file OWNS every `['seo', …]` query key and the shapes the three SEO
// surfaces read: the per-page scorecards (`seo.audits`), the site-wide checklist
// and activity feed (`seo.performance`), the organic-search reports that come
// from Google Search Console, and the connection lifecycle for that link.
//
// The audience owns a business, not a search-engine console. So the vocabulary
// here is deliberately plain — a "score" is how well a page is set up to be
// found, a "check" is one thing worth getting right, and Google Search Console
// is "the free tool Google gives you". The helpers at the bottom translate the
// engine's terse enums (grade, status, entity type) into that language once, so
// every surface says the same thing.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── The page scorecard (from @sparx/seo-audit) ──────────────────────────── */

/** One graded thing about a page — a title, a description, its images. */
export interface AuditCheck {
    id: string;
    category: 'meta' | 'index' | 'content' | 'social';
    label: string;
    status: 'pass' | 'warn' | 'fail' | 'info';
    weight: number;
    earned: number;
    /** A short right-aligned value, e.g. "71 chars", "5 / 8 ok". */
    value?: string;
    /** One line on how to fix it, shown for warnings and failures. */
    tip?: string;
    action?: { label: string; target: string };
}

/** One of the four groups a page's checks roll up into. */
export interface AuditCategory {
    key: 'meta' | 'index' | 'content' | 'social';
    label: string;
    earned: number;
    max: number;
}

/** The full result of scoring one page. */
export interface Scorecard {
    entityType: EntityType;
    score: number;
    grade: Grade;
    categories: AuditCategory[];
    checks: AuditCheck[];
    /** The single most worthwhile fix, or null when nothing is wrong. */
    fixFirst: string | null;
    computedAt?: string;
}

/** One row in the site-wide list — a page and its latest score. */
export interface AuditRow {
    id: string;
    entityType: EntityType;
    entityId: string;
    score: number;
    grade: Grade;
    fixFirst: string | null;
    title: string | null;
    path: string | null;
    computedAt: string;
}

export type EntityType = 'builder_page' | 'cms_page' | 'product' | 'collection';
export type Grade = 'excellent' | 'good' | 'needs-work' | 'poor';

/* ── The site-wide technical checklist ───────────────────────────────────── */

/** One check, rolled up across every page that has been scored. */
export interface ChecklistCheck {
    id: string;
    label: string;
    category: string;
    status: 'pass' | 'warn' | 'fail' | 'info';
    pagesPass: number;
    pagesWarn: number;
    pagesFail: number;
    pagesScored: number;
    /** Fraction of scored pages that pass (0–1), or null when nothing is scored. */
    passRate: number | null;
}

export interface Checklist {
    summary: {
        pagesScored: number;
        checks: number;
        passing: number;
        warning: number;
        failing: number;
    };
    checks: ChecklistCheck[];
}

/** One recent scoring run, newest first — the activity feed. */
export interface ActivityRun {
    id: string;
    entityType: EntityType;
    entityId: string;
    title: string | null;
    path: string | null;
    score: number;
    grade: Grade;
    fixFirst: string | null;
    computedAt: string;
}

/* ── Organic search (Google Search Console) ──────────────────────────────── */

export interface OrganicSummary {
    clicks: number;
    impressions: number;
    /** Click-through rate as a fraction 0–1. */
    ctr: number;
    /** Average position in results, impression-weighted. */
    avgPosition: number;
}

export interface OrganicPoint {
    bucket: string;
    clicks: number;
    impressions: number;
}

export interface OrganicTimeseries {
    range: { from: string; to: string; grain: 'day' | 'week' | 'month' };
    points: OrganicPoint[];
    totals: { clicks: number; impressions: number };
}

export interface TopQuery {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

/** One site Google has verified against the connected Google account. */
export interface GscSite {
    siteUrl: string;
    permissionLevel: string;
}

export interface SearchConsoleConnection {
    /** 'connected' · 'needs_site' · 'disconnected' · 'error'. */
    status: string;
    siteUrl: string | null;
    lastSyncAt: string | null;
    lastError: string | null;
}

export interface SearchConsoleStatus {
    /** Whether the platform has Google credentials set up at all. When false the
     *  whole connection surface is inert — there is nothing an owner can do. */
    configured: boolean;
    connection: SearchConsoleConnection | null;
}

/* ── Query keys ──────────────────────────────────────────────────────────── */

export const SEO_KEYS = {
    audits: (type?: string) => ['seo', 'audits', type ?? 'all'] as const,
    audit: (type: string, id: string) => ['seo', 'audit', type, id] as const,
    checklist: ['seo', 'checklist'] as const,
    activity: ['seo', 'activity'] as const,
    organicSummary: ['seo', 'organic', 'summary'] as const,
    organicTimeseries: ['seo', 'organic', 'timeseries'] as const,
    topQueries: ['seo', 'organic', 'top-queries'] as const,
    searchConsole: ['seo', 'search-console'] as const,
};

/* ── Reads ───────────────────────────────────────────────────────────────── */

/** Every page's latest score, worst first — the whole point of the list is
 *  "what needs work". Filtered by type on the server when asked. */
export function useAudits(type?: EntityType) {
    return useQuery({
        queryKey: SEO_KEYS.audits(type),
        queryFn: () => api.get<AuditRow[]>('/v1/seo/audits', type ? { type } : undefined),
    });
}

/** One page's live scorecard. Recomputed fresh on read (and re-stored), so the
 *  detail is always the authoritative number even if the list is a little
 *  stale. */
export function useAudit(type: EntityType, id: string) {
    return useQuery({
        queryKey: SEO_KEYS.audit(type, id),
        queryFn: () => api.get<Scorecard>('/v1/seo/audit', { type, id }),
        enabled: Boolean(type && id),
    });
}

export function useChecklist() {
    return useQuery({
        queryKey: SEO_KEYS.checklist,
        queryFn: () => api.get<Checklist>('/v1/seo/reports/checklist'),
    });
}

export function useActivity(limit = 8) {
    return useQuery({
        queryKey: SEO_KEYS.activity,
        queryFn: () => api.get<ActivityRun[]>('/v1/seo/reports/activity', { limit }),
    });
}

/** Organic reports only make sense once Search Console is connected, so every
 *  one of these is gated on `enabled` by the caller — showing a wall of zeros
 *  as if it were real data is the exact mistake to avoid. */
export function useOrganicSummary(enabled: boolean) {
    return useQuery({
        queryKey: SEO_KEYS.organicSummary,
        queryFn: () => api.get<OrganicSummary>('/v1/seo/organic/summary'),
        enabled,
    });
}

export function useOrganicTimeseries(enabled: boolean) {
    return useQuery({
        queryKey: SEO_KEYS.organicTimeseries,
        queryFn: () => api.get<OrganicTimeseries>('/v1/seo/organic/timeseries', { grain: 'day' }),
        enabled,
    });
}

export function useTopQueries(enabled: boolean, limit = 8) {
    return useQuery({
        queryKey: SEO_KEYS.topQueries,
        queryFn: () => api.get<TopQuery[]>('/v1/seo/organic/top-queries', { limit }),
        enabled,
    });
}

export function useSearchConsoleStatus() {
    return useQuery({
        queryKey: SEO_KEYS.searchConsole,
        queryFn: () => api.get<SearchConsoleStatus>('/v1/seo/search-console/status'),
    });
}

/* ── Writes ──────────────────────────────────────────────────────────────── */

function useInvalidateAudits() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: ['seo', 'audits'] });
        void queryClient.invalidateQueries({ queryKey: SEO_KEYS.checklist });
        void queryClient.invalidateQueries({ queryKey: SEO_KEYS.activity });
    };
}

/** Re-score every page on the site. Returns how many were scored and whether the
 *  scan hit its per-type cap (a very large site). */
export function useReindexAudits() {
    const invalidate = useInvalidateAudits();
    return useMutation({
        mutationFn: () => api.post<{ reindexed: number; truncated: boolean }>('/v1/seo/audits/reindex'),
        onSuccess: () => {
            invalidate();
        },
    });
}

function useInvalidateSearchConsole() {
    const queryClient = useQueryClient();
    return () => {
        void queryClient.invalidateQueries({ queryKey: SEO_KEYS.searchConsole });
        void queryClient.invalidateQueries({ queryKey: ['seo', 'organic'] });
    };
}

/** Ask the server for the Google consent URL to send the owner to. `redirectUri`
 *  is where Google returns them — a page on this app that hands the code back. */
export function useConnectUrl() {
    return useMutation({
        mutationFn: (redirectUri: string) =>
            api.get<{ url: string }>('/v1/seo/search-console/connect-url', { redirect_uri: redirectUri }),
    });
}

/** Trade the code Google returned for a stored, encrypted connection. When the
 *  Google account has exactly one verified site it connects straight away;
 *  otherwise it comes back needing a site chosen from `sites`. */
export function useExchangeCode() {
    const invalidate = useInvalidateSearchConsole();
    return useMutation({
        mutationFn: (input: { code: string; state: string }) =>
            api.post<{ connection: SearchConsoleConnection | null; sites: GscSite[] }>(
                '/v1/seo/search-console/exchange',
                input
            ),
        onSuccess: () => {
            invalidate();
        },
    });
}

export function useSearchConsoleSites() {
    return useMutation({
        mutationFn: () => api.get<{ sites: GscSite[] }>('/v1/seo/search-console/sites'),
    });
}

export function useSelectSite() {
    const invalidate = useInvalidateSearchConsole();
    return useMutation({
        mutationFn: (siteUrl: string) =>
            api.post<{ connection: SearchConsoleConnection | null }>(
                '/v1/seo/search-console/select-site',
                { siteUrl }
            ),
        onSuccess: () => {
            invalidate();
        },
    });
}

export function useSyncSearchConsole() {
    const invalidate = useInvalidateSearchConsole();
    return useMutation({
        mutationFn: () =>
            api.post<{ sync: { days: number; queries: number }; connection: SearchConsoleConnection }>(
                '/v1/seo/search-console/sync'
            ),
        onSuccess: () => {
            invalidate();
        },
    });
}

export function useDisconnectSearchConsole() {
    const invalidate = useInvalidateSearchConsole();
    return useMutation({
        mutationFn: () => api.delete<{ disconnected: boolean }>('/v1/seo/search-console'),
        onSuccess: () => {
            invalidate();
        },
    });
}

/* ── Presentation helpers (shared, so every surface speaks alike) ─────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info';

/** How a page's overall score reads as a color. The engine's grade bands are
 *  the source of truth (excellent ≥90, good ≥70, needs-work ≥50, poor <50). */
export function scoreTone(grade: Grade): Tone {
    if (grade === 'excellent' || grade === 'good') return 'success';
    if (grade === 'needs-work') return 'warning';
    return 'error';
}

/** The grade in plain words. */
export function gradeLabel(grade: Grade): string {
    switch (grade) {
        case 'excellent':
            return 'Excellent';
        case 'good':
            return 'Good';
        case 'needs-work':
            return 'Needs work';
        case 'poor':
            return 'Poor';
    }
}

/** A single check's outcome as a color. `info` is not a problem — it is a fact
 *  shown for reassurance, so it stays neutral-blue rather than warning. */
export function checkTone(status: AuditCheck['status']): Tone {
    switch (status) {
        case 'pass':
            return 'success';
        case 'warn':
            return 'warning';
        case 'fail':
            return 'error';
        case 'info':
            return 'info';
    }
}

/** A check's outcome in plain words. */
export function checkStatusLabel(status: AuditCheck['status']): string {
    switch (status) {
        case 'pass':
            return 'Looking good';
        case 'warn':
            return 'Worth a look';
        case 'fail':
            return 'Needs fixing';
        case 'info':
            return 'For your information';
    }
}

/** What kind of page this is, in the owner's words rather than the schema's. */
export function entityLabel(type: EntityType): string {
    switch (type) {
        case 'builder_page':
            return 'Page';
        case 'cms_page':
            return 'Article';
        case 'product':
            return 'Product';
        case 'collection':
            return 'Collection';
    }
}

/** The params for opening a page's detail pane. Descriptor params must be plain
 *  strings (they round-trip through JSON and a URL), so the nullable title/path
 *  are only included when present rather than passed as null. */
export function auditDetailParams(row: {
    entityType: EntityType;
    entityId: string;
    title: string | null;
    path: string | null;
}): Record<string, string> {
    const params: Record<string, string> = { type: row.entityType, id: row.entityId };
    if (row.title) params.title = row.title;
    if (row.path) params.path = row.path;
    return params;
}

const NUMBER = new Intl.NumberFormat();

export function formatCount(n: number): string {
    return NUMBER.format(Math.max(0, Math.round(n)));
}

/** A click-through rate (0–1) as a percentage, e.g. 0.0421 → "4.2%". */
export function formatCtr(ctr: number): string {
    return `${(ctr * 100).toFixed(1)}%`;
}

/** An average position — lower is better, one decimal, e.g. 12.4. */
export function formatPosition(position: number): string {
    return position > 0 ? position.toFixed(1) : '—';
}

/**
 * The server's own sentence for a 4xx, which these routes write to be genuinely
 * useful ("Google did not return a refresh token — remove sparx from your Google
 * account permissions and reconnect", "Connect a Search Console site before
 * syncing"). A 5xx has no such sentence, so it falls back to the caller's words.
 */
export function seoErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return error.message;
    }
    return fallback;
}
