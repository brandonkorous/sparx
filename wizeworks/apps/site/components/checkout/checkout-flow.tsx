'use client';

// Multi-step checkout: Your details → Delivery or collection → Payment → Done.
// Drives the public checkout API and Stripe Elements. The cart's ownership
// token (x-cart-token) is sent by the checkout-client helpers.
//
// ── THE ORDER THE QUESTIONS COME IN ─────────────────────────────────────────
//
// The session is opened and the shop's fulfilment is quoted BEFORE the first
// question is asked, so checkout knows whether an address is ever going to be
// used before it asks anybody for one. A shop that only hands orders over its
// counter never shows an address form at all, and never labels a step
// "Shipping" (issue 064).

import { useEffect, useRef, useState } from 'react';

import { Alert } from '@wizeworks/silicaui-react';

import {
  createPaymentIntent,
  isCollectionRate,
  quoteShipping,
  startCheckout,
  submitContact,
  submitShipping,
  type Address,
  type CheckoutSession,
  type ShippingRate,
} from '@/lib/checkout-client';
import { useCart } from '../cart-provider';
import { useCustomer } from '../customer-provider';
import { EMPTY_ADDRESS } from './address-form';
import { PaymentStep } from './payment-step';
import { OrderSummary } from './order-summary';
import { Confirmation, EmptyCart, StepIndicator, type CheckoutStep } from './checkout-chrome';
import { ContactStep, EMPTY_CONTACT, type ContactDraft } from './contact-step';
import { CollectionStep } from './collection-step';
import { DeliveryStep } from './delivery-step';
import { useAddressBook } from './use-address-book';
import type { StorefrontPaymentMode } from '@/lib/made-to-order-copy';

