import { notFound } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { Badge, Card, Container, PageHeader, Stack, Text } from '@sparx/ui';
import Link from 'next/link';

import { api } from '@/lib/api-rest-client';
import { InvoiceActions } from './_components/invoice-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  amountCents: number;
  overdueDays: number;
  dueAt: string;
  paidAt: string | null;
  paidMethod: string | null;
  notes: string | null;
  createdAt: string;
  orderId: string | null;
  account: { id: string; companyName: string; paymentTerms: string | null } | null;
  paidBy: { id: string; name: string | null; email: string } | null;
}

const STATUS_VARIANT: Record<string, 'outline' | 'warning' | 'success' | 'danger'> = {
  unpaid: 'outline',
  partial: 'warning',
  overdue: 'danger',
  paid: 'success',
  void: 'outline',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function B2bInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const invoice = await api.get<InvoiceDetail>(`/v1/b2b/invoices/${id}`);
  if (!invoice) notFound();

  const isActionable =
    invoice.status === 'unpaid' || invoice.status === 'overdue' || invoice.status === 'partial';

  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Receipt className="h-5 w-5" />}
          title={invoice.invoiceNumber}
          badge={
            <Badge color={STATUS_VARIANT[invoice.status] ?? 'neutral'} variant="soft" size="sm">
              {invoice.status.replace('_', ' ')}
            </Badge>
          }
          description={
            invoice.account ? (
              <Link href={`/b2b/accounts/${invoice.account.id}`} className="hover:underline">
                {invoice.account.companyName}
              </Link>
            ) : undefined
          }
          actions={isActionable ? <InvoiceActions invoiceId={id} /> : undefined}
        />

        <Card>
          <Stack gap={4}>
            <Text size="sm" variant="muted" className="font-semibold tracking-wide uppercase">
              Invoice details
            </Text>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <Text size="xs" variant="muted">
                  Amount
                </Text>
                <Text size="lg" className="font-semibold tabular-nums">
                  {formatCents(invoice.amountCents)}
                </Text>
              </div>
              <div>
                <Text size="xs" variant="muted">
                  Due date
                </Text>
                <Text
                  size="sm"
                  className={
                    invoice.status === 'overdue' ? 'font-medium text-[var(--color-danger)]' : ''
                  }
                >
                  {new Date(invoice.dueAt).toLocaleDateString()}
                  {invoice.overdueDays > 0 && ` (${invoice.overdueDays}d overdue)`}
                </Text>
              </div>
              {invoice.account?.paymentTerms && (
                <div>
                  <Text size="xs" variant="muted">
                    Payment terms
                  </Text>
                  <Text size="sm">{invoice.account.paymentTerms.toUpperCase()}</Text>
                </div>
              )}
              {invoice.orderId && (
                <div>
                  <Text size="xs" variant="muted">
                    Order
                  </Text>
                  <Link
                    href={`/commerce/orders/${invoice.orderId}`}
                    className="text-sm hover:text-[var(--module-active)] hover:underline"
                  >
                    View order →
                  </Link>
                </div>
              )}
              {invoice.paidAt && (
                <>
                  <div>
                    <Text size="xs" variant="muted">
                      Paid on
                    </Text>
                    <Text size="sm">{new Date(invoice.paidAt).toLocaleDateString()}</Text>
                  </div>
                  <div>
                    <Text size="xs" variant="muted">
                      Payment method
                    </Text>
                    <Text size="sm">{invoice.paidMethod ?? '—'}</Text>
                  </div>
                  {invoice.paidBy && (
                    <div>
                      <Text size="xs" variant="muted">
                        Recorded by
                      </Text>
                      <Text size="sm">{invoice.paidBy.name ?? invoice.paidBy.email}</Text>
                    </div>
                  )}
                </>
              )}
              <div>
                <Text size="xs" variant="muted">
                  Created
                </Text>
                <Text size="sm" variant="muted">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </Text>
              </div>
            </div>
            {invoice.notes && (
              <div>
                <Text size="xs" variant="muted">
                  Notes
                </Text>
                <Text size="sm">{invoice.notes}</Text>
              </div>
            )}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
