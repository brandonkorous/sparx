import { B2bAccountWizard } from './b2b-account-wizard';

// Full-page surface for creating a B2B account. The in-app `embedded` top stepper
// (docs/86) fills the dashboard content area (sidebar + header stay). On the B2B
// accounts list the "New" affordance
// opens this same wizard inside the dashboard's drawer/modal detail chrome,
// picked by the user's `defaultDetailView` preference (the `overlay`
// presentation). This route is the full-page option.

export default function NewB2bAccountPage() {
  return <B2bAccountWizard presentation="page" />;
}
