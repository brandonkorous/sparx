import { GitBranch, Plus } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { WorkflowsList, type WorkflowRow } from './_components/workflows-list';

// Workflows index — a standard docs/34 List surface: a ListToolbar with search
// + an archived filter + Table/Cards toggle on top of the shared SelectionList,
// mirroring `/crm/pipelines` (the invoicing analogue of a sales pipeline).

export const dynamic = 'force-dynamic';

const ARCHIVED_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InvoicingWorkflowsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const archived = parseArchived(stringParam(params.archived));
  const q = stringParam(params.q);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (archived !== 'active') query.set('include_archived', 'true');
  if (q) query.set('q', q);

  const [prefs, { data: fetched, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<WorkflowRow[]>(`/v1/invoicing/workflows?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? fetched.length;

  // `archived` narrows the all-inclusive fetch to just archived rows.
  const workflows = archived === 'archived' ? fetched.filter((w) => w.archivedAt) : fetched;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<GitBranch className="h-5 w-5" />}
          title="Workflows"
          badge={
            <Badge color="module">
              {workflows.length} workflow{workflows.length === 1 ? '' : 's'}
            </Badge>
          }
          description="A workflow is a document's lifecycle — the ordered stages it moves through (Estimate → Approved → Invoiced → Paid). Each stage carries the customer-facing label and the behavior: when to mint a number, freeze a snapshot, or lock editing. One engine, your labels."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search name or slug…"
          filters={[
            { key: 'archived', label: 'Status', options: ARCHIVED_OPTIONS, defaultValue: 'active' },
          ]}
          enableViewToggle
          primaryAction={
            <EntityCreateButton
              entityType="workflow"
              newHref="/invoicing/workflows/new"
              color="module"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />
      }
      pager={<ListPager total={total} />}
    >
      {workflows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<GitBranch className="h-5 w-5" />}
            title={
              q
                ? 'No workflows match this search'
                : archived === 'archived'
                  ? 'No archived workflows'
                  : 'No workflows yet'
            }
            description={
              q
                ? 'Try a different name or slug.'
                : archived === 'archived'
                  ? 'Archived workflows stay out of the active list. Switch the filter to Active or All to see the rest.'
                  : 'Create a workflow to define the stages your documents move through.'
            }
            actions={
              archived === 'archived' || q ? undefined : (
                <EntityCreateButton
                  entityType="workflow"
                  newHref="/invoicing/workflows/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New workflow
                </EntityCreateButton>
              )
            }
          />
        </Card>
      ) : (
        <WorkflowsList workflows={workflows} view={view} />
      )}

      <p className="text-base-content text-xs">
        Stages key off a semantic <strong>type</strong> (draft, open, committed, final, paid, void)
        that drives behavior — the label stays yours, so the same engine serves estimates, work
        orders, invoices and tickets.
      </p>
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function parseArchived(v: string | undefined): 'active' | 'archived' | 'all' {
  return v === 'archived' || v === 'all' ? v : 'active';
}
