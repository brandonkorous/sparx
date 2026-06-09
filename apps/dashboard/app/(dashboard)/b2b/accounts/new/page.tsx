import { Container, PageHeader, Stack } from '@sparx/ui';
import { Building2 } from 'lucide-react';

import { B2bAccountWizard } from './b2b-account-wizard';

// Full-page guided wizard for creating a B2B account (docs/68 Phase B-5).
// 3 steps: Company info → Pricing & credit → Engine profiles.

export default function NewB2bAccountPage() {
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Building2 className="h-5 w-5" />}
          title="New B2B account"
          description="Set up a wholesale or fleet account with pricing, credit terms, and engine profiles in three steps."
        />
        <B2bAccountWizard />
      </Stack>
    </Container>
  );
}
