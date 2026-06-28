import { notFound } from 'next/navigation';
import {
  Building2,
  AlertTriangle,
  CheckCircle,
  Globe,
  DollarSign,
  PackageCheck,
} from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Heading,
  Stack,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { B2bTierAssigner } from './_components/b2b-tier-assigner';
import { B2bAccountOverridesTable } from './_components/b2b-account-overrides-table';
import { FleetProfileEditor, type FleetVehicleView } from './_components/fleet-profile-editor';
import { ApprovalRulesEditor } from './_components/approval-rules-editor';
import { FleetHoldsPanel, type FleetHold } from './_components/fleet-holds-panel';

export const dynamic = 'force-dynamic';

interface B2bAccount {
  id: string;
  companyName: string;
  taxId: string | null;
  website: string | null;
  status: string;
  pricingTierId: string | null;
  pricingTierName: string | null;
  pricingTier: {
    id: string;
    name: string;
    discountType: string;
    discountValue: number;
  } | null;
  creditLimitCents: number;
  creditUsedCents: number;
  creditRemainingCents: number;
  creditUtilizationPct: number;
  paymentTerms: string | null;
  discountPercent: number;
  fleetSize: number | null;
  fleetVehicles: FleetVehicleView[];
  notes: string | null;
  overrideCount?: number;
}

interface Override {
  id: string;
  variantId: string | null;
  collectionId: string | null;
  priceCents: number | null;
  discountPercentage: string | null;
  notes: string | null;
  variant?: { id: string; sku: string; title: string } | null;
  collection?: { id: string; title: string } | null;
}

interface PricingTierOption {
  id: string;
  name: string;
  discountType: string;
  discountValue: number;
}

