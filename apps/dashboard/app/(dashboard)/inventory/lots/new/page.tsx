import Link from 'next/link';
import { CircleAlert, Plus, Warehouse as WarehouseIcon } from 'lucide-react';

import { Button, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { LotCreateForm } from './_components/lot-create-form';

// New lot batch (docs/100 P4d). Needs at least one warehouse. The server fetches
// the warehouse option list and hands it to the client form, which resolves the
// item by SKU and creates the lot.

export const dynamic = 'force-dynamic';

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export default async function NewLotPage() {
  const { data: warehouses } = await api.getPaged<WarehouseOption[]>(
    '/v1/inventory/locations?take=250'
  );

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<CircleAlert className="h-5 w-5" />}
          title="New lot"
          description="Record a batch for an item — its expiry, hazmat class, supplier reference, and quantity. Add per-unit serials and drive recalls from the lot once it exists."
        />

        {warehouses.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<WarehouseIcon className="h-5 w-5" />}
              title="Add a warehouse first"
              description="A lot is held at one warehouse. Create one, then come back to record a lot."
              action={
                <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
                  <Link href="/inventory/warehouses/new">New warehouse</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <LotCreateForm warehouses={warehouses} />
        )}
      </Stack>
    </Container>
  );
}
