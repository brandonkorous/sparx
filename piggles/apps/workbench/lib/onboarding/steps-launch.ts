'use client';

// The second half of setup: the address, getting paid, going live, and the two
// small writes the welcome banner makes. Same shape as steps-setup — module-level
// functions taking the cache-invalidation callback.

import { api } from '../api/client';
import { patchOnboarding, type Done } from './steps-setup';
import type { OnboardingStepKey, PendingDomain } from './types';
import type { StoryPayload } from './story-state';

// ── Step 4 — Domain ──────────────────────────────────────────────────────────
export async function completeDomainStep(next: OnboardingStepKey, done: Done): Promise<void> {
  await patchOnboarding({ completed: { domain: true }, currentStep: next });
  done();
}

export async function getPrimaryProperty(): Promise<{
  id: string;
  name: string;
  isPrimary: boolean;
}> {
  const properties =
    await api.get<{ id: string; name: string; isPrimary: boolean }[]>('/v1/properties');
  const primary = properties.find((p) => p.isPrimary) ?? properties[0];
  if (!primary) throw new Error('No site found for this account.');
  return primary;
}

/** Buy the domain chosen at the Domain step — deferred to Launch so the charge is
 *  tied to actually going live. Returns the host on success. */
export async function purchaseDomain(input: PendingDomain): Promise<{ host: string }> {
  const res = await api.post<{ domain: { host: string } }>('/v1/domains/purchase', {
    domain: input.domain,
    years: input.years,
    privacy: input.privacy,
    propertyId: input.propertyId,
    contact: input.contact,
  });
  return { host: res.domain.host };
}

// ── Step 5 — Payments ────────────────────────────────────────────────────────
// Stripe Connect EXPRESS (the same model as Settings → Payments). The hosted
// Account Link opens in a popup, not a full-page redirect, so the in-page
// onboarding keeps its state; the popup returns to /onboarding/stripe-callback,
// which postMessages a "done" signal. There is no OAuth code to exchange — the
// backend creates and reconciles the account — so on return we just refresh.
export async function startPaymentsOnboarding(
  returnUrl: string,
  refreshUrl: string
): Promise<{ url: string; accountId: string }> {
  return api.post<{ url: string; accountId: string }>('/v1/tenant/onboarding/payments/onboard', {
    returnUrl,
    refreshUrl,
  });
}

export async function refreshPaymentsStatus(done: Done): Promise<{ connected: boolean }> {
  const data = await api.post<{ connected: boolean }>('/v1/tenant/onboarding/payments/refresh', {});
  done();
  return data;
}

export async function completePayments(
  input: { paymentsConnected?: boolean; next: OnboardingStepKey },
  done: Done
): Promise<void> {
  await patchOnboarding({
    completed: input.paymentsConnected ? { payments: true } : undefined,
    currentStep: input.next,
  });
  done();
}

// ── Step 6 — Launch ──────────────────────────────────────────────────────────
export async function getPreviewToken(): Promise<string> {
  const data = await api.get<{ token: string; expires_in: number }>('/v1/builder/preview-token');
  return data.token;
}

/** Publish the chosen template (every page, product, layout, theme the install
 *  created) then mark onboarding finished. After this the site is public. */
export async function publishAndFinish(installId: string, done: Done): Promise<void> {
  await api.post(`/v1/blueprints/installs/${encodeURIComponent(installId)}/go-live`);
  await patchOnboarding({ finishedAt: new Date().toISOString() });
  done();
}

/** Finish WITHOUT publishing — the scratch finish and the "I'll publish later"
 *  escape hatch. Leaves `dismissed` false so the checklist still nudges what
 *  remains. */
export async function finishOnboarding(done: Done): Promise<void> {
  await patchOnboarding({ finishedAt: new Date().toISOString() });
  done();
}

export async function goToStep(step: OnboardingStepKey, done: Done): Promise<void> {
  await patchOnboarding({ currentStep: step });
  done();
}

// ── Story flow + welcome ─────────────────────────────────────────────────────

/** Persist the in-progress narrative WITHOUT running the commit pipeline — just
 *  the draft, so a refresh or a trip away resumes the composer. Touches neither
 *  `currentStep` nor `completed`, and activates no modules. Best-effort. */
export async function saveStoryDraft(story: StoryPayload): Promise<void> {
  await patchOnboarding({
    story: { ...story, composedAt: new Date().toISOString() },
  });
}

export async function switchFlow(flow: 'story' | 'classic', done: Done): Promise<void> {
  await patchOnboarding({ flow });
  done();
}

export async function markStarted(done: Done): Promise<void> {
  await patchOnboarding({ startedAt: new Date().toISOString() });
  done();
}

export async function dismiss(done: Done): Promise<void> {
  await patchOnboarding({ dismissed: true });
  done();
}
