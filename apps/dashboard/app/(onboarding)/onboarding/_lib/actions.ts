'use server';

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';
import type {
  OnboardingCompleted,
  OnboardingStepKey,
  SlugAvailability,
  WizardResult,
} from './types';

// Server-action adapters for the onboarding wizard. Like the rest of the
// dashboard, every call goes through api-rest with the server-held JWT — the
// wizard islands never touch api-rest directly. Each step persists its result
// AND advances `currentStep` so the flow resumes where the tenant left off.

function fail(err: unknown): { ok: false; error: string } {
  const e = err as ApiRestError;
  return { ok: false, error: e?.message ?? 'Something went wrong.' };
}

const ok = { ok: true, data: undefined } as const;

interface OnboardingPatch {
  currentStep?: OnboardingStepKey;
  finishedAt?: string | null;
  blueprintKey?: string | null;
  installId?: string | null;
  completed?: Partial<OnboardingCompleted>;
}

async function patchOnboarding(patch: OnboardingPatch): Promise<void> {
  await api.patch('/v1/tenant/onboarding', patch);
}

// ── Step 1 — Template ────────────────────────────────────────────────────────
//
// Pick a complete blueprint. Installing it provisions a whole themed site (pages,
// theme, brand, products, content, emails) as DRAFT onto the tenant's primary
// property, and enables the modules the blueprint needs. The site stays a draft
// until the Launch step publishes it — so nothing is public until the tenant says
// so. The blueprint key + install id are tracked on the onboarding state so the
// Launch step can publish deterministically and the flow resumes mid-setup.

export async function selectTemplateAction(
  key: string
): Promise<WizardResult<{ installId: string }>> {
  try {
    // If a DIFFERENT template was installed earlier in this flow (the tenant
    // changed their mind), reset it first — install is one row per blueprint, and
    // we don't want to strand an orphan draft. Re-selecting the SAME template
    // keeps the existing install (idempotent).
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

    await patchOnboarding({
      blueprintKey: key,
      installId,
      completed: { template: true },
      currentStep: 'domain',
    });
    revalidatePath('/onboarding');
    return { ok: true, data: { installId } };
  } catch (err) {
    return fail(err);
  }
}

// The "start from scratch" path: no blueprint. Turn the Builder on (so the
// starter seeds and the tenant can design), clear any prior template selection,
// and advance. The Launch step detects the absent install and routes into the
// Builder instead of a publish-this-showcase preview.
export async function startFromScratchAction(): Promise<WizardResult> {
  try {
    // If a template was installed earlier and is being abandoned, tear it down so
    // the tenant truly starts blank.
    const state = await api.get<{ installId: string | null }>('/v1/tenant/onboarding');
    if (state.installId) {
      await api
        .post(`/v1/blueprints/installs/${encodeURIComponent(state.installId)}/reset`)
        .catch(() => undefined);
    }
    await api.patch('/v1/tenant/modules/builder', { enabled: true });
    await patchOnboarding({
      blueprintKey: null,
      installId: null,
      completed: { template: true },
      currentStep: 'domain',
    });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// ── Step 2 — Domain ──────────────────────────────────────────────────────────

export async function checkSlugAction(slug: string): Promise<WizardResult<SlugAvailability>> {
  try {
    const data = await api.get<SlugAvailability>(
      `/v1/tenant/slug-availability?slug=${encodeURIComponent(slug)}`
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function saveSlugAction(slug: string): Promise<WizardResult> {
  try {
    await api.patch('/v1/tenant/slug', { slug });
    await patchOnboarding({ completed: { domain: true }, currentStep: 'payments' });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// Domain (purchased path). Marks the domain step complete when the tenant buys a
// domain through onboarding instead of picking a .sparx.zone subdomain.
export async function completeDomainStepAction(): Promise<WizardResult> {
  try {
    await patchOnboarding({ completed: { domain: true }, currentStep: 'payments' });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// Returns the tenant's primary property so the onboarding PurchaseDialog can
// pre-fill the `propertyId` hidden input.
export async function getPrimaryPropertyAction(): Promise<WizardResult<Property>> {
  try {
    const properties = await listProperties();
    const primary = properties.find((p) => p.isPrimary) ?? properties[0];
    if (!primary) return { ok: false, error: 'No property found.' };
    return { ok: true, data: primary };
  } catch (err) {
    return fail(err);
  }
}

// ── Step 3 — Payments ────────────────────────────────────────────────────────

// Stripe Connect OAuth — returns the Stripe OAuth URL so the client can navigate
// the merchant there. The redirect_uri points back to /onboarding/stripe-callback.
export async function startStripeConnectAction(): Promise<WizardResult<{ url: string }>> {
  try {
    const callbackUrl = `${process.env.NEXT_PUBLIC_DASHBOARD_URL ?? ''}/onboarding/stripe-callback`;
    const data = await api.get<{ url: string }>(
      `/v1/tenant/onboarding/stripe/connect-url?redirect_uri=${encodeURIComponent(callbackUrl)}`
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

// Advance from payments to the Launch step. Marks payments complete only when
// Stripe is actually connected (it's optional to launch).
export async function completePaymentsAction(input: {
  paymentsConnected?: boolean;
}): Promise<WizardResult> {
  try {
    await patchOnboarding({
      completed: input.paymentsConnected ? { payments: true } : undefined,
      currentStep: 'launch',
    });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// ── Step 4 — Launch ──────────────────────────────────────────────────────────

// Mint a short-lived site-preview token so the Launch step's iframe can render
// the tenant's DRAFT site (the installed-but-unpublished template). Requires the
// Builder module, which the template install turned on.
export async function getPreviewTokenAction(): Promise<WizardResult<{ token: string }>> {
  try {
    const data = await api.get<{ token: string; expires_in: number }>('/v1/builder/preview-token');
    return { ok: true, data: { token: data.token } };
  } catch (err) {
    return fail(err);
  }
}

// Publish the chosen template — the one-tap "Launch". Goes live (publishes every
// page, product, the layout, and the theme the install created), then marks
// onboarding finished. After this the site is public at {slug}.sparx.zone.
export async function publishAndFinishAction(installId: string): Promise<WizardResult> {
  try {
    await api.post(`/v1/blueprints/installs/${encodeURIComponent(installId)}/go-live`);
    await patchOnboarding({ finishedAt: new Date().toISOString() });
    revalidatePath('/');
    revalidatePath('/welcome');
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// Finish onboarding WITHOUT publishing — the "start from scratch" finish and the
// "I'll publish later" escape hatch. `finishedAt` flips the welcome checklist to
// its completed state; we leave `dismissed` false so the day-0+ banner still
// nudges any remaining work.
export async function finishOnboardingAction(): Promise<WizardResult> {
  try {
    await patchOnboarding({ finishedAt: new Date().toISOString() });
    revalidatePath('/');
    revalidatePath('/welcome');
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// ── Navigation ───────────────────────────────────────────────────────────────

// Advance/rewind without completing a step (Back, or Skip-for-now).
export async function goToStepAction(step: OnboardingStepKey): Promise<WizardResult> {
  try {
    await patchOnboarding({ currentStep: step });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}
