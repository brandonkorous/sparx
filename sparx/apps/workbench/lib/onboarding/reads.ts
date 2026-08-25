'use client';

// Every onboarding READ, plus the two derivations the reads need: a dashboard CTA
// href mapped onto a workbench surface, and where the Launch step's Preview points.
//
// Split out of api.ts so the reads stay reads and the writes stay writes.

import { useQuery } from '@wizeworks/query';
import { api } from '../api/client';
import type {
  OnboardingProgress,
  OnboardingState,
  RawOnboardingProgress,
  WizardBlueprint,
} from './types';

/* ── Query keys ─────────────────────────────────────────────────────────────
   One place, so an invalidation and a read can never disagree on the string. */
export const ONBOARDING_KEY = ['tenant', 'onboarding'] as const;
export const ONBOARDING_PROGRESS_KEY = ['tenant', 'onboarding', 'progress'] as const;
export const BLUEPRINTS_KEY = ['blueprints'] as const;
export const ONBOARDING_MODULES_KEY = ['tenant', 'modules'] as const;

/* ── Reads ──────────────────────────────────────────────────────────────────── */

/** The raw persisted onboarding state (settings.onboarding). The gate reads this to
 *  decide whether onboarding is finished and which flow to mount. */
export function useOnboarding() {
  return useQuery({
    queryKey: ONBOARDING_KEY,
    queryFn: () => api.get<OnboardingState>('/v1/tenant/onboarding'),
    staleTime: 30_000,
  });
}

/** The tenant's current module flags, as the switchboard's starting state. */
export function useOnboardingModules() {
  return useQuery({
    queryKey: ONBOARDING_MODULES_KEY,
    queryFn: () => api.get<{ slug: string; enabled: boolean }[]>('/v1/tenant/modules'),
    staleTime: 60_000,
  });
}

interface BlueprintDto {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: WizardBlueprint['vertical'];
  preview?: string | null;
  /** The API field is `requiredModules` (with a d) — the gallery filters on it. */
  requiredModules: string[];
  contents: WizardBlueprint['contents'];
  install: WizardBlueprint['install'];
}

/** The template catalog for the gallery. Only blueprints with a real preview
 *  screenshot show at first run — a polished showcase, never a placeholder. */
export function useBlueprints() {
  return useQuery({
    queryKey: BLUEPRINTS_KEY,
    queryFn: async (): Promise<WizardBlueprint[]> => {
      const { items } = await api.list<BlueprintDto>('/v1/blueprints', { take: 250 });
      return items
        .filter((b) => Boolean(b.preview))
        .map((b) => ({
          key: b.key,
          version: b.version,
          name: b.name,
          summary: b.summary,
          vertical: b.vertical,
          preview: b.preview ?? null,
          requiresModules: b.requiredModules ?? [],
          contents: b.contents,
          install: b.install,
        }));
    },
    staleTime: 300_000,
  });
}

/** The derived welcome checklist. api-rest returns CTAs as hrefs (its dashboard
 *  shape); the workbench has no routes, so each href is mapped to a surface to open
 *  here — the one place that translation lives. */
export function useOnboardingProgress() {
  return useQuery({
    queryKey: ONBOARDING_PROGRESS_KEY,
    queryFn: async (): Promise<OnboardingProgress> => {
      const raw = await api.get<RawOnboardingProgress>('/v1/tenant/onboarding/progress');
      return {
        ...raw,
        steps: raw.steps.map((step) => ({
          ...step,
          cta: step.cta ? { label: step.cta.label, ...surfaceForHref(step.cta.href) } : undefined,
        })),
      };
    },
    staleTime: 30_000,
  });
}

/** Map a dashboard onboarding-CTA href onto the workbench surface that does the same
 *  job. Unknown hrefs fall back to the closest platform surface rather than 404. */
function surfaceForHref(href: string): {
  surface: string;
  params?: Readonly<Record<string, string>>;
} {
  if (href.includes('/builder')) return { surface: 'builder.pages.list' };
  if (href.includes('/settings/domains') || href.includes('/domain'))
    return { surface: 'platform.settings.domains' };
  if (href.includes('/settings/payments') || href.includes('/payments'))
    return { surface: 'platform.settings.integrations' };
  if (href.includes('/settings/theme') || href.includes('/theme'))
    return { surface: 'platform.settings.sites' };
  if (href.includes('/settings')) return { surface: 'platform.settings.general' };
  return { surface: 'platform.settings.general' };
}

/* ── The storefront preview target (Launch step) ────────────────────────────── */

/** Where the Launch step's "Preview" points. Prod is the tenant's canonical zone
 *  host; dev's local storefront resolves tenants by `?tenant=<slug>` (no per-tenant
 *  DNS). `process.env.NODE_ENV` is inlined into the client bundle by Next, so this
 *  needs no NEXT_PUBLIC var (which would break the portable image). */
export function storefrontPreviewUrl(slug: string, token?: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  const base = dev
    ? `http://localhost:3004/?tenant=${encodeURIComponent(slug)}`
    : `https://${slug}.sparx.zone`;
  if (!token) return base;
  const join = base.includes('?') ? '&' : '?';
  // `sparxSitePreview` — the ONE param name the site renderer reads for a draft
  // (wizeworks/apps/site: proxy.ts mirrors it to the layout, every page route reads it
  // off searchParams). This said `preview=`, which nothing there has ever looked
  // at, so the button labelled "Preview your site" silently served the PUBLISHED
  // site — or the 404 of a site that has not published yet, which is precisely
  // the state a business is in when it reaches the Launch step.
  return `${base}${join}sparxSitePreview=${encodeURIComponent(token)}`;
}
