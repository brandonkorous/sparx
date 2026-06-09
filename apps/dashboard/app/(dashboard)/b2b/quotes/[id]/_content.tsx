import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FileText, ExternalLink } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Heading,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { QuoteRespondEditor } from './_components/quote-respond-editor';
import { QuoteLifecycleButtons } from './_components/quote-lifecycle-buttons';

export const dynamic = 'force-dynamic';

interface QuoteItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
}

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

const STATUS_VARIANT: Record<string, 'outline' | 'warning' | 'success' | 'danger' | 'module'> = {
  draft: 'outline',
  submitted: 'warning',
  under_review: 'warning',
  quoted: 'module',
  accepted: 'success',
  declined: 'danger',
  expired: 'outline',
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
  const canAccept = ['quoted', 'submitted'].includes(quote.status);
  const canDecline = ['quoted', 'submitted', 'under_review'].includes(quote.status);

  return (
    <Stack gap={6}>
      {/* Header */}
      <Stack direction="row" align="center" justify="between" wrap gap={3}>
        <Stack direction="row" align="center" gap={3} wrap>
          <FileText className="h-5 w-5" />
          <Heading level={1}>Quote {quote.quoteNumber}</Heading>
          <Badge color={STATUS_VARIANT[quote.status] ?? 'outline'}>
            {quote.status.replace('_', ' ')}
          </Badge>
        </Stack>
        <Stack direction="row" align="center" gap={2}>
          <a
            href={`/api/b2b/quotes/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm hover:text-[var(--module-active)] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View PDF
          </a>
          <QuoteLifecycleButtons quoteId={id} canAccept={canAccept} canDecline={canDecline} />
        </Stack>
      </Stack>

      {/* Account + customer info */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quote.b2bAccount && (
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/b2b/accounts/${quote.b2bAccount.id}`}
                className="font-medium hover:text-[var(--module-active)] hover:underline"
              >
                {quote.b2bAccount.companyName}
              </Link>
            </CardContent>
          </Card>
        )}
        {quote.customer && (
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={1}>
                <Text size="sm">
                  {quote.customer.firstName} {quote.customer.lastName}
                </Text>
                <Text size="sm" variant="muted">
                  {quote.customer.email}
                </Text>
              </Stack>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap={1}>
              <Stack direction="row" justify="between">
                <Text size="sm" variant="muted">
                  Created
                </Text>
                <Text size="sm">{new Date(quote.createdAt).toLocaleDateString()}</Text>
              </Stack>
              {quote.validUntil && (
                <Stack direction="row" justify="between">
                  <Text size="sm" variant="muted">
                    Expires
                  </Text>
                  <Text size="sm">{new Date(quote.validUntil).toLocaleDateString()}</Text>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          {canRespond && (
            <CardDescription>
              Set the quoted price for each line below, then send the quote to the customer.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {canRespond ? (
            <QuoteRespondEditor quoteId={id} items={quote.items} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Text size="sm">{item.name}</Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {item.sku}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{item.quantity}</Text>
                    </TableCell>
                    <TableCell className="text-right">
                      <Text size="sm">{fmt(item.unitPrice)}</Text>
                    </TableCell>
                    <TableCell className="text-right">
                      <Text size="sm">{fmt(item.lineTotal)}</Text>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="py-4">
          <Stack gap={2} className="ml-auto max-w-xs">
            <Stack direction="row" justify="between">
              <Text size="sm" variant="muted">
                Subtotal
              </Text>
              <Text size="sm">{fmt(quote.subtotal)}</Text>
            </Stack>
            <Stack direction="row" justify="between">
              <Text size="sm" variant="muted">
                Tax
              </Text>
              <Text size="sm">{fmt(quote.taxTotal)}</Text>
            </Stack>
            <Stack direction="row" justify="between">
              <Text size="sm" variant="muted">
                Shipping
              </Text>
              <Text size="sm">{fmt(quote.shippingTotal)}</Text>
            </Stack>
            <Stack
              direction="row"
              justify="between"
              className="border-t border-[var(--color-border-default)] pt-2"
            >
              <Text className="font-semibold">Total</Text>
              <Text className="font-semibold">{fmt(quote.total)}</Text>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Notes */}
      {(quote.customerNote || quote.internalNote) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {quote.customerNote && (
            <Card>
              <CardHeader>
                <CardTitle>Customer note</CardTitle>
              </CardHeader>
              <CardContent>
                <Text size="sm" className="whitespace-pre-wrap">
                  {quote.customerNote}
                </Text>
              </CardContent>
            </Card>
          )}
          {quote.internalNote && (
            <Card>
              <CardHeader>
                <CardTitle>Internal note</CardTitle>
              </CardHeader>
              <CardContent>
                <Text size="sm" className="whitespace-pre-wrap">
                  {quote.internalNote}
                </Text>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </Stack>
  );
}