interface ApprovalRule {
  id: string;
  accountId: string | null;
  accountName: string | null;
  minAmountCents: number;
  minAmountFormatted: string;
  requiredApproverUserId: string | null;
  requiredApproverName: string | null;
  isActive: boolean;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'danger'> = {
  active: 'success',
  credit_hold: 'warning',
  suspended: 'danger',
  inactive: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  credit_hold: 'Credit hold',
  suspended: 'Suspended',
  inactive: 'Inactive',
};

function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// The node path (root → self, e.g. "Ford / F-250 / 6.7L"), falling back to the
// node name, then the domain name (a whole-domain fleet entry).
function fleetFitmentLabel(v: FleetVehicleView): string {
  if (v.nodePath && v.nodePath.length > 0) return v.nodePath.join(' / ');
  if (v.nodeName) return v.nodeName;
  return v.domainName ?? '—';
}

// The per-vehicle range values, labelled with their dimension + unit when the
// server resolved them (e.g. "Year 2020"); falls back to raw key/value pairs.
function fleetDetailLabel(v: FleetVehicleView): string {
  const parts = v.ranges?.length
    ? v.ranges.map((r) => `${r.label} ${r.value}${r.unit ? ` ${r.unit}` : ''}`)
    : (v.rangeValues ?? []).map((r) => `${r.dimensionKey} ${r.value}`);
  if (v.mileage !== undefined) parts.push(`${v.mileage.toLocaleString('en-US')} mi`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

interface Props {
  id: string;
}

export async function B2bAccountDetailContent({ id }: Props) {
  let account: B2bAccount;
  let overrides: Override[] = [];
  let tiers: PricingTierOption[] = [];
  let approvalRules: ApprovalRule[] = [];

  try {
    [account, { data: overrides }, { data: tiers }, { rules: approvalRules }] = await Promise.all([
      api.get<B2bAccount>(`/v1/b2b/accounts/${id}`),
      api.getPaged<Override[]>(`/v1/b2b/accounts/${id}/overrides`),
      api.getPaged<PricingTierOption[]>('/v1/b2b/pricing-tiers'),
      api.get<{ rules: ApprovalRule[] }>('/v1/b2b/approval-rules'),
    ]);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  // Filter to rules scoped to this account only (not tenant-wide rules).
  const accountRules = approvalRules.filter((r) => r.accountId === id);

  // Fleet / work-order holds (docs/100 P6d) — degrade to empty if the consuming
  // inventory surface is unavailable rather than failing the whole page.
  let holds: FleetHold[] = [];
  try {
    holds = (await api.getPaged<FleetHold[]>(`/v1/b2b/accounts/${id}/holds`)).data;
  } catch {
    holds = [];
  }

  const util = account.creditUtilizationPct;
  const utilColor =
    util >= 90
      ? 'var(--color-danger-500)'
      : util >= 75
        ? 'var(--color-warning-500)'
        : 'var(--module-active)';

  const fleetVehicles: FleetVehicleView[] = account.fleetVehicles ?? [];

  return (
    <Stack gap={6}>
      {/* Header */}
      <Stack direction="row" align="center" justify="between" wrap gap={3}>
        <Stack direction="row" align="center" gap={3} wrap>
          <Building2 className="h-5 w-5" />
          <Heading level={1}>{account.companyName}</Heading>
          <Badge color={STATUS_VARIANT[account.status] ?? 'outline'}>
            {STATUS_LABEL[account.status] ?? account.status}
          </Badge>
          {account.pricingTierName && (
            <Badge color="module" variant="outline">
              {account.pricingTierName}
            </Badge>
          )}
          {account.website && (
            <a
              href={account.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm hover:text-[var(--module-active)] hover:underline"
            >
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          )}
        </Stack>
      </Stack>

      {/* Credit stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="module">
          <CardContent className="py-4">
            <Stat label="Credit limit" value={formatDollars(account.creditLimitCents)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Stat label="Used" value={formatDollars(account.creditUsedCents)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Stat label="Remaining" value={formatDollars(account.creditRemainingCents)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <Stat
              label="Account discount"
              value={account.discountPercent > 0 ? `${account.discountPercent}%` : '—'}
            />
          </CardContent>
        </Card>
      </div>

      {/* Credit utilization bar */}
      <Card>
        <CardHeader>
          <CardTitle>Credit utilization</CardTitle>
          {account.paymentTerms && (
            <CardDescription>Payment terms: {account.paymentTerms}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Stack gap={2}>
            <div className="h-3 rounded-full bg-[var(--color-surface-subtle)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, util).toFixed(1)}%`,
                  backgroundColor: utilColor,
                }}
              />
            </div>
            <Stack direction="row" justify="between">
              <Text size="sm" variant="muted">
                {util.toFixed(1)}% used
              </Text>
              {util >= 75 && (
                <Stack direction="row" align="center" gap={1}>
                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning-500)]" />
                  <Text size="sm" className="text-[var(--color-warning-500)]">
                    Near credit limit
                  </Text>
                </Stack>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Pricing tier assignment */}
      <Card>
        <CardHeader>
          <Stack direction="row" align="center" gap={2}>
            <DollarSign className="h-4 w-4" />
            <CardTitle>Pricing tier</CardTitle>
          </Stack>
          <CardDescription>
            Assign a pricing tier to apply automatic discounts. Account-level overrides below take
            precedence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <B2bTierAssigner
            accountId={account.id}
            currentTierId={account.pricingTierId}
            tiers={tiers}
          />
        </CardContent>
      </Card>

      {/* Account-level product overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Product overrides</CardTitle>
          <CardDescription>
            Variant or collection-specific prices that override the assigned tier for this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <B2bAccountOverridesTable accountId={account.id} overrides={overrides} />
        </CardContent>
      </Card>

      {/* Fleet */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fleet</CardTitle>
            {account.fleetSize !== null && (
              <CardDescription>{account.fleetSize} vehicles in fleet</CardDescription>
            )}
          </div>
          <FleetProfileEditor accountId={account.id} initialVehicles={fleetVehicles} />
        </CardHeader>
        {fleetVehicles.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Fitment</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fleetVehicles.map((v, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Text size="sm" className="font-medium">
                        {v.label ?? '—'}
                      </Text>
                      {v.vin && (
                        <Text size="sm" variant="muted">
                          VIN {v.vin}
                        </Text>
                      )}
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{fleetFitmentLabel(v)}</Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{fleetDetailLabel(v)}</Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">×{v.count ?? 1}</Text>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* Fleet / work-order holds */}
      <Card>
        <CardHeader>
          <Stack direction="row" align="center" gap={2}>
            <PackageCheck className="h-4 w-4" />
            <CardTitle>Fleet holds</CardTitle>
          </Stack>
          <CardDescription>
            Reserve stock against inventory for this account&apos;s work orders before the order is
            placed. Release frees the stock; consume commits it when the job ships.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FleetHoldsPanel accountId={account.id} holds={holds} />
        </CardContent>
      </Card>

      {/* Approval rules */}
      <Card>
        <CardHeader>
          <Stack direction="row" align="center" gap={2}>
            <CheckCircle className="h-4 w-4" />
            <CardTitle>Order approval rules</CardTitle>
          </Stack>
          <CardDescription>
            Orders from this account above the configured threshold will be held for staff approval
            before being placed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApprovalRulesEditor accountId={account.id} rules={accountRules} />
        </CardContent>
      </Card>

      {/* Internal notes */}
      {account.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Internal notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Text size="sm" className="whitespace-pre-wrap">
              {account.notes}
            </Text>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
