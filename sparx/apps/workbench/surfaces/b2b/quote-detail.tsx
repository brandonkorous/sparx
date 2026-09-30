'use client';

// One quote — who asked, what it comes to, and where it stands.
//
// This is a READ view: a quote is a billing document, and the pricing + the
// accept/decline moves all live in the invoicing editor that actually owns its
// lines and its workflow. So this pane shows the request and its standing, then
// hands off — the primary action opens the quote in that editor to price it and
// respond. Nothing here is a draft, so there is no Save and no dirty state.

import { useEffect } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Heading,
  Table,
  Text,
} from '@wizeworks/silicaui-react';
import { Building2, ExternalLink } from 'lucide-react';
import { ModuleScope } from '../../components/module-scope';
import { FormSection } from '../../components/form-section';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import {
  formatDate,
  formatMoney,
  isExpired,
  quoteParty,
  quoteTone,
  useQuote,
  type QuoteRow,
} from './quotes-data';
import { PaneLoadError } from '../../components/pane-load-error';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function QuoteDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const quoteQuery = useQuote(id);

  useEffect(() => {
    if (quoteQuery.data) {
      ctx.setTitle(quoteQuery.data.number ? `Quote ${quoteQuery.data.number}` : 'Quote');
    }
  }, [ctx, quoteQuery.data]);

  if (quoteQuery.isError) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={quoteQuery.error}
          noun="quote"
          title="Could not load this quote"
          description="This is a problem reaching the server. The quote itself is unaffected. Nothing has been lost."
          onRetry={() => {
            void quoteQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (quoteQuery.isPending || !quoteQuery.data) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-sm" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return <QuoteView ctx={ctx} quote={quoteQuery.data} />;
}

function MoneyRow({
  label,
  amount,
  currency,
  emphasis = false,
}: {
  label: string;
  amount: number;
  currency: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Text as="span" className={emphasis ? 'font-semibold' : 'text-sm'}>
        {label}
      </Text>
      <Text as="span" className={`tabular-nums ${emphasis ? 'text-lg font-semibold' : ''}`}>
        {formatMoney(amount, currency)}
      </Text>
    </div>
  );
}

function QuoteView({ ctx, quote }: { ctx: SurfaceContext; quote: QuoteRow }) {
  const expired = isExpired(quote) && quote.stage.stageType === 'draft';
  const tone = expired ? 'warning' : quoteTone(quote.stage.stageType);
  const stageLabel = expired ? 'Expired' : quote.stage.name;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Quote actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            title="Open this quote to price its lines and accept or decline it"
            onClick={(event) => {
              ctx.open('invoicing.invoice.edit', { id: quote.id }, { target: targetFor(event) });
            }}
          >
            <ExternalLink className="size-4" aria-hidden />
            Price &amp; respond
          </Button>
        }
        controls={
          <>
            <Badge color={tone} variant="soft" size="sm">
              {stageLabel}
            </Badge>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Heading level={1} className="text-2xl font-semibold">
              {quote.number ? `Quote ${quote.number}` : 'Draft quote'}
            </Heading>
            <Text>
              {/* Null when there is neither a business nor a person on it.
                  It used to read "For Unknown business", which claims a
                  business exists and that we have mislaid which one. */}
              {quoteParty(quote) ? `For ${quoteParty(quote)}` : 'Nobody is on this quote yet'}
            </Text>
          </div>

          {expired ? (
            <Alert color="warning">
              <AlertContent>
                <AlertTitle>This quote has expired</AlertTitle>
                <AlertDescription>
                  It was valid until {formatDate(quote.validUntil)}. Open it to extend the date or
                  re-quote.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {/* A quote IS its list of lines. The pane used to show a total with
              nothing under it, so the one screen for checking what a business
              asked for could not answer that question, and the operator had to
              open the pricing editor to read their own quote back. */}
          <FormSection title="What is on it">
            {quote.lines.length === 0 ? (
              <Text className="text-sm">
                Nothing has been put on this quote yet. Price and respond to add the first line.
              </Text>
            ) : (
              <Table size="sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="hidden text-right @lg:table-cell">Each</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.description}</td>
                      <td className="text-right tabular-nums">{line.quantity}</td>
                      <td className="hidden text-right tabular-nums @lg:table-cell">
                        {formatMoney(line.unitPrice, quote.currency)}
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatMoney(line.lineTotal, quote.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </FormSection>

          <FormSection title="What it comes to">
            <div className="flex flex-col gap-2">
              <MoneyRow label="Goods" amount={quote.subtotal} currency={quote.currency} />
              <MoneyRow label="Tax" amount={quote.taxTotal} currency={quote.currency} />
              <div className="border-base-300 border-t pt-2">
                <MoneyRow label="Total" amount={quote.total} currency={quote.currency} emphasis />
              </div>
            </div>
          </FormSection>

          <FormSection title="The details">
            <dl className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-sm">Valid until</dt>
                <dd className="text-sm">{formatDate(quote.validUntil)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-sm">Asked</dt>
                <dd className="text-sm">{formatDate(quote.createdAt)}</dd>
              </div>
            </dl>
            {quote.customerNote ? (
              <div className="border-base-300 flex flex-col gap-1 border-t pt-3">
                <Text as="span" className="text-sm font-medium">
                  What they asked for
                </Text>
                <Text className="text-sm">{quote.customerNote}</Text>
              </div>
            ) : null}
          </FormSection>

          {quote.account ? (
            <ModuleScope module="b2b">
              <FormSection title="The business">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Text className="font-medium">{quote.account.companyName}</Text>
                  <Button
                    size="sm"
                    variant="soft"
                    color="module"
                    onClick={(event) => {
                      if (!quote.account) return;
                      ctx.open(
                        'b2b.account.detail',
                        { id: quote.account.id },
                        { target: targetFor(event) }
                      );
                    }}
                  >
                    <Building2 className="size-4" aria-hidden />
                    Open account
                  </Button>
                </div>
              </FormSection>
            </ModuleScope>
          ) : null}
        </div>
      </div>
    </div>
  );
}
