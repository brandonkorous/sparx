'use client';

// DELIVERY — where the order is going, and how it gets there.
//
// This is the step as it always was, plus the two things issue 064 asked for
// once the shop actually delivers: a shopper who has already saved an address
// picks it instead of typing it, and a shopper typing a new one is offered the
// chance to keep it.

import { Button } from '@wizeworks/silicaui-react';

import type { Address as BookAddress } from '@/lib/customer-client';
import type { Address, ShippingRate } from '@/lib/checkout-client';
import { AddressForm } from './address-form';
import { RateChoices } from './rate-choices';
import { SavedAddressChoices } from './saved-addresses';

export interface DeliveryStepProps {
  /** The shopper's saved addresses. Empty for a guest, and for anyone who has
   *  never saved one. */
  book: BookAddress[];
  /** Null = "somewhere else", i.e. the form below is the answer. */
  savedId: string | null;
  onPickSaved: (id: string | null) => void;
  /** Set when the shop also hands orders over in person: a way to collect
   *  instead, before any address is asked for (sparx persona issue 129). */
  onCollectInstead?: () => void;
  /** Who is buying. Used for a saved address that carries no recipient name. */
  contactName: string;
  address: Address;
  onAddressChange: (next: Address) => void;
  /** Only offered to a signed-in shopper: there is nowhere to save it to
   *  otherwise, and an offer that quietly does nothing is worse than none. */
  canSave: boolean;
  save: boolean;
  onSaveChange: (next: boolean) => void;
  rates: ShippingRate[];
  chosen: ShippingRate | null;
  onChoose: (rate: ShippingRate) => void;
  currency: string;
  quoted: boolean;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  /** Anything the buyer wants the shop to know about this order. */
  note: string;
  onNoteChange: (next: string) => void;
}

export function DeliveryStep(props: DeliveryStepProps) {
  const { book, savedId, address, rates, chosen, quoted, busy } = props;
  const typing = savedId === null;

  return (
    <form onSubmit={props.onSubmit} className="flex max-w-[560px] flex-col gap-4">
      <h2 className="text-base-content text-3xl font-semibold tracking-tight">
        Where should we send it?
      </h2>

      {props.onCollectInstead ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={props.onCollectInstead}
        >
          Rather pick it up? Collect it from us, free
        </Button>
      ) : null}

      {book.length > 0 ? (
        <SavedAddressChoices
          addresses={book}
          selectedId={savedId}
          onSelect={props.onPickSaved}
          fallbackName={props.contactName}
        />
      ) : null}

      {typing ? (
        <>
          <AddressForm value={address} onChange={props.onAddressChange} />
          {props.canSave ? (
            <label className="text-base-content flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={props.save}
                onChange={(e) => props.onSaveChange(e.target.checked)}
              />
              Keep this address on my account, so I don&rsquo;t type it again
            </label>
          ) : null}
        </>
      ) : null}

      <RateChoices
        rates={rates}
        chosen={chosen}
        onChoose={props.onChoose}
        currency={props.currency}
        legend="How you’ll get your order"
      />

      {/* The one thing on this screen only the buyer can answer. It reaches the
          shop as the order's own note, and it is stored on the session the moment
          this step is submitted, so a gateway that navigates this tab away cannot
          swallow it (issue 874). */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="checkout-note" className="text-base-content font-medium">
          Anything we should know? (optional)
        </label>
        <textarea
          id="checkout-note"
          className="textarea w-full"
          rows={3}
          maxLength={2000}
          value={props.note}
          placeholder="Where to leave it, a gift message, anything else."
          onChange={(e) => {
            props.onNoteChange(e.target.value);
          }}
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={props.onBack}>
          ← Back
        </Button>
        <Button type="submit" color="primary" size="lg" className="flex-1" disabled={busy}>
          {busy ? 'Loading…' : quoted ? 'Continue to payment' : 'See your options'}
        </Button>
      </div>
    </form>
  );
}
