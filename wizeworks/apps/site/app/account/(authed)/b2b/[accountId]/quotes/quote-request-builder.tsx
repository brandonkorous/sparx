'use client';

// The account's quote request while it is being built (sparx persona issue 086).
//
// The /b2b page promised "From the catalog, the buyer builds a request
// (quantities, delivery needs, notes) and submits it. It lands in your
// dashboard, separate from the cart." Items arrive here from "Add to quote
// request" on product pages, or are picked or typed in right here. The request
// is kept on the server for the ACCOUNT, so it is the same one on any device
// and for anyone on the account who can order.
//
// The shop sees nothing until Send. Until then the request is only the
// account's (see b2b-quote-request-service for why it is not a draft quote).
// Edits here are kept when Save for later or Send is pressed.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Input,
  Label,
  Textarea,
} from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { neededByWords } from '@/lib/buying-again-words';
import {
  AccountError,
  discardQuoteRequest,
  saveQuoteRequest,
  submitQuoteRequest,
  type QuoteProductResult,
  type QuoteRequest,
  type QuoteRequestInput,
} from '@/lib/customer-client';
import { QuoteProductPicker } from './product-picker';

interface DraftLine {
  /** Stable React key for a line, kept across edits. */
  key: string;
  variantId: string | null;
  description: string;
  quantity: number;
}

interface Draft {
  neededBy: string;
  deliverTo: string;
  deliveryNotes: string;
  poNumber: string;
  notes: string;
  lines: DraftLine[];
}

let keySeq = 0;
const nextKey = () => `line-${++keySeq}`;

function draftFrom(request: QuoteRequest | null): Draft {
  return {
    neededBy: request?.neededBy ?? '',
    deliverTo: request?.deliverTo ?? '',
    deliveryNotes: request?.deliveryNotes ?? '',
    poNumber: request?.poNumber ?? '',
    notes: request?.notes ?? '',
    lines:
      request && request.lines.length > 0
        ? request.lines.map((l) => ({
            key: nextKey(),
            variantId: l.variantId,
            description: l.description,
            quantity: l.quantity,
          }))
        : [{ key: nextKey(), variantId: null, description: '', quantity: 1 }],
  };
}

function inputFrom(draft: Draft): QuoteRequestInput {
  const blank = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    neededBy: blank(draft.neededBy),
    deliverTo: blank(draft.deliverTo),
    deliveryNotes: blank(draft.deliveryNotes),
    poNumber: blank(draft.poNumber),
    notes: blank(draft.notes),
    // A typed line with nothing typed is an empty row, not an item.
    lines: draft.lines
      .filter((l) => l.variantId !== null || l.description.trim() !== '')
      .map((l) =>
        l.variantId
          ? { variantId: l.variantId, quantity: l.quantity }
          : { description: l.description.trim(), quantity: l.quantity }
      ),
  };
}

