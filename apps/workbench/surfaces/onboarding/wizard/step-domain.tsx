'use client';

// Step 4 — Domain (the work pane). Two honest paths:
//   • The free `<slug>.sparx.zone` address — always available, no card, the default
//     Continue keeps. Nothing to do here.
//   • Buy a custom domain — search, pick one, and give the ICANN registrant contact.
//     Buying is DEFERRED: the choice (domain + contact + price) is captured as a
//     PendingDomain and handed up to the orchestrator, which registers and charges
//     it at Launch — so a custom domain is the one paid add-on, billed only when the
//     tenant actually goes live.
//
// The contact capture is an inline panel, not a modal: it commits to the wizard's
// own draft (the PendingDomain), and keeping it in the work pane means the app's
// unsaved-work net still sees it.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
  Loading,
  NativeSelect,
  SearchInput,
  Text,
} from '@wizeworks/silicaui-react';
import { Check, Clock, Globe, Lock, X } from 'lucide-react';
import { api } from '../../../lib/api/client';
import { ApiError } from '@sparx/api-client';
import type { OnboardingActions } from '../../../lib/onboarding/api';
import type { PendingDomain, RegistrantContact } from '../../../lib/onboarding/types';

const SITE_ZONE = 'sparx.zone';

/** One priced availability result from POST /v1/domains/search. */
interface DomainSuggestion {
  domain: string;
  tld: string;
  available: boolean;
  exact: boolean;
  displayPrice: number;
  renewalDisplayPrice: number;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function StepDomain({
  slug,
  defaultQuery,
  actions,
  selected,
  onSelect,
  onClear,
}: {
  slug: string;
  /** A sensible first search, derived from the company name. */
  defaultQuery: string;
  actions: OnboardingActions;
  /** The domain already chosen to buy (charged at Launch), or null for free. */
  selected: PendingDomain | null;
  onSelect: (domain: PendingDomain) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [suggestions, setSuggestions] = useState<DomainSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyTarget, setBuyTarget] = useState<DomainSuggestion | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);

