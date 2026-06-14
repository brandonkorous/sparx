import Link from 'next/link';
import { Users, Plus, UserPlus } from 'lucide-react';

import { Badge, Button, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { resolveSiteScope, resolvePropertyFilter } from '@/lib/sites';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { CustomersSelectionTable } from './_components/customers-selection-table';
import { CustomersImportExport } from './_components/customers-import-export';
import type { CustomerListRow } from './_components/customers-selection-table';

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
  const { page, perPage, skip, take } = parsePageParams(params);
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
  const [prefs, scope] = await Promise.all([getUserPreferences(), resolveSiteScope()]);
  const { sites, multiSite, activePropertyId } = scope;
  const propertyFilter = resolvePropertyFilter(scope, siteParam);

  let customers: CustomerListRow[];
  let total: number;
  if (q) {
    // Search via Typesense, scoped to the active site (docs/58 D2) via the
    // customers `property_id` facet — same selection as the browse list below.
    const sq = new URLSearchParams({ q, page: String(page), per_page: String(perPage) });
    if (propertyFilter) sq.set('property', propertyFilter);
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
    query.set('take', String(take));
    query.set('skip', String(skip));
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
              <CustomersImportExport />
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
        ) : (
          <CustomersSelectionTable customers={customers} view={view} />
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
