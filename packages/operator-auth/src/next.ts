// Next.js server-side session helpers (docs/apps/admin/build-plan.md §2 D5).
// Exposed on the `@sparx/operator-auth/next` subpath so the core barrel stays
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
import type { OperatorCapability, OperatorIdentity } from '@sparx/operator';

export async function getOperatorSession(): Promise<OperatorIdentity | null> {
  const result = await operatorAuth.api.getSession({ headers: await headers() });
  if (!result) return null;
  const user = result.user as { id: string; email: string; name?: string | null };
  const capabilities = await loadOperatorCapabilities(user.id);
  return { id: user.id, email: user.email, name: user.name ?? null, capabilities };
}

export async function requireOperator(): Promise<OperatorIdentity> {
  const operator = await getOperatorSession();
  if (!operator) redirect('/sign-in');
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
