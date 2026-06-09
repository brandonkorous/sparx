export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { api } from '@/lib/api-rest-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Text,
} from '@sparx/ui';
import { NewSourceButton } from './_components/new-source-button';
import { SourceActions } from './_components/source-actions';

export const metadata: Metadata = { title: 'Inventory Sources' };

interface InventorySource {
  id: string;
  name: string;
  type: string;
  status: string;
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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="mt-1 text-[var(--color-muted-foreground)]">
            Inventory feeds that push stock counts into Sparx.
          </p>
        </div>
        <NewSourceButton />
      </div>

      {sources.length === 0 ? (
        <Text className="text-[var(--color-muted-foreground)]">
          No inventory sources connected yet.
        </Text>
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
            {sources.map((src) => (
              <TableRow key={src.id}>
                <TableCell className="font-medium">{src.name}</TableCell>
                <TableCell>{TYPE_LABELS[src.type] ?? src.type}</TableCell>
                <TableCell>
                  <Badge color={STATUS_COLOR[src.status] ?? 'neutral'} variant="soft" size="sm">
                    {src.status.charAt(0).toUpperCase() + src.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>{syncInterval(src.syncIntervalSec)}</TableCell>
                <TableCell>
                  <Text size="sm" className="text-[var(--color-muted-foreground)]">
                    {src.lastSyncAt ? new Date(src.lastSyncAt).toLocaleString() : '—'}
                  </Text>
                </TableCell>
                <TableCell>
                  <SourceActions source={src} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
