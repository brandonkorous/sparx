// Shared "verify-but-don't-block" gate for sensitive actions (auth pages
// redesign, Slice 2e). ONE guard, called from each gated route, so the rule
// lives in a single place rather than being re-implemented per endpoint.
//
// Rule: a sensitive action is allowed when the actor's email is verified OR the
// tenant is still in onboarding (`onboarding.finishedAt` is null). That exempts
// the mandatory onboarding flow — whose own steps (domain purchase, go-live,
// Stripe connect) run before the user has had a chance to verify — while
// requiring a confirmed email for those same actions once setup is finished.
// API-key actors are exempt: an issued key implies an established tenant, not
// the fresh-signup abuse vector this guards.

import type { FastifyRequest } from 'fastify';
import { prisma } from '@wizeworks/db';
import { requireAuth } from '@wizeworks/api-core/auth';
import { forbidden } from '@wizeworks/api-core/errors';

const VERIFY_EMAIL_MESSAGE =
  'Confirm your email address to use this feature. Check your inbox, or resend the link from the dashboard.';

// `tenants.settings.onboarding.finishedAt` is the completion signal (set when the
// wizard finishes or the user bows out). Mirrors readOnboarding() in routes/v1/tenant.ts.
function onboardingFinished(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  const onboarding = (settings as Record<string, unknown>).onboarding;
  if (!onboarding || typeof onboarding !== 'object' || Array.isArray(onboarding)) return false;
  return typeof (onboarding as Record<string, unknown>).finishedAt === 'string';
}

/**
 * Throws FORBIDDEN (→ 403 envelope) when the action requires a verified email and
 * the tenant has finished onboarding without one. Call once per gated handler,
 * after requireRole / module gates.
 */
export async function requireVerifiedEmail(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  if (auth.actorType !== 'user') return;

  // Source the verified flag from the authenticated identity (the session JWT
  // `ev` claim), NOT a fresh DB read. `users` has RLS policies that filter the
  // non-owner `sparx_app` role api-rest connects as (the table is ENABLE-but-
  // NO-FORCE — see wizeworks/packages/db/CLAUDE.md), so `prisma.user.findUnique` on the
  // base client returns null here and would wrongly gate EVERY verified user.
  // The claim is refreshed on each 5-minute token mint, so it is never stale by
  // more than that. (`tenants` below has no RLS — the dispatch table — so that
  // base-client read is safe.)
  if (auth.emailVerified) return;

  // Still onboarding → exempt, so a fresh signup's wizard steps flow freely.
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { settings: true },
  });
  if (!onboardingFinished(tenant?.settings ?? null)) return;

  throw forbidden(VERIFY_EMAIL_MESSAGE);
}
