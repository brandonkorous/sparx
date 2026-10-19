// The free web address follows the business name until the owner makes it theirs.
//
// Every business is born with a placeholder address (`merry-orchard-1523`), made
// before anyone knows what it will be called. Setup asks for the company name and
// the address on the same step, and the address stayed the placeholder while she
// typed "Quiet Bench Repair" above it (sparx persona issue 295; the Piggles twin
// of the same fault was its issue 010). It now follows the name while it is still
// the placeholder, or still the address the name before produced. One she typed
// herself is never touched.

import { isFriendlySlug } from '@wizeworks/auth/friendly-slug';
import { slugify } from '../../../lib/slugify';

/** A site address is one DNS label. */
const ADDRESS_MAX = 63;

/** The address to show once the company name changes, or null to leave it. */
export function addressAfterNameChange(
  address: string,
  previousName: string,
  nextName: string
): string | null {
  const current = address.trim().toLowerCase();
  const following =
    current === '' || isFriendlySlug(current) || current === slugify(previousName, ADDRESS_MAX);
  if (!following) return null;
  const next = slugify(nextName, ADDRESS_MAX);
  return next === '' ? null : next;
}
