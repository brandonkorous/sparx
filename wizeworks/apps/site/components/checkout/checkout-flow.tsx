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

import { checkoutBlock } from '@/lib/account-buying-rules';
import { ordersClosed } from '@/lib/orders-closed';
import {
  createPaymentIntent,
  isCheckoutUnreachable,
  isCollectionRate,
  quoteShipping,
  startCheckout,
  submitContact,
  submitShipping,
  type Address,
  type CheckoutSession,
  type ShippingRate,
} from '@/lib/checkout-client';
import { useCart, type CartLine, type CartTotals } from '../cart-provider';
import { useCustomer } from '../customer-provider';
import { EMPTY_ADDRESS } from './address-form';
import { PaymentStep } from './payment-step';
import { OrderSummary } from './order-summary';
import {
  Confirmation,
  EmptyCart,
  OrdersClosed,
  StepIndicator,
  type CheckoutStep,
} from './checkout-chrome';
import type { PlacedOrderResult } from './payment-step';
import { ContactStep, EMPTY_CONTACT, type ContactDraft } from './contact-step';
import { CollectionStep } from './collection-step';
import { DeliveryStep } from './delivery-step';
import { useAddressBook } from './use-address-book';
import { RepeatNeedsDelivery, RepeatNeedsSignIn, RepeatTerms } from './repeat-checkout';
import type { StorefrontPaymentMode } from '@/lib/made-to-order-copy';
import { isBoughtCartError } from '@/lib/bought-cart';
import {
  CART_UNREACHABLE_MESSAGE,
  CHECKOUT_UNREACHABLE_MESSAGE,
  retryDelayMs,
} from '@/lib/shop-reach';

/** The sale, as the confirmation screen needs it. */
interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  /** Waiting to be signed off (sparx persona issue 085), and by whom: the
   *  account's own approvers, the business, or both (sparx persona issue 087). */
  held: boolean;
  approval: PlacedOrderResult['approval'];
  /** What happened to the card: held until it is approved, charged, or none,
   *  so the confirmation says which (sparx persona issue 087). */
  card: PlacedOrderResult['card'];
  lines: CartLine[];
  totals: CartTotals;
  currency: string;
  rate: ShippingRate | null;
  /** Null when the order is being collected: there is nowhere to send it. */
  address: Address | null;
}

