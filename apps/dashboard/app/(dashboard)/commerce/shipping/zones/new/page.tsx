import { PackageOpen } from 'lucide-react';

import { isModuleEnabled, requireSession } from '@sparx/auth';

import { ModuleStub } from '../../../../../../components/module-stub';

import { NewZoneForm } from './_components/new-zone-form';

// Full-page /new route for a shipping zone. When the Commerce module is enabled
// we render the create form DIRECTLY on the standard create surface (docs/86) —
// the embedded WizardFrame supplies the title + toolbar, so no Container /
// PageHeader / Card wrapper here. When disabled, the module gate shows a stub.

export const dynamic = 'force-dynamic';

export default async function NewShippingZonePage() {
  const session = await requireSession();
  const enabled = await isModuleEnabled(session.user.tenantId, 'commerce');
  if (!enabled) {
    return (
      <ModuleStub
        icon={<PackageOpen className="h-5 w-5" />}
        title="Commerce"
        tagline=""
        description="Activate the Commerce module from Billing to add shipping zones."
        features={[]}
      />
    );
  }

  return <NewZoneForm surface="page" />;
}
