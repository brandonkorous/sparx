import Link from 'next/link';
import { Users, Plus, Building2, UserPlus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Container,
  EmptyState,
  Grid,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { getActivePropertyId, listProperties, type Property } from '@/lib/sites';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { EntityRowLink } from '../../_components/entity-row-link';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';

interface CustomerListRow {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  doNotContact: boolean;
  orderCount: number;
  totalSpent: string | number;
  lastOrderAt: string | null;
  updatedAt: string;
}

// Typesense customer search document (the subset this list needs). Returned by
// /v1/search/customers — typo-tolerant across name / email / company.
interface CustomerSearchDoc {
  customer_id: string;
  full_name: string;
  email?: string;
  company?: string;
  type: 'prospect' | 'retail' | 'b2b';
  total_spent_cents: number;
  order_count: number;
  last_order_at?: number; // epoch seconds
  created_at: number; // epoch seconds
}

// CRM customers list — the customer table with filter bar. Reached from the
// CRM overview (/crm) and the "Customers" panel section.
//
// Filter state lives in the URL (?type=b2b&tag=fleet&q=acme) so links and
// the browser back-button work, and so saved-view objects can serialize
// straight from the query string. The CRM module gate runs in the parent
// layout.tsx.

export const dynamic = 'force-dynamic';

const TYPE_LABELS = {
  prospect: 'Prospect',
  retail: 'Customer',
  b2b: 'B2B contact',
} as const;

const VALID_SORTS = ['updatedAt', 'createdAt', 'totalSpent', 'lastOrderAt'] as const;
type SortKey = (typeof VALID_SORTS)[number];

const TYPE_OPTIONS = [
  { value: 'prospect', label: 'Prospects' },
  { value: 'retail', label: 'Customers' },
  { value: 'b2b', label: 'B2B' },
];

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Recently updated' },
  { value: 'createdAt', label: 'Recently created' },
  { value: 'lastOrderAt', label: 'Last order' },
  { value: 'totalSpent', label: 'Lifetime value' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CrmCustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = stringParam(params.type);
  const tag = stringParam(params.tag);
  const q = stringParam(params.q);
  const sort = (VALID_SORTS as readonly string[]).includes(stringParam(params.sort) ?? '')
    ? (stringParam(params.sort) as SortKey)
    : ('updatedAt' satisfies SortKey);
  // Membership site filter (docs/58 D2) — follows the global site switcher:
  // absent → the active site; `all` → the whole tenant; an id → that site.
  const siteParam = stringParam(params.site);

  // With a query, search via Typesense (typo-tolerant across name / email /
  // company); without one, list straight from Postgres with the type facet +
  // sort. The search doc carries full_name (not first/last) and omits the DNC
  // flag + updated date, so those degrade gracefully on search-result rows.
  const [prefs, sites, activeCookieId] = await Promise.all([
    getUserPreferences(),
    listProperties().catch(() => [] as Property[]),
    getActivePropertyId(),
  ]);
  const multiSite = sites.length > 1;
  const activePropertyId = multiSite
    ? (sites.find((s) => s.id === activeCookieId)?.id ??
      sites.find((s) => s.isPrimary)?.id ??
      sites[0]?.id)
    : undefined;
  const propertyFilter = !multiSite
    ? undefined
    : siteParam === 'all'
      ? undefined
      : (siteParam ?? activePropertyId);

  let customers: CustomerListRow[];
  let total: number;
  if (q) {
    // NOTE: customer SEARCH is not yet site-scoped (a follow-on, docs/58 §5); the
    // browse list below IS site-scoped.
    const sq = new URLSearchParams({ q, per_page: '100' });
    const { data, meta } = await api.getPaged<CustomerSearchDoc[]>(
      `/v1/search/customers?${sq.toString()}`
    );
    customers = data.map((d) => ({
      id: d.customer_id,
      type: d.type,
      firstName: d.full_name, // search indexes a combined name → drives the display name
      lastName: null,
      company: d.company ?? null,
      email: d.email ?? null,
      doNotContact: false, // not indexed
      orderCount: d.order_count,
      totalSpent: d.total_spent_cents / 100,
      lastOrderAt: d.last_order_at ? new Date(d.last_order_at * 1000).toISOString() : null,
      updatedAt: new Date(d.created_at * 1000).toISOString(), // "updated" not indexed — show created
    }));
    total = (meta?.total as number | undefined) ?? customers.length;
  } else {
    const query = new URLSearchParams();
    query.set('take', '100');
    query.set('sort_by', sort);
    if (type === 'prospect' || type === 'retail' || type === 'b2b') query.set('type', type);
    if (tag) query.set('tag', tag);
    if (propertyFilter) query.set('property', propertyFilter);
    const { data, meta } = await api.getPaged<CustomerListRow[]>(
      `/v1/crm/customers?${query.toString()}`
    );
    customers = data;
    total = (meta?.total as number | undefined) ?? customers.length;
  }
  // `?view=` overrides; absent → the user's saved default.
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';
  // The Site filter only appears for multi-site tenants; it defaults to the active
  // site (mirroring the global switcher) with an "All sites" escape.
  const siteFilter = multiSite
    ? [
        {
          key: 'site',
          label: 'Site',
          defaultValue: activePropertyId,
          options: [
            { value: 'all', label: 'All sites' },
            ...sites.map((s) => ({ value: s.id, label: s.name })),
          ],
        },
      ]
    : [];

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          className="mb-0"
          icon={<Users className="h-5 w-5" />}
          title="Customers"
          badge={
            <Badge color="module">
              {total} customer{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Customer intelligence for the whole platform — orders, segments, deals, and activity."
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/crm/duplicates">Find duplicates</Link>
              </Button>
              <EntityCreateButton
                entityType="customer"
                newHref="/crm/customers/new"
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            </>
          }
        />

        <ListToolbar
          searchPlaceholder="Search name, email, company…"
          filters={[{ key: 'type', label: 'Types', options: TYPE_OPTIONS }, ...siteFilter]}
          sortKey="sort"
          sortOptions={SORT_OPTIONS}
          enableViewToggle
        />

        {customers.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<UserPlus className="h-5 w-5" />}
              title="No customers match"
              description="Adjust the filters above, or add a new customer manually."
              action={
                <EntityCreateButton
                  entityType="customer"
                  newHref="/crm/customers/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </Card>
        ) : view === 'card' ? (
          <Grid minItemWidth="18rem" gap={4}>
            {customers.map((c) => (
              <Card key={c.id} variant="module" padding="md">
                <Stack gap={3}>
                  <Stack direction="row" align="start" justify="between" gap={2}>
                    <Stack gap={1} className="min-w-0">
                      <EntityRowLink
                        href={`/crm/customers/${c.id}`}
                        entityType="customer"
                        entityId={c.id}
                        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {customerDisplayName(c)}
                      </EntityRowLink>
                      {c.company ? (
                        <Stack direction="row" align="center" gap={1} className="min-w-0">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                          <Text size="xs" variant="muted" className="truncate">
                            {c.company}
                          </Text>
                        </Stack>
                      ) : (
                        c.email && (
                          <Text size="xs" variant="muted" className="truncate">
                            {c.email}
                          </Text>
                        )
                      )}
                    </Stack>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[c.type as keyof typeof TYPE_LABELS] ?? c.type}
                    </Badge>
                  </Stack>
                  <Stack direction="row" align="center" justify="between" gap={2}>
                    <Text size="sm" variant="muted">
                      {c.orderCount} order{c.orderCount === 1 ? '' : 's'}
                    </Text>
                    <Text size="sm" className="tabular-nums">
                      ${Number(c.totalSpent).toLocaleString()}
                    </Text>
                  </Stack>
                  {c.doNotContact && (
                    <Badge color="warning" className="self-start text-xs">
                      DNC
                    </Badge>
                  )}
                </Stack>
              </Card>
            ))}
          </Grid>
        ) : (
          <Card padding="none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead>Last order</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <EntityRowLink
                          href={`/crm/customers/${c.id}`}
                          entityType="customer"
                          entityId={c.id}
                          className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--module-active)] hover:underline"
                        >
                          {customerDisplayName(c)}
                        </EntityRowLink>
                        {c.doNotContact && (
                          <Badge color="warning" className="ml-2">
                            DNC
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TYPE_LABELS[c.type as keyof typeof TYPE_LABELS] ?? c.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.company ? (
                          <Stack direction="row" align="center" gap={1}>
                            <Building2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                            <Text size="sm">{c.company}</Text>
                          </Stack>
                        ) : (
                          <Text size="sm" variant="muted">
                            —
                          </Text>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${Number(c.totalSpent).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function customerDisplayName(c: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}): string {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (c.company) return c.company;
  if (c.email) return c.email;
  return 'Unnamed customer';
}
