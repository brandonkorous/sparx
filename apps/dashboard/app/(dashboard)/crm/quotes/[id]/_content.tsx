import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Package } from 'lucide-react';

import { Badge, Card, CardBody, CardTitle, Table } from '@wizeworks/silicaui-react';
import { Stat, statusLabel, statusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { QuoteLifecycleActions } from './_components/quote-lifecycle-actions';

interface LineMarkupSnapshot {
  ruleName: string | null;
  method: string;
  marginPct: number;
  markupPct: number;
  costBasisValueCents: number;
}

interface QuoteItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
  costCents: number | null;
  appliedMarkup: LineMarkupSnapshot | null;
}

interface QuoteWithItems {
  id: string;
  quoteNumber: string;
  status: string;
  customerId: string | null;
  convertedToOrderId: string | null;
  currency: string;
  total: string | number;
  subtotal: string | number;
  taxTotal: string | number;
  validUntil: string | null;
  customerNote: string | null;
  internalNote: string | null;
  items: QuoteItem[];
}

interface CustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export async function QuoteDetailContent({ id }: Props) {
  let quote: QuoteWithItems;
  try {
    quote = await api.get<QuoteWithItems>(`/v1/crm/quotes/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const customer = quote.customerId
    ? await api.get<CustomerSummary>(`/v1/crm/customers/${quote.customerId}`).catch(() => null)
    : null;

  return (
    // @container so the body responds to its OWN width — full-page (wide) vs. the
    // detail drawer (narrow), where viewport breakpoints would crush the columns.
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{quote.quoteNumber}</h1>
            <Badge color={statusTone(quote.status)} variant="soft">
              {statusLabel(quote.status)}
            </Badge>
            {customer && (
              <Link
                href={`/crm/customers/${customer.id}`}
                className="hover:text-module text-sm hover:underline"
              >
                {[customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
                  (customer.company ?? customer.email)}
              </Link>
            )}
            {quote.convertedToOrderId && (
              <Link
                href={`/crm/orders/${quote.convertedToOrderId}`}
                className="hover:text-module text-sm hover:underline"
              >
                → Converted order
              </Link>
            )}
          </div>
          <QuoteLifecycleActions quoteId={quote.id} status={quote.status} />
        </div>
      </div>

      <div className="grid gap-4 @[440px]:grid-cols-2 @[820px]:grid-cols-4">
        <Card className="bg-module bg-soft">
          <CardBody className="py-4">
            <Stat
              label="Total"
              value={`${quote.currency} ${Number(quote.total).toLocaleString()}`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat
              label="Subtotal"
              value={`${quote.currency} ${Number(quote.subtotal).toLocaleString()}`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat
              label="Tax"
              value={`${quote.currency} ${Number(quote.taxTotal).toLocaleString()}`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat
              label="Valid until"
              value={quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—'}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <CardTitle>
            <div className="flex flex-row items-center gap-2">
              <Package className="h-4 w-4" /> Line items
              <Badge color="neutral" variant="soft" size="sm">
                {quote.items.length}
              </Badge>
            </div>
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit price</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Tax</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code className="text-xs">{item.sku}</code>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm">{item.name}</p>
                      {item.appliedMarkup && (
                        <div className="flex flex-row flex-wrap items-center gap-2">
                          <Badge color="module" variant="soft">
                            By markup
                          </Badge>
                          <p className="text-base-content/70 text-xs">
                            {item.appliedMarkup.ruleName ?? 'Ad-hoc'} ·{' '}
                            {item.appliedMarkup.marginPct}% margin · cost {quote.currency}{' '}
                            {(item.appliedMarkup.costBasisValueCents / 100).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{item.quantity}</td>
                  <td className="text-right tabular-nums">
                    {quote.currency} {Number(item.unitPrice).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums">
                    {quote.currency} {Number(item.discountAmount).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums">
                    {quote.currency} {Number(item.taxAmount).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums">
                    {quote.currency} {Number(item.lineTotal).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      {(quote.customerNote ?? quote.internalNote) && (
        <div className="grid gap-4 @[680px]:grid-cols-2">
          {quote.customerNote && (
            <Card>
              <CardBody>
                <CardTitle>Customer note</CardTitle>
                <p className="text-sm">{quote.customerNote}</p>
              </CardBody>
            </Card>
          )}
          {quote.internalNote && (
            <Card>
              <CardBody>
                <CardTitle>Internal note</CardTitle>
                <p className="text-sm">{quote.internalNote}</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
