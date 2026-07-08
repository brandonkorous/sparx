import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FileText, ExternalLink } from 'lucide-react';

import { Badge, Card, CardBody, CardTitle, Table } from 'silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { QuoteRespondEditor, type MarkupRuleSummary } from './_components/quote-respond-editor';
import { QuoteLifecycleButtons } from './_components/quote-lifecycle-buttons';

export const dynamic = 'force-dynamic';

interface LineMarkupSnapshot {
  ruleName: string | null;
  method: string;
  marginPct: number;
  markupPct: number;
  costBasisValueCents: number;
}

interface QuoteItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
  variantId: string | null;
  costCents: number | null;
  appliedMarkup: LineMarkupSnapshot | null;
}

// The list endpoint returns every active rule; we keep the document-applicable
// ones for the respond editor's markup picker. `appliesTo` rides along the same
// shape the pure engine needs.
type MarkupRuleApi = MarkupRuleSummary & { appliesTo: string };

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  status: string;
  validUntil: string | null;
  customerNote: string | null;
  internalNote: string | null;
  subtotal: string | number;
  taxTotal: string | number;
  shippingTotal: string | number;
  total: string | number;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
  b2bAccount: { id: string; companyName: string } | null;
  customer: { id: string; firstName: string; lastName: string; email: string } | null;
}

const STATUS_VARIANT: Record<string, 'neutral' | 'warning' | 'success' | 'danger' | 'module'> = {
  draft: 'neutral',
  submitted: 'warning',
  under_review: 'warning',
  quoted: 'module',
  accepted: 'success',
  declined: 'danger',
  expired: 'neutral',
};

interface Props {
  id: string;
}

export async function B2bQuoteDetailContent({ id }: Props) {
  let quote: QuoteDetail;
  try {
    quote = await api.get<QuoteDetail>(`/v1/b2b/quotes/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const fmt = (n: string | number) =>
    `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const canRespond = ['submitted', 'under_review'].includes(quote.status);

  // Document-applicable markup rules for the respond editor's picker. Commerce
  // may be disabled (404) on a B2B-only tenant — degrade to ad-hoc markup only.
  const markupRules: MarkupRuleSummary[] = canRespond
    ? await api
        .get<MarkupRuleApi[]>('/v1/markup-rules?is_active=true')
        .then((rules) => rules.filter((r) => r.appliesTo === 'document' || r.appliesTo === 'both'))
        .catch(() => [])
    : [];

  const canAccept = ['quoted', 'submitted'].includes(quote.status);
  const canDecline = ['quoted', 'submitted', 'under_review'].includes(quote.status);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-row flex-wrap items-center gap-3">
          <FileText className="h-5 w-5" />
          <h1 className="text-3xl font-semibold">Quote {quote.quoteNumber}</h1>
          <Badge color={STATUS_VARIANT[quote.status] ?? 'neutral'} variant="soft" size="sm">
            {quote.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex flex-row items-center gap-2">
          <a
            href={`/api/b2b/quotes/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm hover:text-[var(--module-active)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View PDF
          </a>
          <QuoteLifecycleButtons quoteId={id} canAccept={canAccept} canDecline={canDecline} />
        </div>
      </div>

      {/* Account + customer info */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quote.b2bAccount && (
          <Card>
            <CardBody>
              <CardTitle>Account</CardTitle>
              <Link
                href={`/b2b/accounts/${quote.b2bAccount.id}`}
                className="font-medium hover:text-[var(--module-active)] hover:underline"
              >
                {quote.b2bAccount.companyName}
              </Link>
            </CardBody>
          </Card>
        )}
        {quote.customer && (
          <Card>
            <CardBody>
              <CardTitle>Contact</CardTitle>
              <div className="flex flex-col gap-1">
                <p className="text-sm">
                  {quote.customer.firstName} {quote.customer.lastName}
                </p>
                <p className="text-base-content/70 text-sm">{quote.customer.email}</p>
              </div>
            </CardBody>
          </Card>
        )}
        <Card>
          <CardBody>
            <CardTitle>Dates</CardTitle>
            <div className="flex flex-col gap-1">
              <div className="flex flex-row justify-between">
                <p className="text-base-content/70 text-sm">Created</p>
                <p className="text-sm">{new Date(quote.createdAt).toLocaleDateString()}</p>
              </div>
              {quote.validUntil && (
                <div className="flex flex-row justify-between">
                  <p className="text-base-content/70 text-sm">Expires</p>
                  <p className="text-sm">{new Date(quote.validUntil).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardBody>
          <CardTitle>Line items</CardTitle>
          {canRespond && (
            <p className="opacity-70">
              Set the quoted price for each line below, then send the quote to the customer.
            </p>
          )}
        </CardBody>
        {canRespond ? (
          <QuoteRespondEditor quoteId={id} items={quote.items} rules={markupRules} />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Qty</th>
                <th className="text-right">Unit price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id}>
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
                            {item.appliedMarkup.marginPct}% margin · cost{' '}
                            {fmt(item.appliedMarkup.costBasisValueCents / 100)}
                          </p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <p className="text-base-content/70 text-sm">{item.sku}</p>
                  </td>
                  <td>
                    <p className="text-sm">{item.quantity}</p>
                  </td>
                  <td className="text-right">
                    <p className="text-sm">{fmt(item.unitPrice)}</p>
                  </td>
                  <td className="text-right">
                    <p className="text-sm">{fmt(item.lineTotal)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Totals */}
      <Card>
        <CardBody className="py-4">
          <div className="ml-auto flex max-w-xs flex-col gap-2">
            <div className="flex flex-row justify-between">
              <p className="text-base-content/70 text-sm">Subtotal</p>
              <p className="text-sm">{fmt(quote.subtotal)}</p>
            </div>
            <div className="flex flex-row justify-between">
              <p className="text-base-content/70 text-sm">Tax</p>
              <p className="text-sm">{fmt(quote.taxTotal)}</p>
            </div>
            <div className="flex flex-row justify-between">
              <p className="text-base-content/70 text-sm">Shipping</p>
              <p className="text-sm">{fmt(quote.shippingTotal)}</p>
            </div>
            <div className="flex flex-row justify-between border-t border-[var(--color-border-default)] pt-2">
              <p className="font-semibold">Total</p>
              <p className="font-semibold">{fmt(quote.total)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Notes */}
      {(quote.customerNote ?? quote.internalNote) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {quote.customerNote && (
            <Card>
              <CardBody>
                <CardTitle>Customer note</CardTitle>
                <p className="text-sm whitespace-pre-wrap">{quote.customerNote}</p>
              </CardBody>
            </Card>
          )}
          {quote.internalNote && (
            <Card>
              <CardBody>
                <CardTitle>Internal note</CardTitle>
                <p className="text-sm whitespace-pre-wrap">{quote.internalNote}</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
