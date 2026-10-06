'use client';

// Step 4 — Domain (the work pane). Two honest paths:
//   • The free `<slug>.piggles.site` address — always available, no card, the default
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

import { useEffect, useState } from 'react';
import { Button, FieldStatus, Loading, SearchInput, Text } from '@wizeworks/silicaui-react';
import { faClock, faGlobe, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ApiError } from '@wizeworks/api-client';
import type { OnboardingActions } from '../../../lib/onboarding/api';
import type { PendingDomain } from '../../../lib/onboarding/types';
import { api } from '../../../lib/api/client';
import { PRODUCT } from '@piggles/config';
import { money, type DomainSuggestion } from './domain-shared';
import { DomainRow, TakenRow } from './domain-rows';
import { ContactPanel } from './domain-contact';

// The tenant-site suffix comes from the brand, never a literal. It was
// hardcoded to sparx.zone — another product's domain, offered to a Piggles
// customer as their own web address. Issue #009.
const SITE_ZONE = PRODUCT.tenantSites.suffix;

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
            <Icon glyph={faGlobe} className="text-module size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="truncate font-medium">{selected.domain}</p>
              <p className="text-sm">
                Added. You are charged {money(selected.displayPrice)} when you publish.
              </p>
            </div>
          </div>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            onClick={onClear}
            iconStart={<Icon glyph={faXmark} className="size-3.5" aria-hidden />}
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
          <span className="text-sm">Searching…</span>
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
        <Text className="text-sm">
          No domains found for “{query.trim()}”. Try a different name.
        </Text>
      ) : null}

      <div className="border-base-300 flex items-start gap-2.5 rounded-xl border px-4 py-3.5">
        <Icon glyph={faClock} className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-sm">
          A custom domain is the one optional paid add-on. You are charged only when you publish, at
          the Launch step, never for signing up.
        </p>
      </div>

      <div className="border-base-300 rounded-xl border border-dashed px-4 py-3.5">
        <p className="font-medium">Happy on the free address?</p>
        <p className="text-sm">
          Your site replaces the simple starter page at{' '}
          <span className="font-medium">
            {slug}.{SITE_ZONE}
          </span>{' '}
          when you launch. Just press Continue. Already own a domain, or want one later? Buy or
          connect it anytime from Domains, under Your business.
        </p>
      </div>
    </div>
  );
}
