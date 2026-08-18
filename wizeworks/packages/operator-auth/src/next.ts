// Next.js server-side session helpers (docs/apps/admin/build-plan.md §2 D5).
// Exposed on the `@wizeworks/operator-auth/next` subpath so the core barrel stays
// free of `next/*` imports (importable outside a Next runtime).
//
// Authorization is capability-scoped and DEFAULT-DENY: requireCapability sends
// an operator lacking the capability to /forbidden rather than serving the
// surface. This is the authoritative check — api-rest trusts what the admin app
// has already authorized.

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { operatorAuth } from './server';
import { loadOperatorCapabilities } from './capabilities';
import type { OperatorCapability, OperatorIdentity } from '@wizeworks/operator';

/** Where an operator who has not set up MFA yet is sent. Lives OUTSIDE the
 *  console segment so it is reachable without passing the gate it exists to
 *  satisfy — and it calls getOperatorSession(), never requireOperator(), or the
 *  redirect would chase its own tail. */
export const TWO_FACTOR_SETUP_PATH = '/two-factor-setup';

export async function getOperatorSession(): Promise<OperatorIdentity | null> {
  const result = await operatorAuth.api.getSession({ headers: await headers() });
  if (!result) return null;
  const user = result.user as {
    id: string;
    email: string;
    name?: string | null;
    twoFactorEnabled?: boolean;
  };
  const capabilities = await loadOperatorCapabilities(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    capabilities,
    twoFactorEnabled: user.twoFactorEnabled === true,
  };
}

/**
 * The console gate. Two conditions, in order: a session at all, then MFA.
 *
 * MFA is MANDATORY for operators (docs/16 §2.4) because an operator session is a
 * cross-tenant capability — so this is enforced at the gate every console route
 * already passes through, not left to a banner the operator can ignore. An
 * operator who has not enrolled is redirected to the setup screen and can reach
 * nothing else; signing in without a second factor buys them no access.
 *
 * `allowUnenrolled` opts OUT of the MFA half and exists for exactly one caller:
 * the setup screen itself, which an operator must be able to reach before they
 * have the thing it is about to give them.
 */
export async function requireOperator(options?: {
  allowUnenrolled?: boolean;
}): Promise<OperatorIdentity> {
  const operator = await getOperatorSession();
  if (!operator) redirect('/sign-in');
  if (options?.allowUnenrolled !== true && !operator.twoFactorEnabled) {
    redirect(TWO_FACTOR_SETUP_PATH);
  }
  return operator;
}

export async function requireCapability(capability: OperatorCapability): Promise<OperatorIdentity> {
  const operator = await requireOperator();
  if (!operator.capabilities.includes(capability)) redirect('/forbidden');
  return operator;
}

/** Non-redirecting predicate for conditional rendering (nav items, buttons). */
export function hasCapability(operator: OperatorIdentity, capability: OperatorCapability): boolean {
  return operator.capabilities.includes(capability);
}
