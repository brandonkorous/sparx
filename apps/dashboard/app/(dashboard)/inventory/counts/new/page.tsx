import Link from 'next/link';
import { ClipboardCheck, Plus, Warehouse as WarehouseIcon } from 'lucide-react';

import { Button, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { CountCreateForm } from './_components/count-create-form';

// New inventory count (docs/100 P4). Needs at least one warehouse; a cycle count
// also lets you pick the specific variants by SKU. The server fetches the
// warehouse option list and hands it to the client form.

export const dynamic = 'force-dynamic';

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

export default async function NewInventoryCountPage() {
  const { data: warehouses } = await api.getPaged<PartyOption[]>(
    '/v1/inventory/locations?take=250'
  );

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="New count"
          description="Reconcile stock against a physical count. A cycle count covers the SKUs you pick; a full count snapshots every level in the warehouse."
        />

        {warehouses.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<WarehouseIcon className="h-5 w-5" />}
              title="Add a warehouse first"
              description="A count is scoped to one warehouse. Create one, then come back to start counting."
              action={
                <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
                  <Link href="/inventory/warehouses/new">New warehouse</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <CountCreateForm warehouses={warehouses} />
        )}
      </Stack>
    </Container>
  );
}