export function CheckoutFlow({
  tenantSlug,
  /** How this shop can be paid, from the site payload. The checkout SESSION
   *  carries the same answer, but only once it exists — and the order summary is
   *  on screen from the first step, saying what the card will be charged before
   *  anything has asked the server anything (issue 185). */
  paymentMode: shopPaymentMode = 'card',
  /** The business's own name, so a held order says who approves it (sparx
   *  persona issue 087). */
  shopName = null,
}: {
  tenantSlug: string;
  paymentMode?: StorefrontPaymentMode;
  shopName?: string | null;
}) {
  const cart = useCart();
  const { customer, status } = useCustomer();
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
  // A shop that delivers AND hands over in person (sparx persona issue 129):
  // the opening answer carries the collection option beside "deliveryOffered".
  // Choosing it skips the address entirely, the same as a collection-only shop.
  const [pickupRate, setPickupRate] = useState<ShippingRate | null>(null);
  const [collectInstead, setCollectInstead] = useState(false);

  // The SESSION only becomes the authority on money once the delivery step has
  // been submitted. It opens on mount and does not follow a basket edit, so before
  // then its totals go stale — a line reading $192 over a subtotal of $96 — and
  // its zero shipping is "not worked out", not free (issue 206).
  const settled = collectionOnly || step === 'payment' || step === 'done';

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  // Whether THIS address has been quoted. Not `rates.length` — a shop that
  // cannot reach the address returns nothing, and that is an answer, not a
  // missing one.
  const [quoted, setQuoted] = useState(false);
  const [chosenRate, setChosenRate] = useState<ShippingRate | null>(null);

  // What was bought, kept at the moment it was bought. `cart.reset()` runs in
  // the same breath, so the confirmation screen has no cart to read and the
  // session is about to be irrelevant — and that screen is the only record of
  // the sale on a shop that sends no email.
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const collectedOrder = useRef(false);

  const book = useAddressBook({ tenantSlug, customer, contactName: contact.name });

  // `cart.known`, not `cart.cartId !== null`. A shopper who has never put
  // anything in a basket has no cart id, and reading that as "still loading"
  // left checkout showing a full form over a $0.00 total with its button stuck
  // on "Saving…" forever, because the session it waits for needs a cart.
  const cartEmpty = cart.known && cart.lines.length === 0;

  // Lines the shopper asked to have delivered again (issue 739). They need an
  // account and a delivery, and both are said here, before the forms, rather
  // than as a refusal at the last button.
  const repeating = cart.lines.filter((line) => line.repeat !== null);
  // Only a real "nobody is signed in". A session read that got no answer
  // (`unreachable`) says nothing about the buyer, and telling a signed-in buyer
  // to sign in mid-checkout is how a blip loses the sale (persona issue 086).
  const repeatNeedsSignIn = repeating.length > 0 && status === 'anonymous';

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
  //
  // When the shop cannot be reached to open it, every step below waits on a
  // session that never comes, so this asks again by itself on a backing-off
  // timer and says so, rather than stopping at an error with no way forward
  // (persona issue 086). `openMisses` counts the unanswered tries.
  const opening = useRef(false);
  const [openMisses, setOpenMisses] = useState(0);
  const refreshCart = cart.refresh;
  useEffect(() => {
    const cartId = cart.cartId;
    if (!cartId || session || opening.current) return;
    const open = () => {
      opening.current = true;
      startCheckout(tenantSlug, cartId)
        .then((opened) => {
          setOpenMisses(0);
          setSession(opened);
        })
        .catch((err: unknown) => {
          opening.current = false;
          if (isCheckoutUnreachable(err)) {
            setOpenMisses((n) => n + 1);
            return;
          }
          // This basket was already bought, in another tab or on another
          // device. Reading it again makes the cart forget it, and the page
          // shows an empty basket rather than an error (sparx persona issue 087).
          if (isBoughtCartError(err)) {
            void refreshCart();
            return;
          }
          setError((err as Error).message);
        });
    };
    if (openMisses === 0) {
      open();
      return;
    }
    const timer = window.setTimeout(open, retryDelayMs(openMisses - 1));
    return () => window.clearTimeout(timer);
  }, [cart.cartId, refreshCart, session, tenantSlug, openMisses]);

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
        } else {
          setPickupRate(result.rates.find(isCollectionRate) ?? null);
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
  // What the buyer wants the shop to know about this order. Asked for on the
  // delivery / collection step and stored on the SESSION when that step is
  // submitted, because a hosted-redirect gateway navigates this tab away and
  // takes every bit of React state with it (issue 874).
  const [note, setNote] = useState('');

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
      setSession(await sendRate(tenantSlug, session.sessionId, rate, note));
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
            'We can’t get an order to that address. Check it over, or try another address, and do get in touch if you think it should work.'
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
      // Collecting from this list needs no address either: nothing is posted,
      // so none is stored or kept (issue 064, and 129 for a shop doing both).
      const collecting = isCollectionRate(rate);
      if (!collecting) await book.keepIfAsked(address);
      setSession(
        await sendRate(tenantSlug, session.sessionId, rate, note, ...(collecting ? [] : [address]))
      );
      collectedOrder.current = collecting;
      setStep('payment');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handlePaid(order: PlacedOrderResult) {
    setPlaced({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      held: order.held,
      approval: order.approval,
      card: order.card,
      lines: cart.lines,
      totals: session?.totals ?? cart.totals,
      currency: session?.currency ?? cart.currency,
      rate: chosenRate,
      address: collectedOrder.current ? null : address,
    });
    setStep('done');
    cart.reset();
  }

  // The basket could not be read yet. Not "your cart is empty": the cart
  // provider keeps it and asks again by itself (persona issue 086).
  if (cart.unreachable && !cart.known && step !== 'done') {
    return (
      <Alert color="warning" role="status" aria-live="polite">
        {CART_UNREACHABLE_MESSAGE}
      </Alert>
    );
  }
  if (cartEmpty && step !== 'done') return <EmptyCart />;
  // A shop that cannot be paid here yet: said before anything is asked, not on
  // the payment step after an address has been typed (sparx persona issue 131).
  if (ordersClosed(shopPaymentMode, cart.accountRules?.paymentTerms) && step === 'contact') {
    return <OrdersClosed />;
  }
  if (repeatNeedsSignIn && step !== 'done') return <RepeatNeedsSignIn lines={repeating} />;

  if (step === 'done' && placed) {
    return (
      <Confirmation
        orderId={placed.orderId}
        orderNumber={placed.orderNumber}
        held={placed.held}
        approval={placed.approval}
        card={placed.card}
        shopName={shopName}
        paymentMode={session?.paymentMode ?? shopPaymentMode}
        collecting={collectedOrder.current}
        {...(session?.madeToOrder ? { madeToOrder: session.madeToOrder } : {})}
        currency={placed.currency}
        lines={placed.lines}
        totals={placed.totals}
        rate={placed.rate}
        address={placed.address}
        signedIn={customer !== null}
      />
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-[clamp(1.5rem,4vw,3.5rem)] max-[860px]:grid-cols-1">
      <div>
        <StepIndicator step={step} collectionOnly={collectionOnly} />

        {/* A trade account's rules on this basket (sparx persona issue 086): the
            shortfall under its minimum order, a line off its case pack, or a role
            that cannot order. Said before any step, because the server refuses to
            take a payment for this basket until it is put right in the cart. */}
        {checkoutBlock(cart.accountRules) ? (
          <Alert color={cart.accountRules?.canOrder === false ? 'info' : 'warning'}>
            {checkoutBlock(cart.accountRules)}
            {cart.accountRules?.canOrder === false ? null : (
              <>
                {' '}
                Change it in{' '}
                <a href="/cart" className="underline">
                  your cart
                </a>
                .
              </>
            )}
          </Alert>
        ) : null}
        {error && error !== checkoutBlock(cart.accountRules) ? (
          <Alert color="danger">{error}</Alert>
        ) : null}
        {openMisses > 0 && !session ? (
          <Alert color="warning" role="status" aria-live="polite">
            {CHECKOUT_UNREACHABLE_MESSAGE}
          </Alert>
        ) : null}

        {repeating.length > 0 && collectionOnly ? <RepeatNeedsDelivery lines={repeating} /> : null}
        {repeating.length > 0 && step === 'payment' ? <RepeatTerms lines={repeating} /> : null}

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
            note={note}
            onNoteChange={setNote}
          />
        ) : null}

        {step === 'shipping' && !collectionOnly && collectInstead && pickupRate ? (
          <CollectionStep
            rates={[pickupRate]}
            chosen={pickupRate}
            onChoose={setChosenRate}
            currency={session?.currency ?? cart.currency}
            contactName={contact.name.trim()}
            contactPhone={contact.phone.trim()}
            onBack={() => {
              setCollectInstead(false);
              setChosenRate(null);
            }}
            onSubmit={handleCollection}
            busy={busy}
            note={note}
            onNoteChange={setNote}
          />
        ) : null}

        {step === 'shipping' && !collectionOnly && !(collectInstead && pickupRate) ? (
          <DeliveryStep
            onCollectInstead={
              pickupRate
                ? () => {
                    setChosenRate(pickupRate);
                    setCollectInstead(true);
                  }
                : undefined
            }
            book={book.addresses}
            savedId={book.selectedId}
            onPickSaved={(id) => {
              book.select(id);
              chooseAddress(book.addressFor(id) ?? { ...EMPTY_ADDRESS, name: contact.name });
            }}
            contactName={contact.name}
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
            note={note}
            onNoteChange={setNote}
          />
        ) : null}

        {step === 'payment' && session ? (
          <PaymentStep
            tenantSlug={tenantSlug}
            session={session}
            collecting={collectedOrder.current}
            shopName={shopName}
            accountName={cart.accountRules?.accountName ?? null}
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
        {/* Delivery is only KNOWN once the delivery step has been SUBMITTED. The
            session opens on mount carrying zero, so its existence proves nothing;
            before payment, zero means "not worked out", never "free" (issue 206).

            The session's made-to-order split wins once checkout has started: it
            is taken against the total the gateway will actually be handed,
            delivery and surcharge included (issue 026). */}
        <OrderSummary
          lines={cart.lines}
          totals={settled ? (session?.totals ?? cart.totals) : cart.totals}
          currency={session?.currency ?? cart.currency}
          {...(session?.surchargeLabel ? { surchargeLabel: session.surchargeLabel } : {})}
          madeToOrder={session?.madeToOrder ?? cart.madeToOrder}
          paymentMode={session?.paymentMode ?? shopPaymentMode}
          shippingSettled={settled}
          pendingShippingCents={chosenRate ? chosenRate.amountCents : null}
          // Pay the core deposit or send the old part first (issue 057), while the
          // summary still follows the basket. Once the payment step holds the
          // total, a switch would change what the card is about to be charged.
          {...(settled ? {} : { onCoreFirst: cart.setCoreFirst })}
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
  note: string,
  address?: Address
): Promise<CheckoutSession> {
  return submitShipping(tenantSlug, sessionId, {
    ...(address ? { shippingAddress: address } : {}),
    shippingRateRef: rate.rateRef,
    shippingProviderSlug: rate.providerSlug,
    shippingService: rate.service,
    shippingCarrier: rate.carrier,
    // Always sent, never conditional: an empty box is a shopper clearing what
    // they wrote, and a conditional here would make the note unclearable.
    customerNote: note.trim(),
  });
}
