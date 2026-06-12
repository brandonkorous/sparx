import { FileText, Plus } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  Container,
  EmptyState,
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

import { EntityCreateButton } from '../_components/entity-create-button';
import { EntityRowLink } from '../_components/entity-row-link';
import { ListToolbar } from '../_components/list-toolbar';
import { AR_STATUS_VARIANT, formatMoney } from './_components/format';

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
  const status = stringParam(params.status);
  const workflowId = stringParam(params.workflowId);

  const query = new URLSearchParams({ limit: '100' });
  if (status) query.set('status', status);
  if (workflowId) query.set('workflowId', workflowId);

  // The list returns { items, total }; workflows give us the stage label per row
  // (the document's customer-facing noun — Estimate / Invoice / Work Order).
  const [{ items, total }, workflows] = await Promise.all([
    api.get<{ items: DocumentRow[]; total: number }>(`/v1/invoicing/documents?${query.toString()}`),
    api.get<WorkflowLite[]>('/v1/invoicing/workflows'),
  ]);

  const stageLabel = new Map<string, string>();
  for (const w of workflows) for (const s of w.stages) stageLabel.set(s.id, s.customerLabel);

  const workflowOptions = workflows.map((w) => ({ value: w.id, label: w.name }));

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
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
        />

        {items.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No documents match"
              description="Create an estimate, invoice or work order to get started."
            />
          </Card>
        ) : (
          <Card padding="none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <EntityRowLink
                          href={`/invoicing/documents/${d.id}`}
                          entityType="billing-document"
                          entityId={d.id}
                          className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                        >
                          {d.number ?? 'Draft'}
                        </EntityRowLink>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {stageLabel.get(d.stageId) ?? '—'}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Badge color={AR_STATUS_VARIANT[d.status] ?? 'neutral'} className="text-xs">
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(d.total, d.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(d.balance, d.currency)}
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {new Date(d.updatedAt).toLocaleDateString()}
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
