import { PurchaseOrderWizard } from './_components/purchase-order-wizard';
import { loadPurchaseOrderWizardData } from './wizard-data';

// Full-page surface for creating a purchase order (docs/100 P3b). The in-app
// `embedded` top stepper (docs/86) composes the whole draft — supplier +
// warehouse, the variant lines, terms/shipping/dates — then commits it on finish.
//
// On the PO list the "New" affordance opens this same wizard inside the
// dashboard's drawer/modal detail chrome, picked by the user's `defaultDetailView`
// preference (the `'overlay'` presentation; see `EntityCreateButton` + the
// `@detail` create registry). The PO editor stays full-page; this route is the
// full-page option that chrome's "open in full page" button, Shift-click, and
// new-tab resolve to. The wizard guards on missing suppliers/warehouses itself.

export const dynamic = 'force-dynamic';

export default async function NewPurchaseOrderPage() {
  const data = await loadPurchaseOrderWizardData();
  return <PurchaseOrderWizard {...data} />;
}
