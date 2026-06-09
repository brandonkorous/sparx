import { FileText } from 'lucide-react';

import {
  Badge,
  Card,
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
import Link from 'next/link';

import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface QuoteRow {
  id: string;
  quoteNumber: string;
  status: string;
  validUntil: string | null;
  total: string | number;
  createdAt: string;
  b2bAccount: { id: string; companyName: string } | null;
  _count: { items: number };
}

const STATUS_VARIANT: Record<string, 'outline' | 'warning' | 'success' | 'danger' | 'module'> = {
  draft: 'outline',
  submitted: 'warning',
  under_review: 'warning',
  quoted: 'module',
  accepted: 'success',
  declined: 'danger',
  expired: 'outline',
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function B2bQuotesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = stringParam(params.status);
  const accountId = stringParam(params.account_id);

  const query = new URLSearchParams({ take: '100' });
  if (status) query.set('status', status);
  if (accountId) query.set('account_id', accountId);

  const { data: quotes, meta } = await api.getPaged<QuoteRow[]>(
    `/v1/b2b/quotes?${query.toString()}`
  );
  const total = (meta?.total as number | undefined) ?? quotes.length;

  const pendingResponse = quotes.filter((q) => ['submitted', 'under_review'].includes(q.status));

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<FileText className="h-5 w-5" />}
          title="Quotes / RFQ"
          badge={
            <Badge color="module">
              {total} quote{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Manage B2B price requests. Submitted quotes need a merchant response before the customer can accept."
          actions={
            pendingResponse.length > 0 ? (
              <Badge color="warning" variant="soft">
                {pendingResponse.length} pending response
              </Badge>
            ) : undefined
          }
        />

        <ListToolbar
          searchPlaceholder="Search by quote # or account…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
        />

        {quotes.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No quotes yet"
              description="B2B accounts can request quotes. They'll appear here for you to price and respond."
            />
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id} className="hover:bg-[var(--color-surface-subtle)]">
                  <TableCell>
                    <Link
                      href={`/b2b/quotes/${quote.id}`}
                      className="font-medium hover:text-[var(--module-active)] hover:underline"
                    >
                      {quote.quoteNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {quote.b2bAccount ? (
                      <Link
                        href={`/b2b/accounts/${quote.b2bAccount.id}`}
                        className="text-sm hover:text-[var(--module-active)] hover:underline"
                      >
                        {quote.b2bAccount.companyName}
                      </Link>
                    ) : (
                      <Text size="sm" variant="muted">
                        —
                      </Text>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge color={STATUS_VARIANT[quote.status] ?? 'outline'} variant="soft">
                      {quote.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Text size="sm">{quote._count.items}</Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm">
                      ${Number(quote.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—'}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {new Date(quote.createdAt).toLocaleDateString()}
                    </Text>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </Container>
  );
}
