'use client';

// The onboarding data layer — every read and write the setup flows and the welcome
// checklist run on, over the workbench's own browser api-rest client.
//
// Built fresh for the workbench ("build it, don't
// port it"): the dashboard drives these same endpoints through server actions; here
// they are react-query hooks and imperative actions in the browser. Reads are query
// hooks; the many small writes each step makes are grouped under useOnboardingActions
// so the wizard orchestrator drives them in sequence off ONE handle, and every write
// invalidates the onboarding query centrally rather than each caller remembering to.
//
// A call resolves or throws — there is no {ok,error} wrapper. Callers own the
// pending/error state (a mutation, or local state around an action).

import { useMemo } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@sparx/query';
import { api } from '../api/client';
import { SWITCHBOARD_MODULES } from './modules';
import type {
  OnboardingPatch,
  OnboardingProgress,
  OnboardingState,
  OnboardingStepKey,
  PendingDomain,
  RawOnboardingProgress,
  SlugAvailability,
  WizardBlueprint,
} from './types';
import type { StoryPayload } from './story-state';

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
  return `${base}${join}preview=${encodeURIComponent(token)}`;
}

/* ── Writes ─────────────────────────────────────────────────────────────────── */

async function patch(patch: OnboardingPatch): Promise<OnboardingState> {
  return api.patch<OnboardingState>('/v1/tenant/onboarding', patch);
}

/** Invalidate everything a write can move — the state, the derived checklist, and
 *  the module flags (the modules step writes those too). */
function invalidateOnboarding(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
  void qc.invalidateQueries({ queryKey: ONBOARDING_PROGRESS_KEY });
  void qc.invalidateQueries({ queryKey: ONBOARDING_MODULES_KEY });
}

export interface CommitStoryInput {
  modules: Record<string, boolean>;
  /** Industry slug → `settings.category`. */
  industry: string;
  /** Matched starting blueprint, or null to start from a blank Builder site. */
  blueprintKey: string | null;
  /** Selling modules gate the payments step. */
  selling: boolean;
  story: StoryPayload;
}

export interface CommitStoryResult {
  next: Extract<OnboardingStepKey, 'payments' | 'launch'>;
  installId: string | null;
  blueprintKey: string | null;
}

/**
 * Every write the flows make, bound to the query client so each one refreshes the
 * cache after it lands. The wizard orchestrator awaits these in sequence; the story
 * commit composes the same pipeline the wizard steps use, one call.
 */
