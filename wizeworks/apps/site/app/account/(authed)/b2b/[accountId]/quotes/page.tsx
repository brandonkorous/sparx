'use client';

// Wholesale account: the quotes on one trade account. A quote IS a
// BillingDocument on the system `b2b-quotes` workflow (docs/87 convergence):
// its state is the stage it is on (Draft, Submitted, Under Review, Quoted,
// Accepted, Declined, Expired), not a standalone status enum. A buyer or the
// primary contact can ask for a new quote here, and can accept or decline one
// once the shop has priced it ("Quoted").
//
// Asking for a quote is a request the buyer BUILDS (sparx persona issue 086):
// items arrive from "Add to quote request" on product pages or are added here,
// with delivery needs, a PO number and notes, and the shop sees it only when it
// is sent. The request being built is `QuoteRequestBuilder`; sent requests are
// quotes and are listed below it.
//
// Every quote says where it stands in a sentence and lists what is on it.
// Before the shop has priced a quote its line prices are placeholders ($0.00 for
// a typed line, the list price for a catalog one), so they are not shown as a
// price at all (sparx persona issue 084).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import {
  AccountError,
  acceptB2bQuote,
  declineB2bQuote,
  getB2bQuotes,
  getB2bSummary,
  getQuoteRequest,
  ORDERING_ROLES,
  type B2bQuoteEntry,
  type QuoteRequest,
} from '@/lib/customer-client';
import { neededByWords } from '@/lib/buying-again-words';
import { formatMoney } from '@/lib/format';
import {
  QUOTE_ACTIONABLE_STAGE,
  coreDepositSentence,
  pricedQuote,
  quantityWords,
  quoteStageView,
  quoteSummaryRows,
} from '@/lib/trade-account-words';
import { Alert, Badge, Button, Label, Textarea } from '@wizeworks/silicaui-react';
import { QuoteRequestBuilder } from './quote-request-builder';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function B2bQuotesPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [quotes, setQuotes] = useState<B2bQuoteEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  // The quote whose decline is being confirmed, and the reason typed for it.
  const [declining, setDeclining] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  // The shop's currency, for list prices in the product picker.
  const [currency, setCurrency] = useState<string | null>(null);
  // Accepted, but its order could not be made: the reason, for that quote.
  const [orderProblem, setOrderProblem] = useState<{ id: string; message: string } | null>(null);
  // The order each quote accepted here became, from the accept call itself, so
  // its sentence and link do not wait on the list to reload (sparx persona
  // issue 087). The list's own `order` wins once it has one.
  const [acceptedOrders, setAcceptedOrders] = useState<
    Record<string, NonNullable<B2bQuoteEntry['order']>>
  >({});

  // The account's quote request being built (sparx persona issue 086): the one
  // on the server, whether a new one is being started here, and who it goes to.
  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [requestLoaded, setRequestLoaded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [requestShop, setRequestShop] = useState<string | null>(null);
  const [sent, setSent] = useState<{ number: string | null } | null>(null);
  // Not knowing whether a request exists is not "there is none": starting a new
  // one then would save over the one already there, so nothing is offered.
  const [requestError, setRequestError] = useState(false);

  function load() {
    setQuotes(null);
    setError(null);
    getB2bQuotes(tenantSlug, accountId, skip, PAGE_SIZE)
      .then((res) => {
        setQuotes(res.items);
        setTotal(res.total);
      })
      .catch(() => setError('The quotes on this account could not be loaded just now.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, accountId, skip]);

  useEffect(() => {
    getB2bSummary(tenantSlug, accountId)
      .then((s) => {
        setCanWrite(ORDERING_ROLES.has(s.account.role));
        setCurrency(s.account.currency);
      })
      .catch(() => setCanWrite(false));
  }, [tenantSlug, accountId]);

  useEffect(() => {
    let active = true;
    getQuoteRequest(tenantSlug, accountId)
      .then((r) => {
        if (!active) return;
        setRequest(r.request);
        setRequestShop(r.shopName);
        setRequestLoaded(true);
      })
      .catch(() => active && setRequestError(true));
    return () => {
      active = false;
    };
  }, [tenantSlug, accountId]);

  const building = canWrite && requestLoaded && (request !== null || starting);

  function startRequest() {
    setSent(null);
    setStarting(true);
  }

  async function handleAccept(quoteId: string) {
    setActing(quoteId);
    setActionError(null);
    setOrderProblem(null);
    try {
      // Accepting places the order (sparx persona issue 085). The quote's own
      // sentence names the order once the list reloads; only an order that
      // could not be made needs saying here, with its reason.
      const accepted = await acceptB2bQuote(tenantSlug, accountId, quoteId);
      if (accepted.orderProblem) setOrderProblem({ id: quoteId, message: accepted.orderProblem });
      const made = accepted.order;
      if (made) {
        setAcceptedOrders((current) => ({
          ...current,
          [quoteId]: {
            id: made.id,
            orderNumber: made.orderNumber,
            status: made.held ? 'pending_approval' : 'placed',
            signOff: made.signOff ?? null,
          },
        }));
      }
      load();
    } catch (err) {
      // A refusal the buyer can act on (an account on credit hold, suspended,
      // not trading) says so. "Please try again" was the only answer, and
      // trying again changes none of those.
      setActionError({
        id: quoteId,
        message:
          err instanceof AccountError && err.status < 500
            ? err.message
            : 'The quote was not accepted. Please try again.',
      });
    } finally {
      setActing(null);
    }
  }

  function startDecline(quoteId: string) {
    setActionError(null);
    setDeclineReason('');
    setDeclining(quoteId);
  }

  async function handleDecline(quoteId: string) {
    const reason = declineReason.trim();
    setActing(quoteId);
    setActionError(null);
    try {
      await declineB2bQuote(tenantSlug, accountId, quoteId, reason.length > 0 ? reason : undefined);
      setDeclining(null);
      setDeclineReason('');
      load();
    } catch {
      setActionError({
        id: quoteId,
        message: 'The quote was not declined. Please try again.',
      });
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/account/b2b/${accountId}`} className="link link-primary">
            ← Back to account
          </Link>
          <h1 className="text-base-content text-3xl font-semibold tracking-tight">Quotes</h1>
        </div>
        {canWrite && requestLoaded && request === null && (
          <Button
            type="button"
            color="primary"
            variant={starting ? 'ghost' : undefined}
            onClick={() => (starting ? setStarting(false) : startRequest())}
          >
            {starting ? 'Cancel' : 'Request a quote'}
          </Button>
        )}
      </div>

      {sent && (
        <Alert color="success" className="mb-5" role="status">
          Your request{sent.number ? ` ${sent.number}` : ''} was sent to {requestShop ?? 'the shop'}
          . It is listed below, and its prices show there when they are ready.
        </Alert>
      )}

      {canWrite && requestError && (
        <Alert color="warning" className="mb-5" role="status">
          Your quote request could not be loaded just now. Reload the page to see it or start one.
        </Alert>
      )}

      {building && (
        <QuoteRequestBuilder
          accountId={accountId}
          shopName={requestShop ?? 'the shop'}
          currency={currency}
          request={request}
          onChanged={(next) => {
            setRequest(next);
            if (next === null) setStarting(false);
          }}
          onSent={(quote) => {
            setRequest(null);
            setStarting(false);
            setSent({ number: quote.number });
            setSkip(0);
            load();
          }}
        />
      )}

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : quotes === null ? (
        <div className="skeleton h-50" />
      ) : quotes.length === 0 ? (
        <div className="card border-base-300 items-center border p-8 text-center">
          <p className="text-base-content">
            {canWrite
              ? 'There are no quotes on this account yet. Use Request a quote, or Add to quote request on any product, to ask for a price.'
              : 'There are no quotes on this account yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {quotes.map((q) => {
              const order = q.order ?? acceptedOrders[q.id] ?? null;
              const view = quoteStageView({
                stageName: q.stage.name,
                stageType: q.stage.stageType,
                totalCents: q.totalCents ?? 0,
                shopName: q.shopName,
                canWrite,
                validUntil: q.validUntil ? formatDate(q.validUntil) : null,
                order,
              });
              // The figures, only when the shop has sent them (sparx persona
              // issue 086): before the offer the portal sends none.
              const money = view.priced ? pricedQuote(q) : null;
              const canAct = canWrite && q.stage.name === QUOTE_ACTIONABLE_STAGE;
              const isDeclining = declining === q.id;
              return (
                <div key={q.id} className="card border-base-300 gap-3 border px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <strong className="whitespace-nowrap">{q.number ?? 'Quote request'}</strong>
                      <div className="text-base-content text-sm">
                        {formatDate(q.createdAt)}
                        {q.stage.name === QUOTE_ACTIONABLE_STAGE && q.validUntil
                          ? ` · Good until ${formatDate(q.validUntil)}`
                          : ''}
                        {q.poNumber ? ` · Your PO number ${q.poNumber}` : ''}
                      </div>
                      {/* What they asked for about delivery when they sent it
                          (sparx persona issue 086). */}
                      {q.delivery && (
                        <div className="text-base-content text-sm">
                          {[
                            q.delivery.neededBy
                              ? `Needed by ${neededByWords(q.delivery.neededBy) ?? q.delivery.neededBy}`
                              : null,
                            q.delivery.deliverTo ? `Deliver to ${q.delivery.deliverTo}` : null,
                            q.delivery.notes,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge color={view.tone} variant="soft">
                        {view.label}
                      </Badge>
                      {money ? (
                        <strong className="whitespace-nowrap">
                          {formatMoney(money.totalCents, q.currency)}
                        </strong>
                      ) : (
                        <span className="text-base-content whitespace-nowrap">Not priced yet</span>
                      )}
                    </div>
                  </div>

                  {view.note && <p className="text-base-content">{view.note}</p>}

                  {q.lines.length > 0 && (
                    <ul className="border-base-300 divide-base-300 flex flex-col divide-y border-t">
                      {(money?.lines ?? q.lines).map((l) => (
                        <li key={l.id} className="flex flex-col gap-1 py-2">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <span className="min-w-0">{l.description}</span>
                            <span className="flex items-baseline gap-4 whitespace-nowrap">
                              <span className="text-base-content text-sm">
                                {money && l.unitPriceCents !== null
                                  ? `${quantityWords(l.quantity)} × ${formatMoney(l.unitPriceCents, q.currency)}`
                                  : `Quantity ${quantityWords(l.quantity)}`}
                              </span>
                              {money && l.lineSubtotalCents !== null && (
                                <span>{formatMoney(l.lineSubtotalCents, q.currency)}</span>
                              )}
                            </span>
                          </div>
                          {money && l.coreDepositCents != null && l.coreDepositCents > 0 && (
                            <span className="text-base-content">
                              {coreDepositSentence(
                                formatMoney(l.coreDepositCents, q.currency),
                                l.quantity
                              )}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {money && (
                    <dl className="border-base-300 flex flex-col gap-1 border-t pt-2">
                      {quoteSummaryRows({ ...money.totals, totalCents: money.totalCents }).map(
                        (row) => (
                          <div
                            key={row.label}
                            className={
                              row.total
                                ? 'flex justify-between gap-4 font-semibold'
                                : 'flex justify-between gap-4'
                            }
                          >
                            <dt>{row.label}</dt>
                            <dd className="whitespace-nowrap">
                              {formatMoney(row.cents, q.currency)}
                            </dd>
                          </div>
                        )
                      )}
                    </dl>
                  )}

                  {orderProblem?.id === q.id && (
                    <Alert color="warning" role="status">
                      Your order could not be placed yet. {orderProblem.message} {q.shopName} has
                      been told and will be in touch about it.
                    </Alert>
                  )}

                  {actionError?.id === q.id && (
                    <Alert color="danger" role="alert">
                      {actionError.message}
                    </Alert>
                  )}

                  {/* The same branded page the shop prints, for her to print or
                      keep as a PDF (sparx persona issue 085). Only once it is
                      priced: before that there is nothing on it to keep. */}
                  {money && (
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <Link
                        href={`/account/b2b/${accountId}/documents/${q.id}`}
                        className="link link-primary"
                      >
                        Print or save as PDF
                      </Link>
                      {/* Straight to the order it became, which says who it is
                          waiting on and who has approved it. */}
                      {order && (
                        <Link
                          href={`/account/b2b/${accountId}/orders/${order.id}`}
                          className="link link-primary whitespace-nowrap"
                        >
                          See order {order.orderNumber}
                        </Link>
                      )}
                    </div>
                  )}

                  {canAct && !isDeclining && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        color="primary"
                        disabled={acting === q.id}
                        onClick={() => void handleAccept(q.id)}
                      >
                        Accept quote
                      </Button>
                      <Button
                        type="button"
                        color="danger"
                        variant="outline"
                        disabled={acting === q.id}
                        onClick={() => startDecline(q.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  )}

                  {canAct && isDeclining && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`decline-reason-${q.id}`}>
                          Why are you declining? (optional)
                        </Label>
                        <Textarea
                          id={`decline-reason-${q.id}`}
                          value={declineReason}
                          onChange={(e) => setDeclineReason(e.target.value)}
                          rows={2}
                          maxLength={500}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          color="danger"
                          disabled={acting === q.id}
                          onClick={() => void handleDecline(q.id)}
                        >
                          Decline this quote
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={acting === q.id}
                          onClick={() => setDeclining(null)}
                        >
                          Keep it
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-base-content text-sm">
                {skip + 1} to {Math.min(skip + PAGE_SIZE, total)} of {total}
              </span>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip + PAGE_SIZE >= total}
                onClick={() => setSkip(skip + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
