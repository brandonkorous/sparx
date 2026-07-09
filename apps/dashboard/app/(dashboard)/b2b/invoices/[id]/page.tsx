import { notFound } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
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

const STATUS_VARIANT: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  unpaid: 'neutral',
  partial: 'warning',
  overdue: 'danger',
  paid: 'success',
  void: 'neutral',
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
    <div className="mx-auto w-full max-w-screen-md px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
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
          <CardBody>
            <div className="flex flex-col gap-4">
              <p className="text-base-content/70 text-sm font-semibold tracking-wide uppercase">
                Invoice details
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-base-content/70 text-xs">Amount</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCents(invoice.amountCents)}
                  </p>
                </div>
                <div>
                  <p className="text-base-content/70 text-xs">Due date</p>
                  <p
                    className={`text-sm ${
                      invoice.status === 'overdue' ? 'text-danger font-medium' : ''
                    }`}
                  >
                    {new Date(invoice.dueAt).toLocaleDateString()}
                    {invoice.overdueDays > 0 && ` (${invoice.overdueDays}d overdue)`}
                  </p>
                </div>
                {invoice.account?.paymentTerms && (
                  <div>
                    <p className="text-base-content/70 text-xs">Payment terms</p>
                    <p className="text-sm">{invoice.account.paymentTerms.toUpperCase()}</p>
                  </div>
                )}
                {invoice.orderId && (
                  <div>
                    <p className="text-base-content/70 text-xs">Order</p>
                    <Link
                      href={`/commerce/orders/${invoice.orderId}`}
                      className="hover:text-module text-sm hover:underline"
                    >
                      View order →
                    </Link>
                  </div>
                )}
                {invoice.paidAt && (
                  <>
                    <div>
                      <p className="text-base-content/70 text-xs">Paid on</p>
                      <p className="text-sm">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-base-content/70 text-xs">Payment method</p>
                      <p className="text-sm">{invoice.paidMethod ?? '—'}</p>
                    </div>
                    {invoice.paidBy && (
                      <div>
                        <p className="text-base-content/70 text-xs">Recorded by</p>
                        <p className="text-sm">{invoice.paidBy.name ?? invoice.paidBy.email}</p>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <p className="text-base-content/70 text-xs">Created</p>
                  <p className="text-base-content/70 text-sm">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {invoice.notes && (
                <div>
                  <p className="text-base-content/70 text-xs">Notes</p>
                  <p className="text-sm">{invoice.notes}</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
