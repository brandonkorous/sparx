'use client';

// Registrant contact capture. ICANN requires a real contact to register any
// domain. Captured here, carried on the PendingDomain, and used at Launch when the
// purchase actually runs.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Field, FieldLabel, NativeSelect } from '@wizeworks/silicaui-react';
import { faGlobe, faLock } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { PendingDomain, RegistrantContact } from '../../../lib/onboarding/types';
import { type DomainSuggestion, money } from './domain-shared';
import { ContactField } from './domain-contact-field';

const EMPTY_CONTACT: RegistrantContact = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

const REQUIRED_FIELDS: (keyof RegistrantContact)[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'address1',
  'city',
  'state',
  'postalCode',
  'country',
];

export function ContactPanel({
  target,
  propertyId,
  onCancel,
  onConfirm,
}: {
  target: DomainSuggestion;
  propertyId: string | null;
  onCancel: () => void;
  onConfirm: (pending: PendingDomain) => void;
}) {
  const [contact, setContact] = useState<RegistrantContact>(EMPTY_CONTACT);
  const [years, setYears] = useState(1);
  const [privacy, setPrivacy] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const set = (key: keyof RegistrantContact) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setContact((c) => ({ ...c, [key]: e.target.value }));

  const missing = useMemo(() => {
    const out = new Set<keyof RegistrantContact>();
    for (const k of REQUIRED_FIELDS) if (contact[k]?.trim().length === 0) out.add(k);
    if (contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) out.add('email');
    if (contact.country.trim().length > 0 && contact.country.trim().length !== 2)
      out.add('country');
    return out;
  }, [contact]);

  const total = target.displayPrice + target.renewalDisplayPrice * (years - 1);

  function err(key: keyof RegistrantContact): string | null {
    if (!showErrors || !missing.has(key)) return null;
    if (key === 'email' && contact.email.trim().length > 0) return 'Enter a valid email.';
    if (key === 'country') return 'Use the 2-letter country code.';
    return 'Required.';
  }

  function submit() {
    if (missing.size > 0 || !propertyId) {
      setShowErrors(true);
      return;
    }
    onConfirm({
      domain: target.domain,
      displayPrice: target.displayPrice,
      renewalDisplayPrice: target.renewalDisplayPrice,
      years,
      privacy,
      propertyId,
      contact: {
        ...contact,
        address2: contact.address2?.trim() ? contact.address2.trim() : undefined,
        country: contact.country.trim().toUpperCase(),
      },
    });
  }

  return (
    <div className="border-base-300 bg-base-100 flex max-w-xl flex-col gap-5 rounded-xl border p-6">
      <div className="flex items-center gap-2.5">
        <Icon glyph={faGlobe} className="text-module size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium">{target.domain}</p>
          <p className="text-sm">
            You are not charged now: {money(total)} is billed when you publish.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>How many years</FieldLabel>
          <NativeSelect value={String(years)} onChange={(e) => setYears(Number(e.target.value))}>
            {[1, 2, 3, 5].map((y) => (
              <option key={y} value={y}>
                {y} year{y > 1 ? 's' : ''}:{' '}
                {money(target.displayPrice + target.renewalDisplayPrice * (y - 1))}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex items-start gap-2.5 pt-6">
          <Checkbox
            color="module"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            id="wp-privacy"
          />
          <label htmlFor="wp-privacy" className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Icon glyph={faLock} className="size-3.5" aria-hidden /> Keep my details private
            </span>
            <span className="text-sm">Hidden from the public WHOIS record.</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-medium">Who is registering this</p>
        <p className="text-sm">
          The domain authorities require a real contact for every registration.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <ContactField
            label="First name"
            value={contact.firstName}
            onChange={set('firstName')}
            error={err('firstName')}
            inputRef={firstFieldRef}
          />
          <ContactField
            label="Last name"
            value={contact.lastName}
            onChange={set('lastName')}
            error={err('lastName')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ContactField
            label="Email"
            type="email"
            value={contact.email}
            onChange={set('email')}
            error={err('email')}
          />
          <ContactField
            label="Phone"
            type="tel"
            value={contact.phone}
            onChange={set('phone')}
            error={err('phone')}
          />
        </div>
        <ContactField
          label="Address"
          value={contact.address1}
          onChange={set('address1')}
          error={err('address1')}
        />
        <ContactField
          label="Address line 2 (optional)"
          value={contact.address2 ?? ''}
          onChange={set('address2')}
          error={null}
        />
        <div className="grid grid-cols-3 gap-3">
          <ContactField
            label="City"
            value={contact.city}
            onChange={set('city')}
            error={err('city')}
          />
          <ContactField
            label="State / region"
            value={contact.state}
            onChange={set('state')}
            error={err('state')}
          />
          <ContactField
            label="Postal code"
            value={contact.postalCode}
            onChange={set('postalCode')}
            error={err('postalCode')}
          />
        </div>
        <ContactField
          label="Country (2-letter code)"
          value={contact.country}
          onChange={set('country')}
          error={err('country')}
          maxLength={2}
          className="uppercase"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" color="neutral" onClick={onCancel}>
          Back
        </Button>
        <Button color="module" className="flex-1" onClick={submit} disabled={propertyId === null}>
          Use this domain: {money(total)} at launch
        </Button>
      </div>
    </div>
  );
}
