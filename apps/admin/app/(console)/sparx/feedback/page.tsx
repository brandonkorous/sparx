import Link from 'next/link';
import { requireCapability } from '@sparx/operator-auth/next';
import { getOperatorsByIds, logOperatorAction, type OperatorSummary } from '@sparx/operator-auth';
import { Card, PageHeader, Stack, Text } from '@sparx/ui';
import { OperatorApiError, type OperatorFeedbackListResult } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { FeedbackTable } from './_components/feedback-table';
import {
  FeedbackSearchForm,
  InboxFilters,
  QuickFilters,
  type FeedbackSearch,
} from './_components/inbox-filters';

/** Trimmed value, or undefined when blank (empty filters drop out of the query). */
function trimToUndefined(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t && t.length > 0 ? t : undefined;
}

export default async function FeedbackInboxPage({
  searchParams,
}: {
  searchParams: Promise<FeedbackSearch>;
}) {
  const operator = await requireCapability('feedback:respond');
  const sp = await searchParams;
  const status = trimToUndefined(sp.status);
  const category = trimToUndefined(sp.category);
  const tenantId = trimToUndefined(sp.tenantId);
  const assigneeStaffId = trimToUndefined(sp.assigneeStaffId);
  const tag = trimToUndefined(sp.tag);
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? '', 10) || 1);

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'feedback:respond',
      action: 'feedback.inbox.view',
      targetTenantId: tenantId,
    });
  } catch {
    // best-effort audit
  }

  let result: OperatorFeedbackListResult | null = null;
  let error: string | null = null;
  try {
    result = await operatorApi().listFeedback(
      { status, category, tenantId, assigneeStaffId, tag, q: q || undefined, page },
      operator.id
    );
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  // Resolve assignee ids → names (api-rest returns the bare wize_admin id).
  const assigneeIds = [
    ...new Set(
      (result?.submissions ?? [])
        .map((s) => s.assigneeStaffId)
        .filter((v): v is string => Boolean(v))
    ),
  ];
  const operators = await getOperatorsByIds(assigneeIds).catch(
    (): Map<string, OperatorSummary> => new Map()
  );
  const assigneeNames: Record<string, string> = {};
  for (const [id, op] of operators) assigneeNames[id] = op.name ?? op.email;

  const base: FeedbackSearch = {
    ...(category ? { category } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(assigneeStaffId ? { assigneeStaffId } : {}),
    ...(tag ? { tag } : {}),
    ...(q ? { q } : {}),
  };
  const hrefWith = (overrides: Partial<FeedbackSearch>): string => {
    const merged = { ...base, status, ...overrides };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, String(value));
    const qs = params.toString();
    return qs ? `/sparx/feedback?${qs}` : '/sparx/feedback';
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Feedback"
        description="Every idea, problem, question, and bit of praise from across the platform. Triage, assign, and reply — the response closes the loop back to the submitter."
      />

      <QuickFilters
        operatorId={operator.id}
        activeAssignee={assigneeStaffId}
        tenantId={tenantId}
        tag={tag}
        hrefWith={hrefWith}
      />

      {result ? (
        <InboxFilters
          counts={result.counts}
          activeStatus={status}
          activeCategory={category}
          hrefWith={hrefWith}
        />
      ) : null}

      <FeedbackSearchForm q={q} hidden={{ status, category, tenantId, assigneeStaffId, tag }} />

      {error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : result && result.submissions.length > 0 ? (
        <Stack gap={3}>
          {result.truncated ? (
            <Text size="xs" variant="muted">
              Some tenants have more feedback than a single scan returns — counts are a floor.
            </Text>
          ) : null}
          <FeedbackTable submissions={result.submissions} assigneeNames={assigneeNames} />
          <Pager
            total={result.total}
            page={result.page}
            perPage={result.perPage}
            hrefWith={hrefWith}
          />
        </Stack>
      ) : (
        <Card>
          <Text variant="muted">
            {q ? `No feedback matches “${q}”.` : 'No feedback matches these filters.'}
          </Text>
        </Card>
      )}
    </Stack>
  );
}

/** Page-number pager — renders only when the result set exceeds one page. */
function Pager({
  total,
  page,
  perPage,
  hrefWith,
}: {
  total: number;
  page: number;
  perPage: number;
  hrefWith: (o: Partial<FeedbackSearch>) => string;
}) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const linkClass = 'text-sm font-medium text-module hover:underline';
  return (
    <Stack direction="row" align="center" justify="between">
      <Text size="sm" variant="muted">
        Showing {from}–{to} of {total}
      </Text>
      <Stack direction="row" align="center" gap={4}>
        {page > 1 ? (
          <Link
            href={hrefWith({ page: page > 2 ? String(page - 1) : undefined })}
            className={linkClass}
          >
            ← Previous
          </Link>
        ) : (
          <Text size="sm" variant="muted">
            ← Previous
          </Text>
        )}
        {page < pages ? (
          <Link href={hrefWith({ page: String(page + 1) })} className={linkClass}>
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
