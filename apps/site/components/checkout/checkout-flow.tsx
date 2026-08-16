'use client';

// Multi-step checkout: Contact → Shipping → Payment → Confirmation.
// Drives the public checkout API and Stripe Elements. The cart's ownership
// token (x-cart-token) is sent by the checkout-client helpers.

import Link from 'next/link';
import { useState } from 'react';

import { Alert, Button, Input, Step, Steps } from '@wizeworks/silicaui-react';

import { formatMoney } from '@/lib/format';
import {
    createPaymentIntent,
    quoteShipping,
    startCheckout,
    submitContact,
    submitShipping,
    type Address,
    type CheckoutSession,
    type ShippingRate,
} from '@/lib/checkout-client';
import { useCart } from '../cart-provider';
import { AddressForm, EMPTY_ADDRESS } from './address-form';
import { PaymentStep } from './payment-step';
import { OrderSummary } from './order-summary';

// Named CheckoutStep, not Step: silica's <Step> is the stepper node component.
type CheckoutStep = 'contact' | 'shipping' | 'payment' | 'done';

export function CheckoutFlow({ tenantSlug }: { tenantSlug: string }) {
    const cart = useCart();
    const [step, setStep] = useState<CheckoutStep>('contact');
    const [session, setSession] = useState<CheckoutSession | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [email, setEmail] = useState('');
    const [acceptsMarketing, setAcceptsMarketing] = useState(false);

    const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
    const [rates, setRates] = useState<ShippingRate[]>([]);
    const [chosenRate, setChosenRate] = useState<ShippingRate | null>(null);

    const [orderNumber, setOrderNumber] = useState<string | null>(null);

    const cartReady = cart.cartId !== null;
    const cartEmpty = cartReady && cart.lines.length === 0;

    async function handleContact(e: React.FormEvent) {
        e.preventDefault();
        if (!cart.cartId) return;
        setBusy(true);
        setError(null);
        try {
            const s = session ?? (await startCheckout(tenantSlug, cart.cartId, email));
            const updated = await submitContact(tenantSlug, s.sessionId, { email, acceptsMarketing });
            setSession(updated);
            setStep('shipping');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    }

    async function handleShipping(e: React.FormEvent) {
        e.preventDefault();
        if (!session) return;
        setBusy(true);
        setError(null);
        try {
            // First submit: quote rates for the entered destination + require a pick.
            // Send the full address (not just country/postal) so live carrier
            // rating can actually geocode the destination — a placeholder
            // street/city silently disables live rates entirely.
            if (rates.length === 0) {
                const quoted = await quoteShipping(tenantSlug, session.sessionId, {
                    destinationAddress: address,
                });
                // Fall back to a single free standard option when the carrier engine
                // has no configured rates yet, so checkout still completes.
                const options =
                    quoted.length > 0
                        ? quoted
                        : [
                            {
                                providerSlug: 'manual',
                                rateRef: 'standard',
                                service: 'Standard shipping',
                                carrier: 'Standard',
                                amountCents: 0,
                                estimatedDays: null,
                            },
                        ];
                setRates(options);
                setChosenRate(options[0] ?? null);
                setBusy(false);
                return;
            }

            const rate = chosenRate ?? rates[0]!;
            const updated = await submitShipping(tenantSlug, session.sessionId, {
                shippingAddress: address,
                shippingRateRef: rate.rateRef,
                shippingProviderSlug: rate.providerSlug,
                // Carry the rate's stable identity so the server can re-find it after
                // re-quoting even when a live carrier's single-use ref has rotated
                // (BUG-010) — otherwise picking a real USPS/UPS rate dead-ends checkout.
                shippingService: rate.service,
                shippingCarrier: rate.carrier,
            });
            setSession(updated);
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

    if (cartEmpty && step !== 'done') {
        return (
            <div
                className="text-base-content grid place-items-center gap-3 px-6 py-[clamp(3rem,8vw,6rem)] text-center"
                style={{ minHeight: '40vh' }}
            >
                <span className="text-[2.5rem] opacity-50" aria-hidden="true">
                    🛒
                </span>
                <h2 className="text-base-content text-3xl font-semibold tracking-tight">
                    Your cart is empty
                </h2>
                <Button render={<Link href="/products" />} color="primary">
                    Shop all products
                </Button>
            </div>
        );
    }

    if (step === 'done' && orderNumber) {
        return <Confirmation orderNumber={orderNumber} />;
    }

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-[clamp(1.5rem,4vw,3.5rem)] max-[860px]:grid-cols-1">
            <div>
                <StepIndicator step={step} />

                {error ? <Alert color="danger">{error}</Alert> : null}

                {step === 'contact' ? (
                    <form onSubmit={handleContact} className="flex max-w-[560px] flex-col gap-4">
                        <h2 className="text-base-content text-3xl font-semibold tracking-tight">Contact</h2>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-base-content text-sm font-medium">Email</span>
                            <Input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </label>
                        <label className="text-base-content flex cursor-pointer items-center gap-2.5 text-sm">
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={acceptsMarketing}
                                onChange={(e) => setAcceptsMarketing(e.target.checked)}
                            />
                            Email me with news and offers
                        </label>
                        <Button type="submit" color="primary" size="lg" disabled={busy}>
                            {busy ? 'Saving…' : 'Continue to shipping'}
                        </Button>
                    </form>
                ) : null}

                {step === 'shipping' ? (
                    <form onSubmit={handleShipping} className="flex max-w-[560px] flex-col gap-4">
                        <h2 className="text-base-content text-3xl font-semibold tracking-tight">
                            Shipping address
                        </h2>
                        <AddressForm value={address} onChange={setAddress} />

                        {rates.length > 0 ? (
                            <fieldset className="rounded-box border-base-300 m-0 flex flex-col gap-2 border p-4">
                                <legend className="text-base-content px-2 text-2xl font-semibold">
                                    Shipping method
                                </legend>
                                {rates.map((rate) => (
                                    <label
                                        key={rate.rateRef}
                                        className="rounded-field border-base-300 has-[input:checked]:border-primary has-[input:checked]:bg-primary/[0.06] flex cursor-pointer items-center gap-3 border p-3"
                                    >
                                        <input
                                            type="radio"
                                            name="rate"
                                            className="radio"
                                            checked={chosenRate?.rateRef === rate.rateRef}
                                            onChange={() => setChosenRate(rate)}
                                        />
                                        <span style={{ flex: 1 }}>
                                            <strong>{rate.service}</strong>
                                            {rate.estimatedDays != null ? (
                                                <span className="text-base-content"> · {rate.estimatedDays} days</span>
                                            ) : null}
                                        </span>
                                        <span>
                                            {rate.amountCents === 0
                                                ? 'Free'
                                                : formatMoney(rate.amountCents, session?.currency ?? 'USD')}
                                        </span>
                                    </label>
                                ))}
                            </fieldset>
                        ) : null}

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <Button
                                type="button"
                                color="neutral"
                                variant="ghost"
                                onClick={() => setStep('contact')}
                            >
                                ← Back
                            </Button>
                            <Button type="submit" color="primary" size="lg" style={{ flex: 1 }} disabled={busy}>
                                {busy
                                    ? 'Loading…'
                                    : rates.length === 0
                                        ? 'Get shipping rates'
                                        : 'Continue to payment'}
                            </Button>
                        </div>
                    </form>
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
                <OrderSummary
                    lines={cart.lines}
                    totals={session?.totals ?? cart.totals}
                    currency={session?.currency ?? cart.currency}
                    {...(session?.surchargeLabel ? { surchargeLabel: session.surchargeLabel } : {})}
                />
            </aside>
        </div>
    );
}

function StepIndicator({ step }: { step: CheckoutStep }) {
    const steps: { key: CheckoutStep; label: string }[] = [
        { key: 'contact', label: 'Contact' },
        { key: 'shipping', label: 'Shipping' },
        { key: 'payment', label: 'Payment' },
    ];
    const order: CheckoutStep[] = ['contact', 'shipping', 'payment', 'done'];
    const currentIdx = order.indexOf(step);
    // silica's Steps track has no per-step `state`: a step is "reached" when it
    // carries a color, so coloring every step up to and including the current one
    // paints the track's filled portion. A cleared step swaps its number for a ✓.
    return (
        <Steps className="mb-6 w-full">
            {steps.map((s) => {
                const idx = order.indexOf(s.key);
                const reached = idx <= currentIdx;
                const cleared = idx < currentIdx;
                return (
                    <Step
                        key={s.key}
                        {...(reached ? { color: 'primary' as const } : {})}
                        {...(cleared ? { 'data-content': '✓' } : {})}
                    >
                        {s.label}
                    </Step>
                );
            })}
        </Steps>
    );
}

function Confirmation({ orderNumber }: { orderNumber: string }) {
    return (
        <div
            className="text-base-content grid place-items-center gap-3 px-6 py-[clamp(3rem,8vw,6rem)] text-center"
            style={{ minHeight: '50vh' }}
        >
            <span className="text-[2.5rem] opacity-50" aria-hidden="true">
                🎉
            </span>
            <h1 className="text-base-content text-4xl font-semibold tracking-tight">Order confirmed</h1>
            <p className="text-base-content" style={{ margin: 0 }}>
                Thank you! Your order <strong>{orderNumber}</strong> has been placed. A confirmation email
                is on its way.
            </p>
            <Button render={<Link href="/products" style={{ marginTop: '0.5rem' }} />} color="primary">
                Continue shopping
            </Button>
        </div>
    );
}
