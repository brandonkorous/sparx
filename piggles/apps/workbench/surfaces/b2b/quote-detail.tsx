'use client';

// One quote — who asked, what it comes to, and where it stands.
//
// This is a READ view: a quote is a billing document, and the pricing + the
// accept/decline moves all live in the invoicing editor that actually owns its
// lines and its workflow. So this pane shows the request and its standing, then
// hands off — the primary action opens the quote in that editor to price it and
// respond. Nothing here is a draft, so there is no Save and no dirty state.

import { useEffect } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Text,
} from '@wizeworks/silicaui-react';
import { faArrowUpRightFromSquare, faBuilding } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ModuleScope } from '../../components/module-scope';
import { FormSection } from '../../components/form-section';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import {
  formatDate,
  formatMoney,
  isExpired,
  quoteParty,
  quoteTone,
  useQuote,
  type QuoteRow,
} from './quotes-data';

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
        <div className={`${PANE_SHELL} p-2`}>
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneLoadError
              title="Could not load this quote"
              description="This is a problem reaching the server. The quote itself is unaffected — nothing has been lost."
              onRetry={() => {
                void quoteQuery.refetch();
              }}
            />
          </Card>
        </div>
      </div>
    );
  }

  if (quoteQuery.isPending || !quoteQuery.data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <QuoteView
      ctx={ctx}
      quote={quoteQuery.data}
      isFetching={quoteQuery.isFetching}
      updatedAt={quoteQuery.dataUpdatedAt}
      onRefresh={() => {
        void quoteQuery.refetch();
      }}
    />
  );
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

function QuoteView({
  ctx,
  quote,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  ctx: SurfaceContext;
  quote: QuoteRow;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  const expired = isExpired(quote) && quote.stage.stageType === 'draft';
  const tone = expired ? 'warning' : quoteTone(quote.stage.stageType);
  const stageLabel = expired ? 'Expired' : quote.stage.name;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Quote actions"
        status={
          <Badge color={tone} variant="soft" size="sm">
            {stageLabel}
          </Badge>
        }
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
            <Icon glyph={faArrowUpRightFromSquare} className="size-4" aria-hidden />
            Price &amp; respond
          </Button>
        }
        refresh={
          <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Text>For {quoteParty(quote)}</Text>

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
                    <Icon glyph={faBuilding} className="size-4" aria-hidden />
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
