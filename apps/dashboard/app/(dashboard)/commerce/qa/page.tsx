import { HelpCircle } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Container,
  EmptyState,
  Heading,
  PageHeader,
  Stack,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { QaList, type DisplayRow } from './_components/qa-list';

export const dynamic = 'force-dynamic';

// Empty filter value = the pending moderation queue (the default landing).
const STATUS_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

interface QuestionCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

interface QuestionListRow {
  id: string;
  productId: string;
  body: string;
  status: string;
  createdAt: string;
  productTitle: string | null;
  productHandle: string | null;
  customer: QuestionCustomer | null;
  // Only present in the pending endpoint:
  displayName?: string | null;
  customerId?: string | null;
  answers?: unknown[];
}

function authorLabel(row: QuestionListRow): string {
  if (row.displayName) return row.displayName;
  if (row.customer) {
    const full = `${row.customer.firstName ?? ''} ${row.customer.lastName ?? ''}`.trim();
    if (full) return full;
    if (row.customer.email) return row.customer.email;
    return 'Customer';
  }
  if (row.customerId) return 'Customer';
  return 'Anon';
}

export default async function QaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const { status: statusParam, view: viewParam } = await searchParams;

  const prefs = await getUserPreferences();
  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  let rows: DisplayRow[] = [];
  if (statusParam === undefined) {
    const list = await api.get<QuestionListRow[]>('/v1/commerce/questions/pending');
    rows = list.map((q) => ({
      id: q.id,
      productId: q.productId,
      body: q.body,
      status: q.status,
      createdAt: q.createdAt,
      authorLabel: authorLabel(q),
      productTitle: q.productTitle ?? null,
      answerCount: Array.isArray(q.answers) ? q.answers.length : null,
    }));
  } else {
    const qs = statusParam === 'all' ? '?take=250' : `?status=${statusParam}&take=250`;
    const list = await api.get<QuestionListRow[]>(`/v1/commerce/questions${qs}`);
    rows = list.map((q) => ({
      id: q.id,
      productId: q.productId,
      body: q.body,
      status: q.status,
      createdAt: q.createdAt,
      authorLabel: authorLabel(q),
      productTitle: q.productTitle ?? null,
      answerCount: null,
    }));
  }

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<HelpCircle className="h-5 w-5" />}
          title="Questions & answers"
          badge={<Badge color="module">{rows.length} shown</Badge>}
          description="Customer questions are moderated before they reach the storefront. Answering with the staff badge marks the response as official; community answers can land too once the question is published."
        />

        <ListToolbar
          searchable={false}
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {rows.length === 0 ? (
          <Card>
            <CardHeader>
              <Stack gap={1}>
                <Heading level={3}>{labelFor(statusParam)}</Heading>
                <CardDescription>
                  Click a question to publish or reject, and post an official answer.
                </CardDescription>
              </Stack>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<HelpCircle className="h-5 w-5" />}
                title="No questions"
                description="Questions arrive here once the storefront PDP starts accepting them."
              />
            </CardContent>
          </Card>
        ) : (
          <Stack gap={1}>
            <Heading level={3}>{labelFor(statusParam)}</Heading>
            <CardDescription>
              Click a question to publish or reject, and post an official answer.
            </CardDescription>
            <QaList rows={rows} view={view} />
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function labelFor(s: string | undefined): string {
  if (s === undefined) return 'Pending';
  if (s === 'all') return 'All questions';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
