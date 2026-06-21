import { api } from '@/lib/api-rest-client';
import { GrantAccountCreditForm } from '../_components/grant-account-credit-form';

// Full-page surface for granting account credit. The surface-aware
// `GrantAccountCreditForm` (docs/86 F layout) renders the SAME WizardFrame here
// (`surface="page"` → the `embedded` contained sheet, filling the dashboard
// content area with its own title + pinned toolbar) and inside the `@detail`
// drawer/modal overlay (`surface="overlay"`). Account credit has no detail
// view, so a grant stays open on success (shows the new balance, resets,
// refreshes) rather than flowing into a record. No page-level
// Container/PageHeader — the embedded frame supplies the title. The customer
// picker is seeded here from CRM.

export const dynamic = 'force-dynamic';

interface CrmCustomerRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export default async function NewAccountCreditPage() {
  const customersPaged = await api.getPaged<CrmCustomerRow[]>('/v1/crm/customers?take=200');

  const customers = customersPaged.data.map((c) => {
    const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    const name = full !== '' ? full : (c.email ?? c.id.slice(0, 8) + '…');
    return { id: c.id, email: c.email, name };
  });

  return <GrantAccountCreditForm surface="page" customers={customers} />;
}
