import { Truck } from 'lucide-react';

import { Container, PageHeader, Stack } from '@sparx/ui';

import { SupplierCreateForm } from '../_components/supplier-create-form';

export const dynamic = 'force-dynamic';

export default function NewSupplierPage() {
  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Truck className="h-5 w-5" />}
          title="New supplier"
          description="Record a vendor you purchase stock from. Add per-variant cost + part numbers on the supplier's page after it exists."
        />
        <SupplierCreateForm />
      </Stack>
    </Container>
  );
}