export function useOnboardingActions() {
  const qc = useQueryClient();

  return useMemo(() => {
    const done = (): void => {
      invalidateOnboarding(qc);
    };

    // ── Step 1 — Modules ───────────────────────────────────────────────────────
    async function saveModules(modules: Record<string, boolean>): Promise<void> {
      await api.put('/v1/tenant/modules', { modules });
      await patch({ completed: { modules: true }, currentStep: 'template' });
      done();
    }

    // ── Step 2 — Template ──────────────────────────────────────────────────────
    // Reselecting the same template keeps the existing install (idempotent);
    // switching resets the old draft first so no orphan install is stranded.
    async function selectTemplate(key: string): Promise<{ installId: string }> {
      const state = await api.get<{ blueprintKey: string | null; installId: string | null }>(
        '/v1/tenant/onboarding'
      );
      let installId: string;
      if (state.blueprintKey === key && state.installId) {
        installId = state.installId;
      } else {
        if (state.installId && state.blueprintKey && state.blueprintKey !== key) {
          await api
            .post(`/v1/blueprints/installs/${encodeURIComponent(state.installId)}/reset`)
            .catch(() => undefined);
        }
        const res = await api.post<{ install_id: string }>(
          `/v1/blueprints/${encodeURIComponent(key)}/install`
        );
        installId = res.install_id;
      }
      await patch({
        blueprintKey: key,
        installId,
        completed: { template: true },
        currentStep: 'workspace',
      });
      done();
      return { installId };
    }

    // Start from scratch: no blueprint. Clears any prior selection and advances —
    // it does NOT touch the Builder flag (whatever the Modules step saved stands).
    async function startFromScratch(): Promise<void> {
      const state = await api.get<{ installId: string | null }>('/v1/tenant/onboarding');
      if (state.installId) {
        await api
          .post(`/v1/blueprints/installs/${encodeURIComponent(state.installId)}/reset`)
          .catch(() => undefined);
      }
      await patch({
        blueprintKey: null,
        installId: null,
        completed: { template: true },
        currentStep: 'workspace',
      });
      done();
    }

    // ── Step 3 — Workspace ─────────────────────────────────────────────────────
    async function checkSlug(slug: string): Promise<SlugAvailability> {
      return api.get<SlugAvailability>(
        `/v1/tenant/slug-availability?slug=${encodeURIComponent(slug)}`
      );
    }

    async function saveWorkspace(input: {
      companyName: string;
      slug: string;
      siteName: string;
    }): Promise<void> {
      // Slug first — it's the most likely to fail (taken/reserved), so a bad slug
      // aborts before any other write.
      await api.patch('/v1/tenant/slug', { slug: input.slug });
      await api.patch('/v1/tenant', { name: input.companyName });
      const properties =
        await api.get<{ id: string; name: string; isPrimary: boolean }[]>('/v1/properties');
      const primary = properties.find((p) => p.isPrimary) ?? properties[0];
      if (primary && primary.name !== input.siteName) {
        await api.patch(`/v1/properties/${encodeURIComponent(primary.id)}`, {
          name: input.siteName,
        });
      }
      await patch({ completed: { workspace: true }, currentStep: 'domain' });
      done();
      void qc.invalidateQueries({ queryKey: ['tenant'] });
      void qc.invalidateQueries({ queryKey: ['properties'] });
    }

    // ── Step 4 — Domain ────────────────────────────────────────────────────────
    async function completeDomainStep(next: OnboardingStepKey): Promise<void> {
      await patch({ completed: { domain: true }, currentStep: next });
      done();
    }

    async function getPrimaryProperty(): Promise<{ id: string; name: string; isPrimary: boolean }> {
      const properties =
        await api.get<{ id: string; name: string; isPrimary: boolean }[]>('/v1/properties');
      const primary = properties.find((p) => p.isPrimary) ?? properties[0];
      if (!primary) throw new Error('No site found for this account.');
      return primary;
    }

    // Buy the domain chosen at the Domain step — deferred to Launch so the charge is
    // tied to actually going live. Returns the host on success.
    async function purchaseDomain(input: PendingDomain): Promise<{ host: string }> {
      const res = await api.post<{ domain: { host: string } }>('/v1/domains/purchase', {
        domain: input.domain,
        years: input.years,
        privacy: input.privacy,
        propertyId: input.propertyId,
        contact: input.contact,
      });
      return { host: res.domain.host };
    }

    // ── Step 5 — Payments ──────────────────────────────────────────────────────
    // sparx Pay = Stripe Connect EXPRESS (the same model as Settings → Payments). We
    // open Stripe's hosted Account Link in a popup (not a full-page redirect) so the
    // in-page onboarding keeps its state; the popup returns to
    // /onboarding/stripe-callback, which postMessages a "done" signal. There is no
    // OAuth code to exchange — the account is created + reconciled by the backend — so
    // on return we just refresh status. `returnUrl`/`refreshUrl` are the popup's own
    // callback (Stripe hits `return_url` when the merchant finishes, `refresh_url` if
    // the single-use link expired and needs re-minting).
    async function startPaymentsOnboarding(
      returnUrl: string,
      refreshUrl: string
    ): Promise<{ url: string; accountId: string }> {
      return api.post<{ url: string; accountId: string }>(
        '/v1/tenant/onboarding/payments/onboard',
        { returnUrl, refreshUrl }
      );
    }

    async function refreshPaymentsStatus(): Promise<{ connected: boolean }> {
      const data = await api.post<{ connected: boolean }>(
        '/v1/tenant/onboarding/payments/refresh',
        {}
      );
      done();
      return data;
    }

    async function completePayments(input: {
      paymentsConnected?: boolean;
      next: OnboardingStepKey;
    }): Promise<void> {
      await patch({
        completed: input.paymentsConnected ? { payments: true } : undefined,
        currentStep: input.next,
      });
      done();
    }

    // ── Step 6 — Launch ────────────────────────────────────────────────────────
    async function getPreviewToken(): Promise<string> {
      const data = await api.get<{ token: string; expires_in: number }>(
        '/v1/builder/preview-token'
      );
      return data.token;
    }

    // Publish the chosen template (every page, product, layout, theme the install
    // created) then mark onboarding finished. After this the site is public.
    async function publishAndFinish(installId: string): Promise<void> {
      await api.post(`/v1/blueprints/installs/${encodeURIComponent(installId)}/go-live`);
      await patch({ finishedAt: new Date().toISOString() });
      done();
    }

    // Finish WITHOUT publishing — the scratch finish and the "I'll publish later"
    // escape hatch. Leaves `dismissed` false so the welcome checklist still nudges
    // whatever remains.
    async function finishOnboarding(): Promise<void> {
      await patch({ finishedAt: new Date().toISOString() });
      done();
    }

    async function goToStep(step: OnboardingStepKey): Promise<void> {
      await patch({ currentStep: step });
      done();
    }

    // ── Story flow ─────────────────────────────────────────────────────────────
    // Persist the in-progress narrative WITHOUT running the commit pipeline — just
    // the draft, so a refresh or a trip away resumes the composer. Does not touch
    // `currentStep`/`completed`, and activates no modules. Best-effort.
    async function saveStoryDraft(story: StoryPayload): Promise<void> {
      await patch({ story: { ...story, composedAt: new Date().toISOString() } });
    }

    // Commit the story through the SAME pipeline as the wizard (modules → blueprint
    // → workspace), record the whole narrative + industry, and set the in-page tail
    // step (payments when selling, else launch).
    async function commitStory(input: CommitStoryInput): Promise<CommitStoryResult> {
      const slug = handleSlugLocal(input.story.name);
      if (slug.length < 3) throw new Error('Pick a web address of at least 3 letters.');
      const companyName = titleCase(slug);

      await saveModules(input.modules);

      let installId: string | null = null;
      if (input.blueprintKey) {
        installId = (await selectTemplate(input.blueprintKey)).installId;
      } else {
        await startFromScratch();
      }

      await saveWorkspace({ companyName, slug, siteName: companyName });

      const next: 'payments' | 'launch' = input.selling ? 'payments' : 'launch';
      await patch({
        story: { ...input.story, composedAt: new Date().toISOString() },
        completed: { domain: true },
        currentStep: next,
      });
      done();
      return { next, installId, blueprintKey: input.blueprintKey };
    }

    // ── Flow switch + welcome ──────────────────────────────────────────────────
    async function switchFlow(flow: 'story' | 'classic'): Promise<void> {
      await patch({ flow });
      done();
    }

    async function markStarted(): Promise<void> {
      await patch({ startedAt: new Date().toISOString() });
      done();
    }

    async function dismiss(): Promise<void> {
      await patch({ dismissed: true });
      done();
    }

    return {
      saveModules,
      selectTemplate,
      startFromScratch,
      checkSlug,
      saveWorkspace,
      completeDomainStep,
      getPrimaryProperty,
      purchaseDomain,
      startPaymentsOnboarding,
      refreshPaymentsStatus,
      completePayments,
      getPreviewToken,
      publishAndFinish,
      finishOnboarding,
      goToStep,
      saveStoryDraft,
      commitStory,
      switchFlow,
      markStarted,
      dismiss,
    };
  }, [qc]);
}

export type OnboardingActions = ReturnType<typeof useOnboardingActions>;

/* ── Small helpers used by the commit pipeline ───────────────────────────────── */

function handleSlugLocal(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ''
  );
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** The module selection a fresh tenant starts from: NOTHING pre-enabled. The tenant
 *  turns on — and pays for — exactly the modules they want; that is the platform's
 *  premise, so onboarding never defaults a module ON. A blank slate simply surfaces
 *  every switchboard module as OFF; anyone with saved flags keeps theirs. */
export function initialModuleSelection(
  saved: { slug: string; enabled: boolean }[],
  modulesStepDone: boolean
): Record<string, boolean> {
  const stored = Object.fromEntries(saved.map((m) => [m.slug, m.enabled]));
  const anyOn = saved.some((m) => m.enabled);
  if (!modulesStepDone && !anyOn) {
    const withDefaults = { ...stored };
    for (const m of SWITCHBOARD_MODULES) withDefaults[m.key] ??= false;
    return withDefaults;
  }
  return stored;
}
