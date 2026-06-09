export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Truck } from 'lucide-react';
import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';
import { NewSupplierButton } from './_components/new-supplier-button';
import { SupplierActions } from './_components/supplier-actions';

interface Supplier {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  pricingRule: { type: string; value: number } | null;
  notes: string | null;
  createdAt: string;
  credentials?: Record<string, string>;
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  connecting: 'warning',
  error: 'danger',
  disconnected: 'neutral',
};

function formatType(type: string) {
  const labels: Record<string, string> = {
    csv: 'CSV Feed',
    dsers: 'DSers',
    spocket: 'Spocket',
    faire: 'Faire',
    autods: 'AutoDS',
    custom: 'Custom',
  };
  return labels[type] ?? type;
}

function formatPricingRule(rule: { type: string; value: number } | null) {
  if (!rule) return '—';
  switch (rule.type) {
    case 'percentage_markup':
      return `+${rule.value}% markup`;
    case 'multiplier':
      return `×${rule.value}`;
    case 'flat_markup':
      return `+$${(rule.value / 100).toFixed(2)} flat`;
    case 'fixed_margin':
      return `${rule.value}% margin`;
    default:
      return rule.type;
  }
}

export default async function DropshipSuppliersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : undefined;
  const qs = new URLSearchParams({ take: '100' });
  if (q) qs.set('q', q);
  const { data: suppliers } = await api.getPaged<Supplier[]>(`/v1/dropship/suppliers?${qs}`);

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Truck className="h-5 w-5" />}
          title="Suppliers"
          badge={
            <Badge color="module" variant="soft">
              {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
            </Badge>
          }
          description="Connect suppliers to source and import products for dropshipping."
          actions={<NewSupplierButton />}
        />

        <ListToolbar searchPlaceholder="Search suppliers…" />

        {suppliers.length === 0 ? (
          <Card padding="none">
            <EmptyState
              title={q ? `No suppliers match "${q}"` : 'No suppliers connected'}
              description={
                q
                  ? 'Try a different search term.'
                  : 'Connect your first supplier to start importing dropship products.'
              }
              action={!q ? <NewSupplierButton /> : undefined}
            />
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Pricing rule</th>
                  <th className="px-4 py-3 text-left font-medium">Last synced</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--color-muted)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dropship/suppliers/${s.id}/catalog`}
                        className="font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                      {formatType(s.type)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLOR[s.status] ?? 'neutral'} variant="soft" size="sm">
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                      {formatPricingRule(s.pricingRule)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                      {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <SupplierActions supplier={{ ...s, credentials: s.credentials ?? {} }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Stack>
    </Container>
  );
}
