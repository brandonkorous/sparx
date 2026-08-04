'use client';

// Saved cards + the repeat orders that depend on them (docs/142 §9).
//
// A repeat order charges a card the customer saved once and may never think
// about again — until it expires. Without this page their only recovery is to
// email the merchant, which is how a routine expiry turns into a cancellation.
// So the two live together: the cards, and which repeat order each one is paying
// for.
//
// The card is collected by the payment processor's own form, never by this page.
// `beginCardSetup` returns what that form needs; what comes back here is a
// reference, not a card number.

import { useCallback, useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import {
  beginCardSetup,
  getMySubscriptions,
  getSavedCards,
  removeSavedCard,
  setDefaultCard,
  setSubscriptionCard,
  type MySubscription,
  type SavedCard,
} from '@/lib/customer-client';
import { Alert, Badge, Button, Select } from '@wizeworks/silicaui-react';

function cardLabel(card: SavedCard): string {
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card';
  return card.last4 ? `${brand} ending ${card.last4}` : brand;
}

function expiryLabel(card: SavedCard): string | null {
  if (!card.expMonth || !card.expYear) return null;
  return `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export default function PaymentMethodsPage() {
  const { tenantSlug } = useCustomer();
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [canSave, setCanSave] = useState(true);
  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getSavedCards(tenantSlug)
      .then((res) => {
        setCards(res.methods);
        setCanSave(res.canSave);
      })
      .catch(() => {
        setError('Could not load your saved cards.');
      });
    // A failure here must not blank the cards — the two are independent, and a
    // customer who came to fix a card should still be able to.
    getMySubscriptions(tenantSlug)
      .then(setSubscriptions)
      .catch(() => undefined);
  }, [tenantSlug]);

  useEffect(load, [load]);

  async function addCard() {
    setBusy(true);
    setError(null);
    try {
      const session = await beginCardSetup(tenantSlug, window.location.href);
      // A processor that collects the card on its own page (Square,
      // Authorize.net, some hosted flows) sends the customer there and back.
      if (session.redirectUrl) {
        window.location.href = session.redirectUrl;
        return;
      }
      // Inline processors need their card element mounted, which is checkout's
      // job — adding a card mid-account is routed through the same flow rather
      // than building a second card form that would drift from it.
      window.location.href = `/checkout/save-card?setup=${encodeURIComponent(session.setupRef)}${
        session.clientSecret ? `&secret=${encodeURIComponent(session.clientSecret)}` : ''
      }`;
    } catch {
      setError('Could not start adding a card. Please try again.');
      setBusy(false);
    }
  }

  async function remove(card: SavedCard) {
    setError(null);
    try {
      await removeSavedCard(tenantSlug, card.id);
      load();
    } catch (err) {
      // The API refuses with a message naming how many repeat orders are in the
      // way. That is exactly what the customer needs to read, so it is shown as
      // written rather than replaced with a generic failure.
      setError(err instanceof Error ? err.message : 'Could not remove that card.');
    }
  }

  async function makeDefault(card: SavedCard) {
    await setDefaultCard(tenantSlug, card.id);
    load();
  }

  async function moveSubscription(subscriptionId: string, cardId: string) {
    if (!cardId) return;
    setError(null);
    try {
      await setSubscriptionCard(tenantSlug, subscriptionId, cardId);
      load();
    } catch {
      setError('Could not change the card for that repeat order.');
    }
  }

  const usableCards = (cards ?? []).filter((c) => c.status === 'active' && !c.isExpired);
  const liveSubscriptions = subscriptions.filter(
    (s) => s.status !== 'cancelled' && s.billingMode === 'card'
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Payment methods</h1>
        <p className="text-md">
          Cards you have saved for repeat orders. We never see or store your card number — your card
          is held securely by our payment processor.
        </p>
      </div>

      {error ? (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      ) : null}

      {!canSave ? (
        <Alert color="info" variant="soft">
          This store does not take saved cards. Any repeat orders are billed to you each time, with
          a link to pay.
        </Alert>
      ) : null}

      {cards === null ? (
        <p>Loading…</p>
      ) : cards.length === 0 ? (
        <p>You have no saved cards yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className="border-base-300 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {cardLabel(card)}
                  {card.isDefault ? (
                    <Badge color="success" variant="soft" size="sm">
                      Default
                    </Badge>
                  ) : null}
                  {card.isExpired ? (
                    <Badge color="danger" variant="soft" size="sm">
                      Expired
                    </Badge>
                  ) : null}
                </span>
                <span className="text-sm">
                  {expiryLabel(card) ? `Expires ${expiryLabel(card) ?? ''}` : 'No expiry on file'}
                  {card.subscriptionCount > 0
                    ? ` · pays for ${String(card.subscriptionCount)} repeat ${
                        card.subscriptionCount === 1 ? 'order' : 'orders'
                      }`
                    : ''}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!card.isDefault && !card.isExpired ? (
                  <Button
                    size="sm"
                    variant="outline"
                    color="neutral"
                    onClick={() => void makeDefault(card)}
                  >
                    Make default
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  color="danger"
                  onClick={() => void remove(card)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canSave ? (
        <div>
          <Button color="primary" loading={busy} onClick={() => void addCard()}>
            Add a card
          </Button>
        </div>
      ) : null}

      {liveSubscriptions.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Your repeat orders</h2>
          <p className="text-md">Which card pays for each one. Change it any time.</p>
          {liveSubscriptions.map((sub) => (
            <div
              key={sub.id}
              className="border-base-300 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  {money(sub.monthlyRecurringRevenueCents, sub.currency)} a month ·{' '}
                  {sub.itemCount === 1 ? '1 item' : `${String(sub.itemCount)} items`}
                </span>
                <span className="text-sm">
                  {sub.status === 'past_due'
                    ? 'A payment did not go through — choosing a different card will retry it.'
                    : sub.nextOccurrenceAt
                      ? `Next order ${new Date(sub.nextOccurrenceAt).toLocaleDateString()}`
                      : 'No next order scheduled'}
                </span>
              </div>
              {usableCards.length > 0 ? (
                <Select
                  size="sm"
                  aria-label="Card for this repeat order"
                  value=""
                  placeholder="Use a different card…"
                  items={Object.fromEntries(usableCards.map((c) => [c.id, cardLabel(c)]))}
                  onValueChange={(next) => void moveSubscription(sub.id, String(next))}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
