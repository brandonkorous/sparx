'use server';

import { revalidatePath } from 'next/cache';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';
import type {
  OnboardingCompleted,
  OnboardingStepKey,
  PendingDomain,
  SlugAvailability,
  WizardResult,
} from './types';

// Server-action adapters for the onboarding wizard. Like the rest of the
// dashboard, every call goes through api-rest with the server-held JWT — the
// wizard islands never touch api-rest directly. Each step persists its result
// AND advances `currentStep` so the flow resumes where the tenant left off.
//
// Modules-first flow (docs/15 v2): modules → template → workspace → domain →
// payments → launch. `next` is passed where the next step is conditional (after
// domain, Payments is shown only when a selling module is on).

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

// ── Step 1 — Modules ─────────────────────────────────────────────────────────
//
// The opening move: switch on the modules you need. The selection drives billing
// (the trial subscription, when platform billing lands) AND filters the template
// catalog to a compatible subset. Persisted in ONE bulk write, then advances to
// the Template step.

export async function saveModulesAction(modules: Record<string, boolean>): Promise<WizardResult> {
  try {
    await api.put('/v1/tenant/modules', { modules });
    await patchOnboarding({ completed: { modules: true }, currentStep: 'template' });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// ── Step 2 — Template ────────────────────────────────────────────────────────
//
// Pick a complete blueprint. Installing it provisions a whole themed site (pages,
// theme, brand, products, content, emails) as DRAFT onto the tenant's primary
// property, and enables the modules the blueprint needs. The site stays a draft
// until the Launch step publishes it. The blueprint key + install id are tracked
// on the onboarding state so Launch can publish deterministically and the flow
// resumes mid-setup.

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
      currentStep: 'workspace',
    });
    revalidatePath('/onboarding');
    return { ok: true, data: { installId } };
  } catch (err) {
    return fail(err);
  }
}

// The "start from scratch" path: no blueprint. Clears any prior template
// selection and advances — it does NOT touch the Builder module flag. It used
// to force Builder on unconditionally, which silently overrode an explicit
// "Builder off" choice from the Modules step (e.g. a B2B/CRM-only backend
// tenant with no site presence) with no indication to the merchant, even
// though the Modules step's own price summary never counted it. Whatever the
// Modules step already saved is the source of truth here. The Launch step
// detects the absent install and, when Builder IS enabled, routes into the
// Builder instead of a publish-this-showcase preview.
export async function startFromScratchAction(): Promise<WizardResult> {
  try {
    const state = await api.get<{ installId: string | null }>('/v1/tenant/onboarding');
    if (state.installId) {
      await api
        .post(`/v1/blueprints/installs/${encodeURIComponent(state.installId)}/reset`)
        .catch(() => undefined);
    }
    await patchOnboarding({
      blueprintKey: null,
      installId: null,
      completed: { template: true },
      currentStep: 'workspace',
    });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// ── Step 3 — Workspace ───────────────────────────────────────────────────────
//
// Name the company, confirm the storefront handle (slug), and name the first
// site. The slug is editable here — the last chance before the site goes live;
// after launch it's locked (changing a live address breaks links). All three
// writes are idempotent, so re-saving unchanged values is a no-op.

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

export async function saveWorkspaceAction(input: {
  companyName: string;
  slug: string;
  siteName: string;
}): Promise<WizardResult> {
  try {
    // Slug first — it's the most likely to fail (taken/reserved), and the
    // endpoint enforces both, so a bad slug aborts before any other write.
    await api.patch('/v1/tenant/slug', { slug: input.slug });
    await api.patch('/v1/tenant', { name: input.companyName });

    // Rename the PRIMARY property to the chosen site name.
    const properties = await listProperties();
    const primary = properties.find((p) => p.isPrimary) ?? properties[0];
    if (primary && primary.name !== input.siteName) {
      await api.patch(`/v1/properties/${encodeURIComponent(primary.id)}`, {
        name: input.siteName,
      });
    }

    await patchOnboarding({ completed: { workspace: true }, currentStep: 'domain' });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// ── Step 4 — Domain ──────────────────────────────────────────────────────────
//
// The featured upsell: search for and buy a custom domain, or continue on the
// free `<slug>.sparx.zone` address. `next` is 'payments' when a selling module is
// on, else 'launch'.

// Mark the domain step complete (a domain was bought, or the tenant chose the
// free address) and advance to the next step.
export async function completeDomainStepAction(next: OnboardingStepKey): Promise<WizardResult> {
  try {
    await patchOnboarding({ completed: { domain: true }, currentStep: next });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// Buy the domain the tenant chose at the Domain step — deferred to Launch so the
// charge is tied to actually going live (and never fronted for someone who
// abandons setup). Calls the gated /v1/domains/purchase, which charges the tenant
// for real BEFORE registering with GoDaddy. Returns the host on success; surfaces
// the API's message on failure (e.g. checkout closed, domain taken, card declined)
// so Launch can show it without publishing.
export async function purchaseSelectedDomainAction(
  input: PendingDomain
): Promise<WizardResult<{ host: string }>> {
  try {
    const res = await api.post<{ domain: { host: string } }>('/v1/domains/purchase', {
      domain: input.domain,
      years: input.years,
      privacy: input.privacy,
      propertyId: input.propertyId,
      contact: input.contact,
    });
    return { ok: true, data: { host: res.domain.host } };
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

// ── Step 5 — Payments ────────────────────────────────────────────────────────

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

// Advance from payments to the next step. Marks payments complete only when
// Stripe is actually connected (it's optional to launch).
export async function completePaymentsAction(input: {
  paymentsConnected?: boolean;
  next: OnboardingStepKey;
}): Promise<WizardResult> {
  try {
    await patchOnboarding({
      completed: input.paymentsConnected ? { payments: true } : undefined,
      currentStep: input.next,
    });
    revalidatePath('/onboarding');
    return ok;
  } catch (err) {
    return fail(err);
  }
}

// ── Step 6 — Launch ──────────────────────────────────────────────────────────

// Mint a short-lived site-preview token so the Launch step's "Preview in a new
// tab" can render the tenant's DRAFT site. Requires the Builder module, which the
// template install (or the scratch path) turned on.
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
