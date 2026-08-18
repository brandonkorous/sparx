import Link from 'next/link';
import { requireCapability } from '@wizeworks/operator-auth/next';
import { logOperatorAction } from '@wizeworks/operator-auth';
import { Input } from '@wizeworks/silicaui-react';
import { Button, Card, PageHeader, Stack, Text } from '@wizeworks/ui';
import { OperatorApiError, type OperatorDomainListResult } from '@wizeworks/operator';
import { operatorApi } from '@/lib/operator-api';
import { DomainsTable } from './_components/domains-table';
import {
  CountsStrip,
  FilterTabs,
  Pager,
  type DomainSearch,
  type DomainType,
} from './_components/domain-list-controls';

const PAGE_SIZE = 50;

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<DomainSearch>;
}) {
  // Default-deny: the domain surface is gated on the single domain:manage capability.
  const operator = await requireCapability('domain:manage');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const type: DomainType | undefined =
    sp.type === 'custom' || sp.type === 'purchased' || sp.type === 'subdomain'
      ? sp.type
      : undefined;
  const tenantIdInput = sp.tenantId?.trim() ?? '';
  const tenantId = tenantIdInput.length > 0 ? tenantIdInput : undefined;
  const attention = sp.attention === '1';
  const offset = Math.max(0, Number.parseInt(sp.offset ?? '', 10) || 0);

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'domain:manage',
      action: 'domain.list.view',
      targetTenantId: tenantId,
    });
  } catch {
    // best-effort audit — never blank the page on a logging failure
  }

  let result: OperatorDomainListResult | null = null;
  let error: string | null = null;
  try {
    result = await operatorApi().listDomains(
      {
        q: q || undefined,
        type,
        tenantId,
        attention: attention || undefined,
        limit: PAGE_SIZE,
        offset,
      },
      operator.id
    );
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  // Preserve the active filters across search / filter-link / pager navigation.
  const base: DomainSearch = {
    ...(q ? { q } : {}),
    ...(type ? { type } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(attention ? { attention: '1' } : {}),
  };
  const hrefWith = (overrides: Partial<DomainSearch>): string => {
    const merged: DomainSearch = { ...base, ...overrides };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/sparx/domains?${qs}` : '/sparx/domains';
  };

  const tenantName = tenantId ? result?.domains[0]?.tenantName : undefined;

  return (
    <Stack gap={6}>
      <PageHeader
        title="Domains"
        description="Every custom and sparx-purchased domain across the platform — routing status, SSL readiness, DNS verification, and registration history. Open a domain to inspect its DNS or force a re-verify."
      />

      {tenantId ? (
        <Card>
          <Stack direction="row" align="center" justify="between" className="flex-wrap gap-2">
            <Text size="sm" variant="muted">
              Filtered to{' '}
              {tenantName ? <span className="font-medium">{tenantName}</span> : 'one tenant'}.
            </Text>
            <Link
              href={hrefWith({ tenantId: undefined, offset: undefined })}
              className="text-module text-sm font-medium hover:underline"
            >
              Clear tenant filter
            </Link>
          </Stack>
        </Card>
      ) : null}

      {result ? <CountsStrip counts={result.counts} hrefWith={hrefWith} /> : null}

      <Stack direction="row" align="center" justify="between" className="flex-wrap gap-3">
        <FilterTabs active={type} attention={attention} hrefWith={hrefWith} />
        <form method="get" className="flex gap-2">
          {type ? <input type="hidden" name="type" value={type} /> : null}
          {tenantId ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
          {attention ? <input type="hidden" name="attention" value="1" /> : null}
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by host"
            aria-label="Search domains"
            className="max-w-xs"
          />
          <Button type="submit" variant="soft">
            Search
          </Button>
        </form>
      </Stack>

      {error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : result && result.domains.length > 0 ? (
        <Stack gap={3}>
          <DomainsTable domains={result.domains} />
          <Pager
            total={result.total}
            limit={result.limit}
            offset={result.offset}
            hrefWith={hrefWith}
          />
        </Stack>
      ) : (
        <Card>
          <Text variant="muted">
            {q
              ? `No domains match “${q}”.`
              : attention
                ? 'No domains need attention — everything is verified and live.'
                : 'No domains yet.'}
          </Text>
        </Card>
      )}
    </Stack>
  );
}
