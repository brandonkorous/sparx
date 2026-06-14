export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { api } from '@/lib/api-rest-client';
import { Text } from '@sparx/ui';

import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { LocationsList, type StockLocation } from './_components/locations-list';

export const metadata: Metadata = { title: 'Stock Locations' };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StockLocationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [prefs, locations] = await Promise.all([
    getUserPreferences(),
    api.get<StockLocation[]>('/v1/inventory/locations'),
  ]);

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
        <p className="mt-1 text-[var(--color-muted-foreground)]">
          Physical and virtual locations where inventory is held.
        </p>
      </div>

      <ListToolbar enableViewToggle searchable={false} />

      {locations.length === 0 ? (
        <Text className="text-[var(--color-muted-foreground)]">
          No stock locations configured yet.
        </Text>
      ) : (
        <div className="mt-6">
          <LocationsList rows={locations} view={view} />
        </div>
      )}
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
