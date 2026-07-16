import Link from 'next/link';
import { Button, cn, Input } from '@sparx/ui';
import type { OperatorFeedbackCounts } from '@sparx/operator';
import {
  categoryLabel,
  feedbackStatusLabel,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
} from '@/lib/feedback';

export interface FeedbackSearch {
  status?: string;
  category?: string;
  tenantId?: string;
  assigneeStaffId?: string;
  tag?: string;
  q?: string;
  page?: string;
}

type HrefWith = (overrides: Partial<FeedbackSearch>) => string;

// Queue chips (status, with counts) + a category row. Server-rendered links;
// active reads as an underline, never a filled pill. Counts come from the
// cross-tenant scan and reflect the current base filter (tenant/tag/search).
export function InboxFilters({
  counts,
  activeStatus,
  activeCategory,
  hrefWith,
}: {
  counts: OperatorFeedbackCounts;
  activeStatus: string | undefined;
  activeCategory: string | undefined;
  hrefWith: HrefWith;
}) {
  return (
    <div className="flex flex-col gap-3">
      <nav className="flex flex-wrap items-center gap-4" aria-label="Filter by status">
        <Chip
          label="All"
          count={counts.total}
          href={hrefWith({ status: undefined, page: undefined })}
          active={!activeStatus}
        />
        {FEEDBACK_STATUSES.map((s) => (
          <Chip
            key={s}
            label={feedbackStatusLabel(s)}
            count={counts.byStatus[s] ?? 0}
            href={hrefWith({ status: s, page: undefined })}
            active={activeStatus === s}
          />
        ))}
      </nav>
      <nav className="flex flex-wrap items-center gap-4" aria-label="Filter by category">
        <Chip
          label="All types"
          href={hrefWith({ category: undefined, page: undefined })}
          active={!activeCategory}
          small
        />
        {FEEDBACK_CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={categoryLabel(c)}
            count={counts.byCategory[c] ?? 0}
            href={hrefWith({ category: c, page: undefined })}
            active={activeCategory === c}
            small
          />
        ))}
      </nav>
    </div>
  );
}

// The quick-filter row: "Assigned to me" toggle + clear-chips for an active
// tenant / tag deep-link. Kept with the other inbox chrome.
export function QuickFilters({
  operatorId,
  activeAssignee,
  tenantId,
  tag,
  hrefWith,
}: {
  operatorId: string;
  activeAssignee: string | undefined;
  tenantId: string | undefined;
  tag: string | undefined;
  hrefWith: HrefWith;
}) {
  const mineActive = activeAssignee === operatorId;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Link
        href={hrefWith({ assigneeStaffId: mineActive ? undefined : operatorId, page: undefined })}
        className={cn(
          'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
          mineActive
            ? 'border-module text-base-content'
            : 'border-base-300 text-base-content hover:text-base-content'
        )}
      >
        Assigned to me
      </Link>
      {tenantId ? (
        <Link
          href={hrefWith({ tenantId: undefined, page: undefined })}
          className="text-module text-sm font-medium hover:underline"
        >
          Clear tenant filter
        </Link>
      ) : null}
      {tag ? (
        <Link
          href={hrefWith({ tag: undefined, page: undefined })}
          className="text-module text-sm font-medium hover:underline"
        >
          Clear tag “{tag}”
        </Link>
      ) : null}
    </div>
  );
}

// Free-text search — a GET form that preserves the active filters as hidden fields.
export function FeedbackSearchForm({ q, hidden }: { q: string; hidden: Partial<FeedbackSearch> }) {
  return (
    <form method="get" className="flex gap-2">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={String(value)} /> : null
      )}
      <Input
        name="q"
        defaultValue={q}
        placeholder="Search feedback text"
        aria-label="Search feedback"
        className="max-w-sm"
      />
      <Button type="submit" variant="soft">
        Search
      </Button>
    </form>
  );
}

function Chip({
  label,
  count,
  href,
  active,
  small,
}: {
  label: string;
  count?: number;
  href: string;
  active: boolean;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'border-b-2 pb-1 font-medium transition-colors',
        small ? 'text-xs' : 'text-sm',
        active
          ? 'border-module text-base-content'
          : 'text-base-content hover:text-base-content border-transparent'
      )}
    >
      {label}
      {count !== undefined ? <span className="ml-1.5 tabular-nums opacity-70">{count}</span> : null}
    </Link>
  );
}
