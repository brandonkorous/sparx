import { OrderWizard } from './_components/order-wizard';
import { loadOrderWizardData } from './wizard-data';

// Full-page surface for creating an order. The in-app `embedded` top stepper
// (docs/86) composes the whole order — customer + channel + currency, priced
// line items, shipping/notes — then commits it on finish (the service emits
// `order.created` after the transaction commits).
//
// On the Orders list the "New" affordance opens this same wizard inside the
// dashboard's drawer/modal detail chrome, picked by the user's `defaultDetailView`
// preference (the `'overlay'` presentation; see `EntityCreateButton` + the
// `@detail` create registry). This route is the full-page option that chrome's
// "open in full page" button, Shift-click, new-tab, and `?customerId=` deep links
// resolve to.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewOrderPage({ searchParams }: PageProps) {
  const [sp, data] = await Promise.all([searchParams, loadOrderWizardData()]);

  return <OrderWizard {...data} preselectedCustomerId={stringParam(sp.customerId) ?? null} />;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
