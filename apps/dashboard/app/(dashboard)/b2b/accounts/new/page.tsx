import { B2bAccountWizard } from './b2b-account-wizard';

// Full-page surface for creating a B2B account. The WizardFrame `page` variant
// (docs/86) owns the viewport. On the B2B accounts list the "New" affordance
// opens this same wizard inside the dashboard's drawer/modal detail chrome,
// picked by the user's `defaultDetailView` preference (the `overlay`
// presentation). This route is the full-page option.

export default function NewB2bAccountPage() {
  return <B2bAccountWizard presentation="page" />;
}
