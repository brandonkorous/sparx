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

export const metadata: Metadata = { title: 'Stock Locations' };

interface StockLocation {
  id: string;
  name: string;
  type: string;
  countryCode: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  warehouse: 'Warehouse',
  bin: 'Bin',
  '3pl': '3PL',
  virtual: 'Virtual',
  transit: 'Transit',
};

export default async function StockLocationsPage() {
  const locations = await api.get<StockLocation[]>('/v1/inventory/locations');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
        <p className="mt-1 text-[var(--color-muted-foreground)]">
          Physical and virtual locations where inventory is held.
        </p>
      </div>

      {locations.length === 0 ? (
        <Text className="text-[var(--color-muted-foreground)]">
          No stock locations configured yet.
        </Text>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium">
                  {loc.name}
                  {loc.isDefault && (
                    <Badge color="primary" variant="soft" size="sm" className="ml-2">
                      Default
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{TYPE_LABELS[loc.type] ?? loc.type}</TableCell>
                <TableCell>{loc.countryCode ?? '—'}</TableCell>
                <TableCell>
                  <Badge color={loc.active ? 'success' : 'neutral'} variant="soft" size="sm">
                    {loc.active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