function itemCount(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

export function QuoteRequestBuilder({
  accountId,
  shopName,
  currency,
  request,
  onChanged,
  onSent,
}: {
  accountId: string;
  /** Who the request goes to, for the sentences that say so. */
  shopName: string;
  currency: string | null;
  /** The account's open request, or null to start a new one. */
  request: QuoteRequest | null;
  onChanged: (request: QuoteRequest | null) => void;
  onSent: (quote: { id: string; number: string | null }) => void;
}) {
  const { tenantSlug } = useCustomer();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(request));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(inputFrom(draftFrom(request))));
  const [busy, setBusy] = useState<'save' | 'send' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  // A request changed elsewhere (another tab, a product page) replaces this one
  // only when nothing here is unsaved.
  const current = useMemo(() => JSON.stringify(inputFrom(draft)), [draft]);
  const dirty = current !== saved;
  useEffect(() => {
    if (dirty) return;
    const next = draftFrom(request);
    setDraft(next);
    setSaved(JSON.stringify(inputFrom(next)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.updatedAt]);

  const filledLines = inputFrom(draft).lines.length;

  function update(patch: Partial<Draft>) {
    setSavedNote(false);
    setDraft((d) => ({ ...d, ...patch }));
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setSavedNote(false);
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  }

  function removeLine(key: string) {
    setSavedNote(false);
    setDraft((d) => {
      const left = d.lines.filter((l) => l.key !== key);
      return {
        ...d,
        lines:
          left.length > 0
            ? left
            : [{ key: nextKey(), variantId: null, description: '', quantity: 1 }],
      };
    });
  }

  // A picked catalog result is its own line, linked to the real item, so the
  // shop sees the exact SKU rather than a guess from words. The same item picked
  // twice is more of it.
  function addProduct(product: QuoteProductResult) {
    setSavedNote(false);
    setDraft((d) => {
      if (product.variantId) {
        const same = d.lines.find((l) => l.variantId === product.variantId);
        if (same) {
          return {
            ...d,
            lines: d.lines.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l)),
          };
        }
      }
      const line: DraftLine = {
        key: nextKey(),
        variantId: product.variantId,
        description: product.title,
        quantity: 1,
      };
      const onlyBlank =
        d.lines.length === 1 && d.lines[0]?.variantId === null && d.lines[0]?.description === '';
      return { ...d, lines: onlyBlank ? [line] : [...d.lines, line] };
    });
  }

  function failure(err: unknown, fallback: string): string {
    return err instanceof AccountError && err.status < 500 ? err.message : fallback;
  }

  async function save(): Promise<QuoteRequest | null> {
    const next = await saveQuoteRequest(tenantSlug, accountId, inputFrom(draft));
    const fresh = draftFrom(next);
    setDraft(fresh);
    setSaved(JSON.stringify(inputFrom(fresh)));
    onChanged(next);
    return next;
  }

  async function handleSave() {
    setBusy('save');
    setError(null);
    try {
      await save();
      setSavedNote(true);
    } catch (err) {
      setError(failure(err, 'Your changes were not saved. Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (filledLines === 0) {
      setError('Add at least one item you need a price for.');
      return;
    }
    setBusy('send');
    setError(null);
    try {
      // What is on the screen is what is sent: save it, then send it.
      await save();
      const quote = await submitQuoteRequest(tenantSlug, accountId);
      onChanged(null);
      onSent(quote);
    } catch (err) {
      setError(failure(err, 'Your request was not sent. Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  async function handleDiscard() {
    setBusy('discard');
    setError(null);
    try {
      await discardQuoteRequest(tenantSlug, accountId);
      onChanged(null);
    } catch (err) {
      setError(failure(err, 'The request was not thrown away. Please try again.'));
    } finally {
      setBusy(null);
    }
  }

  const neededBy = neededByWords(draft.neededBy || null);

  return (
    <div className="card border-base-300 mb-5 gap-5 border p-5">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base-content text-xl font-semibold">Your quote request</h2>
          <Badge color="warning" variant="soft">
            Not sent yet
          </Badge>
        </div>
        <p className="text-base-content m-0">
          {shopName} sees this only when you send it. Everyone on your account who can order sees
          the same request, on any device.
          {request?.startedBy ? ` Started by ${request.startedBy}.` : ''}
        </p>
      </div>

      {error && (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-base-content text-lg font-semibold">What you need</h3>
        <div className="flex flex-col gap-1">
          <Label htmlFor="quote-product-search">Add a product from the catalog</Label>
          <QuoteProductPicker onPick={addProduct} currency={currency} />
        </div>
        {draft.lines.map((line, i) => (
          <div key={line.key} className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <Label htmlFor={`request-line-desc-${line.key}`}>
                {`Item ${i + 1}`}
                {line.variantId && (
                  <Badge color="module" variant="soft" size="sm" className="ml-2">
                    From the catalog
                  </Badge>
                )}
              </Label>
              <Input
                id={`request-line-desc-${line.key}`}
                value={line.description}
                readOnly={line.variantId !== null}
                onChange={(e) => updateLine(line.key, { description: e.target.value })}
                placeholder="For example, front brake pads for a 2018 work truck"
              />
            </div>
            <div className="flex w-28 shrink-0 flex-col gap-1">
              <Label htmlFor={`request-line-qty-${line.key}`}>Quantity</Label>
              <Input
                id={`request-line-qty-${line.key}`}
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) =>
                  updateLine(line.key, {
                    quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  })
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              color="danger"
              onClick={() => removeLine(line.key)}
              aria-label={`Remove ${line.description || 'this item'}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            color="primary"
            variant="outline"
            onClick={() =>
              update({
                lines: [
                  ...draft.lines,
                  { key: nextKey(), variantId: null, description: '', quantity: 1 },
                ],
              })
            }
          >
            + Type in another item
          </Button>
        </div>
      </div>

      <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
        <h3 className="text-base-content text-lg font-semibold">Delivery</h3>
        <div className="flex flex-col gap-1">
          <Label htmlFor="request-needed-by">Needed by (optional)</Label>
          <Input
            id="request-needed-by"
            type="date"
            className="max-w-xs"
            value={draft.neededBy}
            onChange={(e) => update({ neededBy: e.target.value })}
          />
          {neededBy && <span className="text-base-content text-sm">{neededBy}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="request-deliver-to">Where it goes (optional)</Label>
          <Textarea
            id="request-deliver-to"
            rows={2}
            maxLength={1000}
            value={draft.deliverTo}
            onChange={(e) => update({ deliverTo: e.target.value })}
            placeholder="The address or site it should be delivered to"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="request-delivery-notes">Anything about delivery (optional)</Label>
          <Textarea
            id="request-delivery-notes"
            rows={2}
            maxLength={2000}
            value={draft.deliveryNotes}
            onChange={(e) => update({ deliveryNotes: e.target.value })}
            placeholder="For example, forklift on site, or deliver before 10am"
          />
        </div>
      </div>

      <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="request-po">Your purchase order number (optional)</Label>
          <Input
            id="request-po"
            className="max-w-sm"
            maxLength={63}
            value={draft.poNumber}
            onChange={(e) => update({ poNumber: e.target.value })}
          />
          <span className="text-base-content text-sm">
            It goes on the quote, and on the order and invoice if you accept it.
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="request-notes">Notes for {shopName} (optional)</Label>
          <Textarea
            id="request-notes"
            rows={3}
            maxLength={2000}
            value={draft.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </div>
      </div>

      {savedNote && !dirty && (
        <Alert color="success" role="status">
          Saved. It has not been sent. Send it when it is ready.
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          color="primary"
          disabled={busy !== null}
          onClick={() => void handleSend()}
        >
          {busy === 'send' ? 'Sending…' : `Send request to ${shopName}`}
        </Button>
        <Button
          type="button"
          color="primary"
          variant="outline"
          disabled={busy !== null || !dirty}
          onClick={() => void handleSave()}
        >
          {busy === 'save' ? 'Saving…' : 'Save for later'}
        </Button>
        {request && (
          <AlertDialog>
            <AlertDialogTrigger>
              <Button type="button" color="danger" variant="ghost" disabled={busy !== null}>
                Throw it away
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Throw away this quote request?</AlertDialogTitle>
              <AlertDialogDescription>
                Its {itemCount(request.lines.length)}, delivery details and notes are deleted for
                everyone on your account. {shopName} never saw it. This cannot be undone.
              </AlertDialogDescription>
              <div className="mt-4 flex justify-end gap-2">
                <AlertDialogCancel>
                  <Button type="button" variant="ghost">
                    Keep it
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction color="danger" onClick={() => void handleDiscard()}>
                  Throw it away
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {dirty && (
          <span className="text-base-content text-sm">You have changes that are not saved.</span>
        )}
      </div>
      <p className="text-base-content m-0 text-sm">
        Looking for more?{' '}
        <Link href="/products" className="link link-primary">
          Browse the catalog
        </Link>{' '}
        and use Add to quote request on any product.
      </p>
    </div>
  );
}
