import { OrderWizard } from '../../../_orders/components/order-wizard';
import { loadOrderWizardData } from '../../../_orders/wizard-data';
import { B2B_ORDER_LENS as LENS } from '../../../_orders/lens';

// Full-page surface for creating an order through the b2b lens. The in-app
// `embedded` top stepper (docs/86) composes the whole order — customer + channel
// + currency, priced line items, shipping/notes — then commits it on finish (the
// service emits `order.created` after the transaction commits).
//
// On the Orders list the "New" affordance opens this same wizard inside the
// dashboard's drawer/modal detail chrome, picked by the user's `defaultDetailView`
// preference. This route is the full-page option that chrome's "open in full page"
// button, Shift-click, new-tab, and `?customerId=` deep links resolve to.
//
// `basePath` is what sends the wizard back to THIS module's list on finish —
// creating an order from /b2b/orders must not land the user in /commerce/orders.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewOrderPage({ searchParams }: PageProps) {
  const [sp, data] = await Promise.all([searchParams, loadOrderWizardData()]);

  return (
    <OrderWizard
      {...data}
      basePath={LENS.basePath}
      preselectedCustomerId={stringParam(sp.customerId) ?? null}
    />
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
