import { Container, PageHeader, Stack } from '@sparx/ui';
import { UserPlus } from 'lucide-react';

import { CustomerFullProfileWizard } from './customer-full-profile-wizard';

// Full-page guided wizard for creating a customer with contact info,
// classification, and an optional primary address (docs/68 Phase B-5).
// The surface-aware CustomerCreateForm (overlay) is separate and unchanged.

export default function NewCustomerPage() {
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<UserPlus className="h-5 w-5" />}
          title="New customer"
          description="Add a contact with their profile, type, and optional address in three steps."
        />
        <CustomerFullProfileWizard />
      </Stack>
    </Container>
  );
}
