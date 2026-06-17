import { Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { GrantAccountCreditForm } from '../_components/grant-account-credit-form';

// Full-page surface for granting account credit. The form body lives in the
// surface-aware `GrantAccountCreditForm` (§13.1) so the SAME component renders
// here (`surface="page"`) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). Account credit has no detail view, so a grant stays
// open on success (shows the new balance, resets, refreshes) rather than
// flowing into a record. The customer picker is seeded here from CRM.

export const dynamic = 'force-dynamic';

interface CrmCustomerRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export default async function NewAccountCreditPage() {
  const customersPaged = await api.getPaged<CrmCustomerRow[]>('/v1/crm/customers?take=200');

  const recentCustomers = customersPaged.data.map((c) => {
    const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    const name = full !== '' ? full : (c.email ?? c.id.slice(0, 8) + '…');
    return { id: c.id, email: c.email, name };
  });

  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Grant account credit"
          description="Adds to a customer's balance for the named currency. New customer + new currency creates a fresh balance row."
        />
        <GrantAccountCreditForm surface="page" customers={recentCustomers} />
      </Stack>
    </Container>
  );
}
