import { PackageOpen } from 'lucide-react';

import { isModuleEnabled, requireSession } from '@sparx/auth';

import { ModuleStub } from '../../../../../../components/module-stub';

import { NewTaxZoneForm } from './_components/new-tax-zone-form';

// Full-page /new route for a tax zone. The embedded WizardFrame supplies the
// title + window controls + floor toolbar, so when the module is enabled we
// render the form DIRECTLY — no Container/PageHeader/Card wrapper (docs/86).
// The same component renders in the @detail overlay with surface="overlay".

export const dynamic = 'force-dynamic';

export default async function NewTaxZonePage() {
  const session = await requireSession();
  const enabled = await isModuleEnabled(session.user.tenantId, 'commerce');
  if (!enabled) {
    return (
      <ModuleStub
        icon={<PackageOpen className="h-5 w-5" />}
        title="Commerce"
        tagline=""
        description="Activate the Commerce module from Billing to add tax zones."
        features={[]}
      />
    );
  }

  return <NewTaxZoneForm surface="page" />;
}
