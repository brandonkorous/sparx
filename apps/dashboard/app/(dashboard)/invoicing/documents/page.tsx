import { FileText, Plus } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { DocumentsList } from '../_components/documents-list';

interface DocumentRow {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  total: string | number;
  balance: string | number;
  stageId: string;
  workflowId: string;
  updatedAt: string;
}

interface StageLite {
  id: string;
  customerLabel: string;
}
interface WorkflowLite {
  id: string;
  name: string;
  slug: string;
  stages: StageLite[];
}

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Void' },
];

export default async function InvoicingDocumentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status);
  const workflowId = stringParam(params.workflowId);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);
  if (workflowId) query.set('workflowId', workflowId);

  // The list returns { items, total }; workflows give us the stage label per row
  // (the document's customer-facing noun — Estimate / Invoice / Work Order).
  const [{ data: items, meta }, workflows, prefs] = await Promise.all([
    api.getPaged<DocumentRow[]>(`/v1/invoicing/documents?${query.toString()}`),
    api.get<WorkflowLite[]>('/v1/invoicing/workflows'),
    getUserPreferences(),
  ]);
  const total = (meta?.total as number | undefined) ?? items.length;

  const stageLabels: Record<string, string> = {};
  for (const w of workflows) for (const s of w.stages) stageLabels[s.id] = s.customerLabel;

  const workflowOptions = workflows.map((w) => ({ value: w.id, label: w.name }));

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<FileText className="h-5 w-5" />}
          title="Documents"
          badge={
            <Badge color="module">
              {total} document{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Estimates, work orders, invoices and tickets — one engine, your labels. Open a document to compose lines, advance its stage, take payment, and print."
          actions={
            <EntityCreateButton
              entityType="billing-document"
              newHref="/invoicing/documents/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar
          searchable={false}
          filters={[
            { key: 'status', label: 'Statuses', options: STATUS_OPTIONS },
            { key: 'workflowId', label: 'Workflows', options: workflowOptions },
          ]}
          enableViewToggle
        />

        {items.length === 0 ? (
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No documents match"
                description="Create an estimate, invoice or work order to get started."
              />
            </CardBody>
          </Card>
        ) : (
          <DocumentsList items={items} view={view} stageLabels={stageLabels} />
        )}

        <ListPager total={total} />
      </div>
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
