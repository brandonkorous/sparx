import Link from 'next/link';
import { ArrowLeftRight, Plus, Warehouse as WarehouseIcon } from 'lucide-react';

import { Button, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { TransferCreateForm } from './_components/transfer-create-form';

// New inventory transfer (docs/100 P4). Needs at least two warehouses (a source and
// a destination). The server fetches the warehouse option list and hands it to the
// client form, which composes the lines and creates a draft.

export const dynamic = 'force-dynamic';

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export default async function NewInventoryTransferPage() {
  const { data: warehouses } = await api.getPaged<WarehouseOption[]>(
    '/v1/inventory/locations?take=250'
  );

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<ArrowLeftRight className="h-5 w-5" />}
          title="New transfer"
          description="Move stock from one warehouse to another. Add the items, then ship — the units sit in transit until you receive them at the destination."
        />

        {warehouses.length < 2 ? (
          <Card padding="none">
            <EmptyState
              icon={<WarehouseIcon className="h-5 w-5" />}
              title="Add a second warehouse first"
              description="A transfer moves stock between two warehouses, so you need at least two. Create another, then come back to start a transfer."
              action={
                <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
                  <Link href="/inventory/warehouses/new">New warehouse</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <TransferCreateForm warehouses={warehouses} />
        )}
      </Stack>
    </Container>
  );
}
