'use client';

// B2B portal — quote list for one account. A quote IS a BillingDocument on
// the system `b2b-quotes` workflow (docs/87 convergence): its state is the
// stage it's sitting on (Draft/Submitted/Under Review/Quoted/Accepted/
// Declined/Expired), not a standalone status enum. This page lists quotes,
// lets a writer role (primary contact / buyer) submit a new RFQ, and act
// (accept/decline) once the merchant has priced one ("Quoted").

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/components/customer-provider';
import {
  acceptB2bQuote,
  declineB2bQuote,
  getB2bQuotes,
  getB2bSummary,
  submitB2bQuote,
  type B2bQuoteEntry,
  type B2bQuoteLineInput,
  type QuoteProductResult,
} from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Badge, Button, Input, Label, Textarea } from '@wizeworks/silicaui-react';
import { QuoteProductPicker } from './product-picker';

const PAGE_SIZE = 20;
const WRITER_ROLES = new Set(['primary_contact', 'buyer']);
const ACTIONABLE_STAGE = 'Quoted';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function stageBadgeStatus(stageType: string): string {
  if (stageType === 'committed' || stageType === 'paid') return 'success';
  if (stageType === 'void') return 'danger';
  return 'default';
}

function emptyLine(): B2bQuoteLineInput {
  return { description: '', quantity: 1 };
}

/** `prompt()` returns '' when the user clears the field and confirms — treat
 *  that the same as "no reason given", not a reason of "". */
function promptedReason(raw: string | null): string | undefined {
  return raw && raw.trim().length > 0 ? raw : undefined;
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

  const [showForm, setShowForm] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const [lines, setLines] = useState<B2bQuoteLineInput[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setQuotes(null);
    setError(null);
    getB2bQuotes(tenantSlug, accountId, skip, PAGE_SIZE)
      .then((res) => {
        setQuotes(res.items);
        setTotal(res.total);
      })
      .catch(() => setError('Could not load quotes.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, accountId, skip]);

  useEffect(() => {
    getB2bSummary(tenantSlug, accountId)
      .then((s) => setCanWrite(WRITER_ROLES.has(s.account.role)))
      .catch(() => setCanWrite(false));
  }, [tenantSlug, accountId]);

  function updateLine(index: number, patch: Partial<B2bQuoteLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  // A picked catalog result appends a new, product-linked line rather than
  // filling the free-text field — the merchant sees the real SKU behind it
  // (a product with no live variant falls back to a plain free-text line,
  // same as typing the title in manually).
  function addProductLine(product: QuoteProductResult) {
    setLines((prev) => {
      const draft = prev[0];
      const startingBlank = prev.length === 1 && draft?.description === '';
      const line: B2bQuoteLineInput = {
        description: product.title,
        quantity: 1,
        ...(product.variantId ? { variantId: product.variantId } : {}),
      };
      return startingBlank ? [line] : [...prev, line];
    });
  }

  async function handleSubmit() {
    const cleanLines = lines
      .map((l) => ({ ...l, description: l.description.trim() }))
      .filter((l) => l.description.length > 0);
    if (cleanLines.length === 0) {
      setFormError('Add at least one item you need a quote for.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await submitB2bQuote(tenantSlug, accountId, {
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
        lines: cleanLines,
      });
      setShowForm(false);
      setCustomerNote('');
      setLines([emptyLine()]);
      setSkip(0);
      load();
    } catch {
      setFormError('Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(quoteId: string) {
    setActing(quoteId);
    try {
      await acceptB2bQuote(tenantSlug, accountId, quoteId);
      load();
    } catch {
      alert('Could not accept the quote. Please try again.');
    } finally {
      setActing(null);
    }
  }

  async function handleDecline(quoteId: string) {
    const reason = promptedReason(prompt('Let us know why (optional):'));
    setActing(quoteId);
    try {
      await declineB2bQuote(tenantSlug, accountId, quoteId, reason);
      load();
    } catch {
      alert('Could not decline the quote. Please try again.');
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href={`/account/b2b/${accountId}`}
            className="st-link"
            style={{ fontSize: '0.9rem' }}
          >
            ← Back
          </Link>
          <h1 className="st-h2">Quotes</h1>
        </div>
        {canWrite && (
          <Button type="button" color="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Request a quote'}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="st-card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 className="st-h4" style={{ marginBottom: '0.75rem' }}>
            What do you need?
          </h2>
          {formError && (
            <Alert color="danger" role="alert" style={{ marginBottom: '0.75rem' }}>
              {formError}
            </Alert>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div>
              <Label htmlFor="quote-product-search">Add a product from the catalog</Label>
              <QuoteProductPicker onPick={addProductLine} />
            </div>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor={`quote-line-desc-${i}`}>
                    Item / description
                    {line.variantId && (
                      <Badge
                        color="module"
                        variant="soft"
                        size="sm"
                        style={{ marginLeft: '0.5rem' }}
                      >
                        Catalog item
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id={`quote-line-desc-${i}`}
                    value={line.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    placeholder="e.g. Brake pads for 2018 F-250, front"
                  />
                </div>
                <div style={{ width: '90px' }}>
                  <Label htmlFor={`quote-line-qty-${i}`}>Qty</Label>
                  <Input
                    id={`quote-line-qty-${i}`}
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 1 })}
                  />
                </div>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    color="neutral"
                    variant="ghost"
                    onClick={() => removeLine(i)}
                    aria-label="Remove item"
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            <div>
              <Button
                type="button"
                color="neutral"
                variant="outline"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                + Add another item
              </Button>
            </div>
            <div>
              <Label htmlFor="quote-note">Notes for the merchant (optional)</Label>
              <Textarea
                id="quote-note"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Button
                type="button"
                color="primary"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : quotes === null ? (
        <div className="st-skeleton" style={{ height: 200 }} />
      ) : quotes.length === 0 ? (
        <div className="st-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="st-muted">No quotes found on this account.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {quotes.map((q) => {
              const canAct = canWrite && q.stage.name === ACTIONABLE_STAGE;
              return (
                <div
                  key={q.id}
                  className="st-card"
                  style={{
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>{q.number ?? 'Draft'}</strong>
                    <div className="st-muted" style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}>
                      Valid until {formatDate(q.validUntil)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="st-badge" data-status={stageBadgeStatus(q.stage.stageType)}>
                      {q.stage.customerLabel ?? q.stage.name}
                    </span>
                    <strong style={{ whiteSpace: 'nowrap' }}>
                      {formatMoney(q.totalCents, q.currency)}
                    </strong>
                    {canAct && (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button
                          type="button"
                          color="primary"
                          size="sm"
                          disabled={acting === q.id}
                          onClick={() => void handleAccept(q.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          color="neutral"
                          variant="outline"
                          size="sm"
                          disabled={acting === q.id}
                          onClick={() => void handleDecline(q.id)}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <Button
                type="button"
                color="primary"
                variant="outline"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="st-muted" style={{ fontSize: '0.85rem', lineHeight: '2.25rem' }}>
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
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
