import Link from 'next/link';
import { requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { Button, Card, Input, PageHeader, Stack, Text } from '@sparx/ui';
import { OperatorApiError, type OperatorUserListResult } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { UsersTable } from './_components/users-table';

const PAGE_SIZE = 50;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  // Default-deny: only operators with user:read reach the staff-user surface.
  const operator = await requireCapability('user:read');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const offset = Math.max(0, Number.parseInt(sp.offset ?? '', 10) || 0);

  // Audit the cross-tenant list view at the action level. Best-effort — a logging
  // failure must never blank the page.
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'user:read',
      action: 'user.list.view',
    });
  } catch {
    // swallowed — see comment above
  }

  let result: OperatorUserListResult | null = null;
  let error: string | null = null;
  try {
    result = await operatorApi().listUsers(
      { q: q || undefined, limit: PAGE_SIZE, offset },
      operator.id
    );
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title="Users"
        description="Every staff member across the platform — the people who sign in to a dashboard. Search by name or email; open a user to see their tenants and take action."
      />

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name or email"
          aria-label="Search users"
          className="max-w-sm"
        />
        <Button type="submit" variant="soft">
          Search
        </Button>
      </form>

      {error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : result && result.users.length > 0 ? (
        <Stack gap={3}>
          <UsersTable users={result.users} />
          <Pager total={result.total} limit={result.limit} offset={result.offset} q={q} />
        </Stack>
      ) : (
        <Card>
          <Text variant="muted">{q ? `No users match “${q}”.` : 'No users yet.'}</Text>
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
}: {
  total: number;
  limit: number;
  offset: number;
  q: string;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const hrefFor = (target: number): string => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (target > 0) params.set('offset', String(target));
    const qs = params.toString();
    return qs ? `/sparx/users?${qs}` : '/sparx/users';
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
