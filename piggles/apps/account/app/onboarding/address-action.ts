'use server';

import { requireSession } from '@wizeworks/auth';
import { checkAddress, slugifyAddress, type AddressVerdict } from '@/lib/business-slug';

// Is this web address free? Asked while she types, so she finds out before she
// presses the button rather than after.
//
// A web address is an identifier and identifiers do not change (issue #010), so
// the one moment to get it right is the moment it is being chosen. Telling
// somebody at submit time that the address they picked is gone — after they have
// answered three other questions — is the version of this that gets abandoned.

export interface AddressAnswer {
  /** What would actually be claimed, tidied — she sees this, not what she typed. */
  slug: string;
  verdict: AddressVerdict;
}

export async function lookUpAddress(typed: string): Promise<AddressAnswer> {
  // Session-gated: this reads the tenant table by slug, and an open endpoint
  // that answers "does this business exist" is a customer list with a keyboard.
  const session = await requireSession();
  return {
    slug: slugifyAddress(typed) ?? '',
    verdict: await checkAddress(typed, session.user.tenantId),
  };
}
