'use client';

// Direct-customer estimate requests — the non-B2B counterpart to the B2B
// portal's quotes. An estimate IS a BillingDocument on the system
// `customer-estimates` workflow (docs/87 §15 convergence): its state is the
// stage it's sitting on (Requested/Priced/Approved/Declined), not a
// standalone status enum. Gated on the tenant's `invoicing` module — a
// tenant without it simply shows an informational message, same as the B2B
// portal's "no access yet" empty state.

import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import {
  acceptEstimate,
  declineEstimate,
  getEstimates,
  submitEstimate,
  type EstimateEntry,
} from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Alert, Badge, Button, Input, Label, Textarea } from '@wizeworks/silicaui-react';

const PAGE_SIZE = 20;
const ACTIONABLE_STAGE = 'Priced';

interface LineDraft {
  description: string;
  quantity: number;
}

function emptyLine(): LineDraft {
  return { description: '', quantity: 1 };
}

/** `prompt()` returns '' when the user clears the field and confirms — treat
 *  that the same as "no reason given", not a reason of "". */
function promptedReason(raw: string | null): string | undefined {
  return raw && raw.trim().length > 0 ? raw : undefined;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function stageBadgeTone(stageType: string) {
  if (stageType === 'committed' || stageType === 'paid') return 'success';
  if (stageType === 'void') return 'danger';
  return 'neutral';
}

export default function EstimatesPage() {
  const { tenantSlug } = useCustomer();
  const [estimates, setEstimates] = useState<EstimateEntry[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setEstimates(null);
    setError(null);
    getEstimates(tenantSlug, skip, PAGE_SIZE)
      .then((res) => {
        if (res === null) {
          setAvailable(false);
          return;
        }
        setEstimates(res.items);
        setTotal(res.total);
      })
      .catch(() => setError('Could not load your estimate requests.'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, skip]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    const cleanLines = lines
      .map((l) => ({ ...l, description: l.description.trim() }))
      .filter((l) => l.description.length > 0);
    if (cleanLines.length === 0) {
      setFormError('Add at least one item you need an estimate for.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await submitEstimate(tenantSlug, {
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

  async function handleAccept(id: string) {
    setActing(id);
    try {
      await acceptEstimate(tenantSlug, id);
      load();
    } catch {
      alert('Could not approve the estimate. Please try again.');
    } finally {
      setActing(null);
    }
  }

  async function handleDecline(id: string) {
    const reason = promptedReason(prompt('Let us know why (optional):'));
    setActing(id);
    try {
      await declineEstimate(tenantSlug, id, reason);
      load();
    } catch {
      alert('Could not decline the estimate. Please try again.');
    } finally {
      setActing(null);
    }
  }

  if (!available) {
    return (
      <div>
        <h1
          className="text-base-content text-3xl font-semibold tracking-tight"
          style={{ marginBottom: '0.5rem' }}
        >
          Estimates
        </h1>
        <p className="text-base-content">This store doesn&apos;t offer estimate requests.</p>
      </div>
    );
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
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">Estimates</h1>
        <Button type="button" color="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Request an estimate'}
        </Button>
      </div>

      {showForm && (
        <div
          className="card border-base-300 border"
          style={{ padding: '1.25rem', marginBottom: '1.25rem' }}
        >
          <h2
            className="text-base-content text-xl font-semibold"
            style={{ marginBottom: '0.75rem' }}
          >
            What do you need?
          </h2>
          {formError && (
            <Alert color="danger" role="alert" style={{ marginBottom: '0.75rem' }}>
              {formError}
            </Alert>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor={`estimate-line-desc-${i}`}>Item / description</Label>
                  <Input
                    id={`estimate-line-desc-${i}`}
                    value={line.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    placeholder="e.g. Replace water heater, 40 gallon"
                  />
                </div>
                <div style={{ width: '90px' }}>
                  <Label htmlFor={`estimate-line-qty-${i}`}>Qty</Label>
                  <Input
                    id={`estimate-line-qty-${i}`}
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
              <Label htmlFor="estimate-note">Notes (optional)</Label>
              <Textarea
                id="estimate-note"
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
      ) : estimates === null ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : estimates.length === 0 ? (
        <div
          className="card border-base-300 border"
          style={{ padding: '2rem', textAlign: 'center' }}
        >
          <p className="text-base-content">No estimate requests yet.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {estimates.map((est) => {
              const canAct = est.stage.name === ACTIONABLE_STAGE;
              return (
                <div
                  key={est.id}
                  className="card border-base-300 border"
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
                    <strong>{est.number ?? 'Requested'}</strong>
                    <div
                      className="text-base-content"
                      style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}
                    >
                      Valid until {formatDate(est.validUntil)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Badge color={stageBadgeTone(est.stage.stageType)} variant="soft">
                      {est.stage.customerLabel ?? est.stage.name}
                    </Badge>
                    <strong style={{ whiteSpace: 'nowrap' }}>
                      {formatMoney(est.totalCents, est.currency)}
                    </strong>
                    {canAct && (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button
                          type="button"
                          color="primary"
                          size="sm"
                          disabled={acting === est.id}
                          onClick={() => void handleAccept(est.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          color="neutral"
                          variant="outline"
                          size="sm"
                          disabled={acting === est.id}
                          onClick={() => void handleDecline(est.id)}
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
              <span
                className="text-base-content"
                style={{ fontSize: '0.85rem', lineHeight: '2.25rem' }}
              >
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
