import 'server-only';

import { platformRequest } from '@wizeworks/auth-client-server';
import { RESERVED_ADDRESSES, slugifyAddress, type AddressVerdict } from './address-rules';

export { slugifyAddress, slugifyBusinessName, type AddressVerdict } from './address-rules';

// Claiming the web address — `thistle-and-rye.piggles.site`.
//
// A tenant is born with a generated placeholder (`quiet-haven-3783`) because
// sign-up asks for an email and a password and not for a business name. The
// generator names the step that was meant to resolve it: "let them personalize
// it in the onboarding Workspace step." **Piggles has no Workspace step**, so
// nothing ever did. Issue #010.
//
// The string rules live in `address-rules.ts` (the browser needs them too). The
// half that reads the database is in api-rest, which answers for the business
// of the person signed in (docs/154).

/**
 * Is this address available to this business?
 *
 * `tenants.slug` is globally unique across BOTH brands, one tenant pool, one
 * index, so api-rest asks the whole table, not just Piggles'. A taken address
 * is not an error, it is somebody else's shop.
 */
export async function checkAddress(typed: string): Promise<AddressVerdict> {
  const slug = slugifyAddress(typed);
  if (!slug) return 'unusable';
  if (RESERVED_ADDRESSES.has(slug)) return 'reserved';
  const { verdict } = await platformRequest<{ verdict: AddressVerdict }>(
    `business/address?slug=${encodeURIComponent(slug)}`
  );
  return verdict;
}

/**
 * The address belongs to somebody else. Thrown rather than falling back
 * silently: she is looking at the field, and handing her a different address
 * without saying so would be the defect one screen later.
 */
export class AddressTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`web address already taken: ${slug}`);
    this.name = 'AddressTakenError';
  }
}
