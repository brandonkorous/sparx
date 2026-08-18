// Customer-resolution helpers used by consumers when the upstream event
// carries only an email or auth-user-id rather than a customers.id.

import { withTenant } from '@wizeworks/db';
import type { Customer } from '@wizeworks/db';

export async function resolveCustomerByEmail(
  tenantId: string,
  email: string
): Promise<Customer | null> {
  return withTenant({ tenantId }, (tx) =>
    tx.customer.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    })
  );
}
