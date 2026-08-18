import Link from 'next/link';
import { Badge, Card, cn, Stack, Text } from '@wizeworks/ui';
import type { OperatorDomainCounts } from '@wizeworks/operator';

// The domain-list chrome — the cross-tenant counts strip, the type/attention
// filter tabs, and the offset pager. All server-rendered; navigation is plain
// links (active reads as an underline, never a re-skinned pill), so the whole
// surface works without client JS. `hrefWith` (from the page) preserves the
// active filters across every link.

export type DomainType = 'custom' | 'purchased' | 'subdomain';

export interface DomainSearch {
  q?: string;
  type?: string;
  status?: string;
  tenantId?: string;
  attention?: string;
  offset?: string;
}

type HrefWith = (overrides: Partial<DomainSearch>) => string;

/** The cross-tenant overview strip — custom / purchased / subdomain totals plus
 *  the two operator-signal counts (needs attention, expiring soon). */
export function CountsStrip({
  counts,
  hrefWith,
}: {
  counts: OperatorDomainCounts;
  hrefWith: HrefWith;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat
        label="Custom"
        value={counts.custom}
        href={hrefWith({ type: 'custom', attention: undefined, offset: undefined })}
      />
      <Stat
        label="Purchased"
        value={counts.purchased}
        href={hrefWith({ type: 'purchased', attention: undefined, offset: undefined })}
      />
      <Stat
        label="sparx.zone"
        value={counts.subdomain}
        href={hrefWith({ type: 'subdomain', attention: undefined, offset: undefined })}
      />
      <Stat
        label="Need attention"
        value={counts.needsAttention}
        flag={counts.needsAttention > 0}
        href={hrefWith({ type: undefined, attention: '1', offset: undefined })}
      />
      <Stat
        label="Expiring soon"
        value={counts.expiringSoon}
        flag={counts.expiringSoon > 0}
        href={hrefWith({ type: 'purchased', attention: undefined, offset: undefined })}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  flag,
}: {
  label: string;
  value: number;
  href: string;
  /** When true (a non-zero operator-signal count), show a warning marker. */
  flag?: boolean;
}) {
  return (
    <Link href={href} className="hover:bg-base-200 block rounded-lg transition-colors">
      <Card>
        <Stack gap={1}>
          <Stack direction="row" align="center" justify="between">
            <Text size="sm" variant="muted">
              {label}
            </Text>
            {flag ? (
              <Badge color="warning" variant="soft" size="sm">
                !
              </Badge>
            ) : null}
          </Stack>
          <Text className="text-2xl font-medium tabular-nums">{value}</Text>
        </Stack>
      </Card>
    </Link>
  );
}

/** Type + attention filter tabs (server-rendered links; active reads as an
 *  underline, never a re-skinned pill). */
export function FilterTabs({
  active,
  attention,
  hrefWith,
}: {
  active: DomainType | undefined;
  attention: boolean;
  hrefWith: HrefWith;
}) {
  const tabs: { key: string; label: string; href: string; isActive: boolean }[] = [
    {
      key: 'all',
      label: 'All',
      href: hrefWith({ type: undefined, attention: undefined, offset: undefined }),
      isActive: !active && !attention,
    },
    {
      key: 'custom',
      label: 'Custom',
      href: hrefWith({ type: 'custom', attention: undefined, offset: undefined }),
      isActive: active === 'custom',
    },
    {
      key: 'purchased',
      label: 'Purchased',
      href: hrefWith({ type: 'purchased', attention: undefined, offset: undefined }),
      isActive: active === 'purchased',
    },
    {
      key: 'subdomain',
      label: 'sparx.zone',
      href: hrefWith({ type: 'subdomain', attention: undefined, offset: undefined }),
      isActive: active === 'subdomain',
    },
    {
      key: 'attention',
      label: 'Needs attention',
      href: hrefWith({ type: undefined, attention: '1', offset: undefined }),
      isActive: attention,
    },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-4" aria-label="Filter domains">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.isActive ? 'page' : undefined}
          className={cn(
            'border-b-2 pb-1 text-sm font-medium transition-colors',
            tab.isActive
              ? 'border-module text-base-content'
              : 'text-base-content hover:text-base-content border-transparent'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Offset pager — renders only when the result set exceeds one page. */
export function Pager({
  total,
  limit,
  offset,
  hrefWith,
}: {
  total: number;
  limit: number;
  offset: number;
  hrefWith: HrefWith;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  const linkClass = 'text-sm font-medium text-module hover:underline';
  const prevOffset = Math.max(0, offset - limit);
  return (
    <Stack direction="row" align="center" justify="between">
      <Text size="sm" variant="muted">
        Showing {from}–{to} of {total}
      </Text>
      <Stack direction="row" align="center" gap={4}>
        {offset > 0 ? (
          <Link
            href={hrefWith({ offset: prevOffset > 0 ? String(prevOffset) : undefined })}
            className={linkClass}
          >
            ← Previous
          </Link>
        ) : (
          <Text size="sm" variant="muted">
            ← Previous
          </Text>
        )}
        {offset + limit < total ? (
          <Link href={hrefWith({ offset: String(offset + limit) })} className={linkClass}>
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
