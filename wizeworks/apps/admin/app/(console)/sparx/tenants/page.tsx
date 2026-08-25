import Link from 'next/link';
import { requireCapability } from '@wizeworks/operator-auth/next';
import { logOperatorAction } from '@wizeworks/operator-auth';
import { Input } from '@wizeworks/silicaui-react';
import { Badge, Button, Card, PageHeader, Stack, Text } from '@wizeworks/ui';
import { OperatorApiError, type OperatorTenantListResult } from '@wizeworks/operator';
import { operatorApi } from '@/lib/operator-api';
import { TenantsTable } from './_components/tenants-table';

const PAGE_SIZE = 50;

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string; campaign?: string }>;
}) {
  // Default-deny: only operators with support:read reach the tenant surface.
  const operator = await requireCapability('support:read');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const offset = Math.max(0, Number.parseInt(sp.offset ?? '', 10) || 0);
  // Arrives from a campaign row on the metrics page — "show me the accounts this
  // campaign actually produced". Exact match, so it reads the same number the
  // report does.
  const campaign = (sp.campaign ?? '').trim();

  // Audit the cross-tenant list view at the action level (§7). Best-effort — a
  // logging failure must never blank the page.
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'support:read',
      action: 'tenant.list.view',
    });
  } catch {
    // swallowed — see comment above
  }

  let result: OperatorTenantListResult | null = null;
  let error: string | null = null;
  try {
    result = await operatorApi().listTenants(
      { q: q || undefined, campaign: campaign || undefined, limit: PAGE_SIZE, offset },
      operator.id
    );
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title="Tenants"
        description="Every account on the platform. Search by name, slug, or email; open a tenant to see how its account is represented in the dashboard."
      />

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name, slug, or email"
          aria-label="Search tenants"
          className="max-w-sm"
        />
        {/* Carried through the search, or searching would silently widen the
            result set back to every tenant while the chip still says otherwise. */}
        {campaign ? <input type="hidden" name="campaign" value={campaign} /> : null}
        <Button type="submit" variant="soft">
          Search
        </Button>
      </form>

      {campaign ? (
        <Stack direction="row" align="center" gap={3} className="flex-wrap">
          <Text size="sm">Campaign</Text>
          <Badge color="info" variant="soft">
            {campaign}
          </Badge>
          <Link
            href={q ? `/sparx/tenants?q=${encodeURIComponent(q)}` : '/sparx/tenants'}
            className="text-module text-sm font-medium hover:underline"
          >
            Clear filter
          </Link>
        </Stack>
      ) : null}

      {error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : result && result.tenants.length > 0 ? (
        <Stack gap={3}>
          <TenantsTable tenants={result.tenants} />
          <Pager
            total={result.total}
            limit={result.limit}
            offset={result.offset}
            q={q}
            campaign={campaign}
          />
        </Stack>
      ) : (
        <Card>
          <Text>
            {campaign && q
              ? `No account from campaign “${campaign}” matches “${q}”.`
              : campaign
                ? `No account has come in from campaign “${campaign}” yet.`
                : q
                  ? `No tenants match “${q}”.`
                  : 'No tenants yet.'}
          </Text>
        </Card>
      )}
    </Stack>
  );
}

/** Offset pager — renders only when the result set is larger than one page. */
function Pager({
  total,
  limit,
  offset,
  q,
  campaign,
}: {
  total: number;
  limit: number;
  offset: number;
  q: string;
  campaign: string;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const hrefFor = (target: number): string => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (campaign) params.set('campaign', campaign);
    if (target > 0) params.set('offset', String(target));
    const qs = params.toString();
    return qs ? `/sparx/tenants?${qs}` : '/sparx/tenants';
  };
  const linkClass = 'text-sm font-medium text-module hover:underline';
  return (
    <Stack direction="row" align="center" justify="between">
      <Text size="sm" variant="muted">
        Showing {from}–{to} of {total}
      </Text>
      <Stack direction="row" align="center" gap={4}>
        {offset > 0 ? (
          <Link href={hrefFor(Math.max(0, offset - limit))} className={linkClass}>
            ← Previous
          </Link>
        ) : (
          <Text size="sm" variant="muted">
            ← Previous
          </Text>
        )}
        {offset + limit < total ? (
          <Link href={hrefFor(offset + limit)} className={linkClass}>
            Next →
          </Link>
        ) : (
          <Text size="sm" variant="muted">
            Next →
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
