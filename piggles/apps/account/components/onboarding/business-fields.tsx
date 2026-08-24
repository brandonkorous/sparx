'use client';

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import type { TradeOption } from '@/lib/trade-options';
import { AddressField } from './address-field';

// The business itself — what it is called, where it lives, and what it does for
// a living.
//
// Three fields, one question: they all describe the same thing, and splitting
// them into separate beats would make a two-question screen claim to be four.
// The address sits directly under the name because the name is what fills it in.

export function BusinessFields({
  name,
  onName,
  address,
  onAddress,
  addressError,
  trade,
  onTrade,
  trades,
}: {
  name: string;
  onName: (value: string) => void;
  address: string;
  onAddress: (value: string) => void;
  /** The server's verdict on the last attempt, when it was about this field. */
  addressError: string | null;
  trade: string;
  onTrade: (value: string) => void;
  /** Read from the packs on the server, so a trade the platform can furnish is
   *  never missing from the list somebody picks from (issue #001). */
  trades: TradeOption[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel>What is your business called?</FieldLabel>
        <FieldControl
          render={<Input size="lg" />}
          name="businessName"
          value={name}
          onChange={(e) => onName(e.target.value)}
          required
          maxLength={120}
        />
      </Field>

      <AddressField value={address} onChange={onAddress} submitError={addressError} />

      <Field>
        <FieldLabel>What kind of business is it?</FieldLabel>
        {/* `NativeSelect` is a plain <select> and registers with the Field
            context no more than a bare <Input> does — checked on the screen,
            where its label came back an orphan. It goes through FieldControl
            too. Issue #006. */}
        <FieldControl
          render={<NativeSelect size="lg" />}
          name="industry"
          value={trade}
          onChange={(e) => onTrade(e.target.value)}
          required
        >
          <option value="" disabled>
            Pick the closest one
          </option>
          {trades.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </FieldControl>
        <FieldDescription>
          We use this to fill your account with realistic examples — products, customers, bookings
          and pages — so nothing is empty when you walk in. Change or clear them whenever you like.
        </FieldDescription>
      </Field>
    </div>
  );
}
