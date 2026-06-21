import { TransferWizard } from './_components/transfer-wizard';
import { loadTransferWizardData } from './wizard-data';

// Full-page surface for creating an inventory transfer (docs/100 P4). The in-app
// `embedded` top stepper (docs/86) composes the whole draft — route (from → to)
// and the items to move — then commits it on finish.
//
// On the Transfers list the "New" affordance opens this same wizard inside the
// dashboard's drawer/modal detail chrome, picked by the user's `defaultDetailView`
// preference (the `'overlay'` presentation; see `EntityCreateButton` + the
// `@detail` create registry). The transfer detail stays full-page; this route is
// the full-page option. The wizard guards on fewer than two warehouses itself.

export const dynamic = 'force-dynamic';

export default async function NewInventoryTransferPage() {
  const data = await loadTransferWizardData();
  return <TransferWizard {...data} />;
}
