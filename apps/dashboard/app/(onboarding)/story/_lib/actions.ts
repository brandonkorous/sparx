'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import {
  saveModulesAction,
  selectTemplateAction,
  startFromScratchAction,
  saveWorkspaceAction,
  checkSlugAction,
  startStripeConnectAction,
  completePaymentsAction,
  publishAndFinishAction,
  finishOnboardingAction,
} from '../../onboarding/_lib/actions';
import type { OnboardingStepKey, WizardResult } from '../../onboarding/_lib/types';
import { handleSlug, type StoryPayload } from './story-state';
import { ONBOARDING_FLOW_COOKIE } from './flow';

// The natural-language "story" onboarding commits through the SAME pipeline as the
// classic wizard — it's a new front end, not a new backend. `commitStoryAction`
// orchestrates the existing step actions in order (modules → blueprint → workspace),
// records the full narrative + industry. The flow then continues IN-PAGE through the
// reused payments + launch steps (the "fold in the tail" — the story never bounces to
// the wizard). Re-exported wizard actions power that tail; `checkSlugAction` powers
// the live handle check.

export { checkSlugAction, completePaymentsAction, publishAndFinishAction, finishOnboardingAction };

// Stripe Connect for the STORY flow. Stripe's OAuth `state` only carries the tenant
// id and Standard-OAuth redirect URIs are allow-listed in the Stripe dashboard, so we
// can't invent a `/story/stripe-callback` redirect. Instead we mark the flow in a
// short-lived cookie and REUSE the registered `/onboarding/stripe-callback`, which
// reads the cookie and redirects back to `/story?stripe_connected=1`. SameSite=Lax so
// the cookie survives Stripe's top-level redirect back to us.
export async function startStripeConnectStoryAction(): Promise<WizardResult<{ url: string }>> {
  const jar = await cookies();
  jar.set(ONBOARDING_FLOW_COOKIE, 'story', {
    path: '/',
    maxAge: 900,
    httpOnly: true,
    sameSite: 'lax',
  });
  return startStripeConnectAction();
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

function fail(err: unknown): { ok: false; error: string } {
  const e = err as ApiRestError;
  return { ok: false, error: e?.message ?? 'Something went wrong.' };
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Persist the in-progress narrative WITHOUT running the commit pipeline — just the
 *  story draft, so a refresh or a trip away (reading the legal pages, an interrupted
 *  session) resumes the compose phase instead of losing it. This mirrors how the
 *  classic wizard already persists each step as you go; it does NOT touch `currentStep`
 *  or `completed`, so the page resumes the COMPOSER (not the payments/launch tail) and
 *  no modules are activated until the owner actually hits "Build". Best-effort: a failed
 *  save just means the draft isn't captured this tick, never a blocked compose. */
export async function saveStoryDraftAction(story: StoryPayload): Promise<WizardResult<null>> {
  try {
    await api.patch('/v1/tenant/onboarding', {
      story: { ...story, composedAt: new Date().toISOString() },
    });
    return { ok: true, data: null };
  } catch (err) {
    return fail(err);
  }
}

export async function commitStoryAction(input: CommitStoryInput): Promise<
  WizardResult<{
    next: Extract<OnboardingStepKey, 'payments' | 'launch'>;
    installId: string | null;
    blueprintKey: string | null;
  }>
> {
  const slug = handleSlug(input.story.name);
  if (slug.length < 3) {
    return { ok: false, error: 'Pick a web address of at least 3 letters.' };
  }
  const companyName = titleCase(slug);

  try {
    // 1 — modules (the API enforces the billing graph, e.g. b2b→commerce).
    const m = await saveModulesAction(input.modules);
    if (!m.ok) return m;

    // 2 — starting point: a matched blueprint (installed as draft) or a blank site.
    //     Capture the install id so the in-page launch step can publish it.
    let installId: string | null = null;
    if (input.blueprintKey) {
      const t = await selectTemplateAction(input.blueprintKey);
      if (!t.ok) return t;
      installId = t.data.installId;
    } else {
      const t = await startFromScratchAction();
      if (!t.ok) return t;
    }

    // 3 — workspace: company name, `<slug>.sparx.zone` handle, first site name.
    const w = await saveWorkspaceAction({ companyName, slug, siteName: companyName });
    if (!w.ok) return w;

    // 4 — record the WHOLE story + industry, mark the free address as the domain
    //     choice, and set the tail step we continue at IN-PAGE (payments/launch).
    const next: 'payments' | 'launch' = input.selling ? 'payments' : 'launch';
    await api.patch('/v1/tenant/onboarding', {
      category: input.industry,
      story: { ...input.story, composedAt: new Date().toISOString() },
      completed: { domain: true },
      currentStep: next,
    });

    revalidatePath('/onboarding');
    revalidatePath('/story');
    return { ok: true, data: { next, installId, blueprintKey: input.blueprintKey } };
  } catch (err) {
    return fail(err);
  }
}
