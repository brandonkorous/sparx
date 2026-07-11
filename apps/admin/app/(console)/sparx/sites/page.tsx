import Link from 'next/link';
import { requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { Button, Card, cn, Input, PageHeader, Stack, Text } from '@sparx/ui';
import { OperatorApiError, type OperatorSiteListResult } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { SitesTable } from './_components/sites-table';

const PAGE_SIZE = 50;

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; offset?: string }>;
}) {
  // Default-deny: only operators with site:read reach the site surface.
  const operator = await requireCapability('site:read');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = (sp.status ?? '').trim();
  const offset = Math.max(0, Number.parseInt(sp.offset ?? '', 10) || 0);

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'site:read',
      action: 'site.list.view',
    });
  } catch {
    // best-effort — a logging failure must never blank the page
  }

  let result: OperatorSiteListResult | null = null;
  let error: string | null = null;
  try {
    result = await operatorApi().listSites(
      { q: q || undefined, status: status || undefined, limit: PAGE_SIZE, offset },
      operator.id
    );
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title="Sites"
        description="Every website across the platform — each tenant’s public-facing site. Search by name or address; open a site to see its addresses and pause, archive, or reactivate it."
      />

      <form method="get" className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by site name or address"
          aria-label="Search sites"
          className="max-w-sm"
        />
        <StatusFilter current={status} q={q} />
        <Button type="submit" variant="soft">
          Search
        </Button>
      </form>

      {error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : result && result.sites.length > 0 ? (
        <Stack gap={3}>
          <SitesTable sites={result.sites} />
          <Pager
            total={result.total}
            limit={result.limit}
            offset={result.offset}
            q={q}
            status={status}
          />
        </Stack>
      ) : (
        <Card>
          <Text variant="muted">{q ? `No sites match “${q}”.` : 'No sites yet.'}</Text>
        </Card>
      )}
    </Stack>
  );
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

/** Status filter as click-through tabs (keeps the surface a plain GET form). */
function StatusFilter({ current, q }: { current: string; q: string }) {
  const hrefFor = (status: string): string => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    const qs = params.toString();
    return qs ? `/sparx/sites?${qs}` : '/sparx/sites';
  };
  return (
    <nav className="flex flex-wrap items-center gap-4" aria-label="Filter sites">
      {STATUS_TABS.map((tab) => {
        const active = tab.value === current;
        return (
          <Link
            key={tab.value || 'all'}
            href={hrefFor(tab.value)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'border-b-2 pb-1 text-sm font-medium transition-colors',
              active
                ? 'border-module text-base-content'
                : 'text-base-content/60 hover:text-base-content border-transparent'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Offset pager — renders only when the result set is larger than one page. */
function Pager({
  total,
  limit,
  offset,
  q,
  status,
}: {
  total: number;
  limit: number;
  offset: number;
  q: string;
  status: string;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const hrefFor = (target: number): string => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (target > 0) params.set('offset', String(target));
    const qs = params.toString();
    return qs ? `/sparx/sites?${qs}` : '/sparx/sites';
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