export function CheckoutFlow({
  tenantSlug,
  /** How this shop can be paid, from the site payload. The checkout SESSION
   *  carries the same answer, but only once it exists — and the order summary is
   *  on screen from the first step, saying what the card will be charged before
   *  anything has asked the server anything (issue 185). */
  paymentMode: shopPaymentMode = 'card',
}: {
  tenantSlug: string;
  paymentMode?: StorefrontPaymentMode;
}) {
  const cart = useCart();
  const { customer } = useCustomer();
  const [step, setStep] = useState<CheckoutStep>('contact');
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [contact, setContact] = useState<ContactDraft>(EMPTY_CONTACT);

  // What this shop can actually do with this cart, asked before anything is
  // asked of the shopper. `null` while unknown — and unknown is drawn as the
  // delivery flow, because that is the one that asks for MORE, and briefly
  // showing a form that turns out to be unnecessary is a smaller lie than
  // briefly promising a collection that is not on offer.
  const [offer, setOffer] = useState<{ deliveryOffered: boolean; rates: ShippingRate[] } | null>(
    null
  );
  const collectionOnly = offer !== null && !offer.deliveryOffered;

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  // Whether THIS address has been quoted. Not `rates.length` — a shop that
  // cannot reach the address returns nothing, and that is an answer, not a
  // missing one.
  const [quoted, setQuoted] = useState(false);
  const [chosenRate, setChosenRate] = useState<ShippingRate | null>(null);

  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const collectedOrder = useRef(false);

  const book = useAddressBook({ tenantSlug, customer, contactName: contact.name });

  const cartReady = cart.cartId !== null;
  const cartEmpty = cartReady && cart.lines.length === 0;

  // Fill in what we already know about a signed-in shopper. Only into empty
  // fields: this must never overwrite something they have started typing.
  useEffect(() => {
    if (!customer) return;
    setContact((current) => ({
      ...current,
      name: current.name || [customer.firstName, customer.lastName].filter(Boolean).join(' '),
      email: current.email || (customer.email ?? ''),
      phone: current.phone || (customer.phone ?? ''),
    }));
  }, [customer]);

  // Open the session as soon as there is a cart, so the fulfilment question
  // below can be asked before the first form is drawn.
  const opening = useRef(false);
  useEffect(() => {
    if (!cart.cartId || session || opening.current) return;
    opening.current = true;
    startCheckout(tenantSlug, cart.cartId)
      .then(setSession)
      .catch((err: unknown) => {
        opening.current = false;
        setError((err as Error).message);
      });
  }, [cart.cartId, session, tenantSlug]);

  // Does this shop deliver? Asked with no destination, because the honest
  // answer does not depend on one — see the shipping-quote route.
  useEffect(() => {
    if (!session || offer) return;
    let live = true;
    quoteShipping(tenantSlug, session.sessionId, {})
      .then((result) => {
        if (!live) return;
        setOffer(result);
        if (!result.deliveryOffered) {
          setRates(result.rates);
          setChosenRate(result.rates[0] ?? null);
        }
      })
      .catch(() => {
        // A failed probe must not block checkout. Fall through to the delivery
        // flow, which asks for everything and so can never under-ask.
        if (live) setOffer({ deliveryOffered: true, rates: [] });
      });
    return () => {
      live = false;
    };
  }, [session, offer, tenantSlug]);

  function chooseAddress(next: Address) {
    // A different address is a different question — drop the answer to the old
    // one rather than carrying a rate priced for it.
    setAddress(next);
    setQuoted(false);
    setRates([]);
    setChosenRate(null);
  }

  // Start on the address they already gave us. Once, and only while the form
  // is still untouched — a shopper who has begun typing has answered the
  // question, and their usual address arriving late must not overwrite it.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !book.preferred || address.line1 !== '') return;
    prefilled.current = true;
    setAddress(book.preferred);
  }, [book.preferred, address.line1]);

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await submitContact(tenantSlug, session.sessionId, {
        email: contact.email,
        ...(contact.name.trim() ? { name: contact.name.trim() } : {}),
        ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
        acceptsMarketing: contact.acceptsMarketing,
      });
      setSession(updated);
      setStep('shipping');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Collecting: nothing to quote and nothing to ask for, so this is one call. */
  async function handleCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const rate = chosenRate ?? rates[0];
    if (!rate) {
      setError('Choose how you’d like to get your order before carrying on.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // No address, deliberately. Nothing is being posted, so there is nothing
      // to post it to, and a placeholder here is what put a fictional street on
      // a collection order (issue 064).
      setSession(await sendRate(tenantSlug, session.sessionId, rate));
      collectedOrder.current = true;
      setStep('payment');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      // First submit: quote rates for the entered destination + require a pick.
      // Send the full address (not just country/postal) so live carrier rating
      // can actually geocode the destination — a placeholder street/city
      // silently disables live rates entirely.
      //
      // Whatever comes back is what the shop actually offers. This used to
      // invent a free "Standard shipping" row whenever the quote was empty,
      // which was worse than useless: `submitShipping` re-prices every choice
      // against a fresh server quote and could never find a ref the client had
      // made up, so picking it dead-ended on "that shipping option is no longer
      // available". An empty quote now says the true thing instead.
      if (!quoted) {
        const result = await quoteShipping(tenantSlug, session.sessionId, {
          destinationAddress: address,
        });
        setQuoted(true);
        setRates(result.rates);
        setChosenRate(result.rates[0] ?? null);
        if (result.rates.length === 0) {
          setError(
            'We can’t get an order to that address. Check it over, or try another address — and do get in touch if you think it should work.'
          );
        }
        return;
      }

      const rate = chosenRate ?? rates[0];
      if (!rate) {
        setError('Choose how you’d like to get your order before carrying on.');
        return;
      }
      // Keep it, if they asked us to. Before the order, so a save that fails
      // for its own reasons cannot take the sale down with it — and after the
      // rate is known, so we never file an address for an order that then
      // could not be delivered anyway.
      await book.keepIfAsked(address);
      setSession(await sendRate(tenantSlug, session.sessionId, rate, address));
      collectedOrder.current = isCollectionRate(rate);
      setStep('payment');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handlePaid(orderNum: string) {
    setOrderNumber(orderNum);
    setStep('done');
    cart.reset();
  }

  if (cartEmpty && step !== 'done') return <EmptyCart />;

  if (step === 'done' && orderNumber) {
    return (
      <Confirmation
        orderNumber={orderNumber}
        paymentMode={session?.paymentMode ?? shopPaymentMode}
        collecting={collectedOrder.current}
        {...(session?.madeToOrder ? { madeToOrder: session.madeToOrder } : {})}
        currency={session?.currency ?? cart.currency}
      />
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-[clamp(1.5rem,4vw,3.5rem)] max-[860px]:grid-cols-1">
      <div>
        <StepIndicator step={step} collectionOnly={collectionOnly} />

        {error ? <Alert color="danger">{error}</Alert> : null}

        {step === 'contact' ? (
          <ContactStep
            value={contact}
            onChange={setContact}
            onSubmit={handleContact}
            busy={busy || !session}
            collectionOnly={collectionOnly}
          />
        ) : null}

        {step === 'shipping' && collectionOnly ? (
          <CollectionStep
            rates={rates}
            chosen={chosenRate}
            onChoose={setChosenRate}
            currency={session?.currency ?? cart.currency}
            contactName={contact.name.trim()}
            contactPhone={contact.phone.trim()}
            onBack={() => setStep('contact')}
            onSubmit={handleCollection}
            busy={busy}
          />
        ) : null}

        {step === 'shipping' && !collectionOnly ? (
          <DeliveryStep
            book={book.addresses}
            savedId={book.selectedId}
            onPickSaved={(id) => {
              book.select(id);
              chooseAddress(book.addressFor(id) ?? { ...EMPTY_ADDRESS, name: contact.name });
            }}
            address={address}
            onAddressChange={chooseAddress}
            canSave={book.canSave}
            save={book.save}
            onSaveChange={book.setSave}
            rates={rates}
            chosen={chosenRate}
            onChoose={setChosenRate}
            currency={session?.currency ?? cart.currency}
            quoted={quoted}
            onBack={() => setStep('contact')}
            onSubmit={handleDelivery}
            busy={busy}
          />
        ) : null}

        {step === 'payment' && session ? (
          <PaymentStep
            tenantSlug={tenantSlug}
            session={session}
            onBack={() => setStep('shipping')}
            onPaid={handlePaid}
            createIntent={() =>
              createPaymentIntent(
                tenantSlug,
                session.sessionId,
                typeof window !== 'undefined'
                  ? `${window.location.origin}${window.location.pathname}?paid=${session.sessionId}`
                  : undefined
              )
            }
          />
        ) : null}
      </div>

      <aside className="sticky top-[92px] max-[860px]:static max-[860px]:order-[-1]">
        {/* The session's made-to-order split wins once checkout has started: it
            is taken against the total the gateway will actually be handed,
            delivery and surcharge included (issue 026). */}
        <OrderSummary
          lines={cart.lines}
          totals={session?.totals ?? cart.totals}
          currency={session?.currency ?? cart.currency}
          {...(session?.surchargeLabel ? { surchargeLabel: session.surchargeLabel } : {})}
          madeToOrder={session?.madeToOrder ?? cart.madeToOrder}
          paymentMode={session?.paymentMode ?? shopPaymentMode}
        />
      </aside>
    </div>
  );
}

/** The one shape of a shipping submission, with or without somewhere to send
 *  it. Carries the rate's stable identity so the server can re-find it after
 *  re-quoting even when a live carrier's single-use ref has rotated (BUG-010) —
 *  otherwise picking a real USPS/UPS rate dead-ends checkout. */
function sendRate(
  tenantSlug: string,
  sessionId: string,
  rate: ShippingRate,
  address?: Address
): Promise<CheckoutSession> {
  return submitShipping(tenantSlug, sessionId, {
    ...(address ? { shippingAddress: address } : {}),
    shippingRateRef: rate.rateRef,
    shippingProviderSlug: rate.providerSlug,
    shippingService: rate.service,
    shippingCarrier: rate.carrier,
  });
}
