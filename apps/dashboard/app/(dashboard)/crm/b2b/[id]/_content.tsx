import { notFound } from 'next/navigation';
import { Building2, AlertTriangle, Globe } from 'lucide-react';

import { Stat, statusLabel, statusTone } from '@sparx/ui';
import { Badge, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { CreditHoldToggle } from './_components/credit-hold-toggle';

interface B2bAccount {
  id: string;
  companyName: string;
  status: string;
  pricingTier: string | null;
  website: string | null;
  creditLimit: string | number;
  creditUsed: string | number;
  discountPercent: string | number;
  engineProfiles: unknown;
  notes: string | null;
}

// Detail content for a B2B account. Mounted by the full-page route and by
// the dashboard shell's drawer / modal. Full-page chrome lives in
// page.tsx; this component renders content only.

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export async function B2bAccountDetailContent({ id }: Props) {
  let account: B2bAccount;
  try {
    account = await api.get<B2bAccount>(`/v1/crm/b2b-accounts/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const limit = Number(account.creditLimit);
  const used = Number(account.creditUsed);
  const remaining = Math.max(0, limit - used);
  const utilization = limit > 0 ? (used / limit) * 100 : 0;
  const profiles: unknown[] = Array.isArray(account.engineProfiles) ? account.engineProfiles : [];

  return (
    // @container so the body responds to its OWN width — full-page (wide) vs. the
    // detail drawer (narrow), where viewport breakpoints would crush the columns.
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <Building2 className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{account.companyName}</h1>
            <Badge color={statusTone(account.status)} variant="soft">
              {statusLabel(account.status)}
            </Badge>
            {account.pricingTier && <Badge color="module">{account.pricingTier}</Badge>}
            {account.website && (
              <a
                href={account.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-module flex items-center gap-1 text-sm hover:underline"
              >
                <Globe className="h-3.5 w-3.5" /> Website
              </a>
            )}
          </div>
          <CreditHoldToggle accountId={account.id} currentStatus={account.status} />
        </div>
      </div>

      <div className="grid gap-4 @[440px]:grid-cols-2 @[820px]:grid-cols-4">
        <Card className="bg-module bg-soft">
          <CardBody className="py-4">
            <Stat label="Credit limit" value={`$${limit.toLocaleString()}`} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat label="Used" value={`$${used.toLocaleString()}`} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat label="Remaining" value={`$${remaining.toLocaleString()}`} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat label="Discount" value={`${Number(account.discountPercent)}%`} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <CardTitle>Credit utilization</CardTitle>
          <div className="flex flex-col gap-2">
            <div className="bg-base-200 h-3 rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, utilization).toFixed(1)}%`,
                  backgroundColor:
                    utilization >= 90
                      ? 'var(--color-danger)'
                      : utilization >= 75
                        ? 'var(--color-warning)'
                        : 'var(--color-module)',
                }}
              />
            </div>
            <div className="flex flex-row justify-between">
              <p className="text-base-content/70 text-sm">{utilization.toFixed(1)}% used</p>
              {utilization >= 75 && (
                <div className="flex flex-row items-center gap-1">
                  <AlertTriangle className="text-warning h-3.5 w-3.5" />
                  <p className="text-warning text-sm">Near credit limit</p>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {profiles.length > 0 && (
        <Card>
          <CardBody>
            <CardTitle>Engine profiles</CardTitle>
            <div className="flex flex-col gap-2">
              {profiles.map((p: unknown, idx: number) => (
                <div
                  key={idx}
                  className="border-base-300 flex flex-row gap-3 rounded-md border p-3"
                >
                  <Badge color="neutral" variant="soft" size="sm">
                    {(p as { year?: number }).year ?? '—'}
                  </Badge>
                  <p className="text-sm">
                    {(p as { make?: string }).make ?? '—'} {(p as { model?: string }).model ?? ''}
                  </p>
                  {(p as { engine?: string }).engine && (
                    <p className="text-base-content/70 text-sm">
                      {(p as { engine?: string }).engine}
                    </p>
                  )}
                  {(p as { count?: number }).count !== undefined && (
                    <Badge color="neutral" variant="soft" size="sm" className="ml-auto">
                      ×{(p as { count?: number }).count}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {account.notes && (
        <Card>
          <CardBody>
            <CardTitle>Notes</CardTitle>
            <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