  // The property the domain attaches to — resolved once so the captured selection
  // carries a real id (the purchase at Launch needs it).
  useEffect(() => {
    let active = true;
    void actions
      .getPrimaryProperty()
      .then((p) => {
        if (active) setPropertyId(p.id);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [actions]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setSearching(false);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    const handle = setTimeout(() => {
      void api
        .post<DomainSuggestion[]>('/v1/domains/search', { query: q })
        .then((rows) => {
          setSuggestions(rows);
          setSearching(false);
        })
        .catch((e: unknown) => {
          setSuggestions([]);
          setSearching(false);
          setError(
            e instanceof ApiError && e.status >= 400 && e.status < 500
              ? e.message
              : 'We could not search domains just now. Try again in a moment.'
          );
        });
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  // Lead with the exact match's true status, then the best available alternative,
  // then the rest — so a near-miss look-alike is never mistaken for "yours is free".
  const exact = suggestions.find((s) => s.exact);
  const exactTaken = exact && !exact.available ? exact : null;
  const others = suggestions.filter((s) => !s.exact);
  const availableOthers = others.filter((s) => s.available);
  const takenOthers = others.filter((s) => !s.available);
  const hero = exact?.available ? exact : (availableOthers[0] ?? null);
  const rest = exact?.available ? availableOthers : availableOthers.slice(1);

  // The contact panel takes over the body while a domain is being bought.
  if (buyTarget) {
    return (
      <ContactPanel
        target={buyTarget}
        propertyId={propertyId}
        onCancel={() => setBuyTarget(null)}
        onConfirm={(pending) => {
          setBuyTarget(null);
          onSelect(pending);
        }}
      />
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      {selected ? (
        <div className="border-module ring-module flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 ring-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <Globe className="text-module size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-base-content truncate font-medium">{selected.domain}</p>
              <p className="text-base-content text-sm">
                Added — you are charged {money(selected.displayPrice)} when you publish.
              </p>
            </div>
          </div>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            onClick={onClear}
            iconStart={<X className="size-3.5" aria-hidden />}
          >
            Use free address
          </Button>
        </div>
      ) : null}

      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a custom domain…"
        aria-label="Search for a custom domain"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
      />

      {searching ? (
        <div className="flex items-center gap-2">
          <Loading size="sm" />
          <span className="text-base-content text-sm">Searching…</span>
        </div>
      ) : null}

      {!searching && error ? <FieldStatus status="error">{error}</FieldStatus> : null}

      {!searching && !error && suggestions.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {exactTaken ? <TakenRow domain={exactTaken.domain} lead /> : null}
          {hero ? <DomainRow suggestion={hero} featured onBuy={() => setBuyTarget(hero)} /> : null}
          {rest.map((s) => (
            <DomainRow key={s.domain} suggestion={s} onBuy={() => setBuyTarget(s)} />
          ))}
          {takenOthers.map((s) => (
            <TakenRow key={s.domain} domain={s.domain} />
          ))}
        </div>
      ) : null}

      {!searching && !error && query.trim() && suggestions.length === 0 ? (
        <Text className="text-base-content text-sm">
          No domains found for “{query.trim()}”. Try a different name.
        </Text>
      ) : null}

      <div className="border-base-300 flex items-start gap-2.5 rounded-xl border px-4 py-3.5">
        <Clock className="text-base-content mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-base-content text-sm">
          A custom domain is the one optional paid add-on — you are charged only when you publish,
          at the Launch step, never for signing up.
        </p>
      </div>

      <div className="border-base-300 rounded-xl border border-dashed px-4 py-3.5">
        <p className="text-base-content font-medium">Happy on the free address?</p>
        <p className="text-base-content text-sm">
          Your site is live at{' '}
          <span className="text-base-content font-medium">
            {slug}.{SITE_ZONE}
          </span>{' '}
          — just hit Continue. You can add a domain anytime from Settings.
        </p>
      </div>
    </div>
  );
}

function DomainRow({
  suggestion,
  featured = false,
  onBuy,
}: {
  suggestion: DomainSuggestion;
  featured?: boolean;
  onBuy: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 ${
        featured ? 'border-module ring-module ring-1' : 'border-base-300 bg-base-100'
      }`}
    >
      <div className="min-w-0">
        <p className="text-base-content truncate font-medium">{suggestion.domain}</p>
        <span className="mt-0.5 flex items-center gap-1.5">
          <Check className="text-success size-3.5" aria-hidden />
          <span className="text-success text-sm">
            {featured ? 'Available · best match' : 'Available'}
          </span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-base-content text-sm">
            <span className="font-medium">{money(suggestion.displayPrice)}</span>/yr
          </p>
          {suggestion.renewalDisplayPrice > suggestion.displayPrice ? (
            <p className="text-base-content text-sm">
              then {money(suggestion.renewalDisplayPrice)}/yr
            </p>
          ) : null}
        </div>
        <Button
          color={featured ? 'module' : 'neutral'}
          variant={featured ? 'solid' : 'outline'}
          size="sm"
          onClick={onBuy}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function TakenRow({ domain, lead = false }: { domain: string; lead?: boolean }) {
  return (
    <div className="border-base-300 bg-base-200 flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-base-content truncate font-medium">{domain}</p>
        {lead ? (
          <p className="text-base-content mt-0.5 text-sm">
            Already registered — here are close ones you can grab.
          </p>
        ) : null}
      </div>
      <Badge color="neutral" variant="soft" size="sm">
        Taken
      </Badge>
    </div>
  );
}

// ── Registrant contact capture ────────────────────────────────────────────────
// ICANN requires a real contact to register any domain. Captured here, carried on
// the PendingDomain, and used at Launch when the purchase actually runs.

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

function ContactPanel({
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
        <Globe className="text-module size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-base-content font-medium">{target.domain}</p>
          <p className="text-base-content text-sm">
            You are not charged now — {money(total)} is billed when you publish.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel>How many years</FieldLabel>
          <NativeSelect value={String(years)} onChange={(e) => setYears(Number(e.target.value))}>
            {[1, 2, 3, 5].map((y) => (
              <option key={y} value={y}>
                {y} year{y > 1 ? 's' : ''} —{' '}
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
            <span className="text-base-content flex items-center gap-1.5 text-sm font-medium">
              <Lock className="size-3.5" aria-hidden /> Keep my details private
            </span>
            <span className="text-base-content text-sm">Hidden from the public WHOIS record.</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-base-content font-medium">Who is registering this</p>
        <p className="text-base-content text-sm">
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
          Use this domain — {money(total)} at launch
        </Button>
      </div>
    </div>
  );
}

function ContactField({
  label,
  value,
  onChange,
  error,
  type = 'text',
  maxLength,
  className,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
  type?: string;
  maxLength?: number;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <Input
            ref={inputRef}
            color={error ? 'error' : 'module'}
            type={type}
            value={value}
            onChange={onChange}
            maxLength={maxLength}
            className={className}
          />
        }
      />
      {error ? <FieldStatus status="error">{error}</FieldStatus> : null}
    </Field>
  );
}
