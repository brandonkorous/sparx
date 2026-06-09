export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Database } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Card,
  Container,
  EmptyState,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';
import { ListToolbar } from '../../_components/list-toolbar';
import { NewSourceButton } from './_components/new-source-button';
import { SourceActions } from './_components/source-actions';

export const metadata: Metadata = { title: 'Inventory Sources' };

interface InventorySource {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, string>;
  lastSyncAt: string | null;
  syncIntervalSec: number;
  notes: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  csv: 'CSV Feed',
  api: 'API',
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  error: 'danger',
};

function syncInterval(sec: number): string {
  if (sec === 0) return 'Manual';
  if (sec < 3600) return `Every ${sec / 60}m`;
  return `Every ${sec / 3600}h`;
}

export default async function InventorySourcesPage() {
  const sources = await api.get<InventorySource[]>('/v1/inventory/sources');

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Database className="h-5 w-5" />}
          title="Sources"
          badge={
            <Badge color="neutral" variant="soft">
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </Badge>
          }
          description="Inventory feeds that push stock counts into Sparx."
          actions={<NewSourceButton />}
        />

        <ListToolbar searchPlaceholder="Search sources…" />

        {sources.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title="No inventory sources connected"
              description="Connect a CSV feed or API source to sync stock levels."
              action={<NewSourceButton />}
            />
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Text size="sm" className="text-[var(--color-muted-foreground)]">
                      {TYPE_LABELS[s.type] ?? s.type}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Badge color={STATUS_COLOR[s.status] ?? 'neutral'} variant="soft" size="sm">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" className="text-[var(--color-muted-foreground)]">
                      {syncInterval(s.syncIntervalSec)}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" className="text-[var(--color-muted-foreground)]">
                      {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : 'Never'}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <SourceActions source={s} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </Container>
  );
}
