'use client';

import * as React from 'react';
import { Badge, Button, Input, Spinner, Text, cn } from '@sparx/ui';
import { Check, Clock, Globe, Search, X } from 'lucide-react';
import type { Property } from '@/lib/sites';
import {
  PurchaseDialog,
  type DomainSelection,
} from '@/app/(dashboard)/settings/domains/purchase-dialog';
import { searchDomains, type DomainSuggestion } from '@/app/(dashboard)/settings/domains/actions';
import { getPrimaryPropertyAction } from '../_lib/actions';

const STORE_ZONE = 'sparx.zone';

// Step 4 — Domain (work pane). Search-led, best match highlighted. Buying a domain
// is DEFERRED: a custom domain is a paid registration, so the choice is captured
// here (with the ICANN contact + price) and only charged at the Launch step — the
// free `<slug>.sparx.zone` address is always the no-card default. When checkout
// isn't open yet (`purchaseEnabled` false) the results stay informational (price +
// "soon") and the only live paths are the free address or connecting a domain you
// already own.
export function StepDomain({
  slug,
  defaultQuery,
  purchaseEnabled,
  selectedHost,
  onSelect,
  onClearSelection,
}: {
  slug: string;
  defaultQuery: string;
  purchaseEnabled: boolean;
  selectedHost: string | null;
  onSelect: (selection: DomainSelection) => void;
  onClearSelection: () => void;
}) {
  const [query, setQuery] = React.useState(defaultQuery);
  const [suggestions, setSuggestions] = React.useState<DomainSuggestion[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [purchaseTarget, setPurchaseTarget] = React.useState<DomainSuggestion | null>(null);
  const [primaryProperty, setPrimaryProperty] = React.useState<Property | null>(null);

  React.useEffect(() => {
    void getPrimaryPropertyAction().then((res) => {
      if (res.ok && res.data) setPrimaryProperty(res.data);
    });
  }, []);

  React.useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setSearching(false);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    const handle = setTimeout(() => {
      void searchDomains(query.trim()).then((res) => {
        setSearching(false);
        if (res.ok) {
          setSuggestions(res.data ?? []);
        } else {
          setSuggestions([]);
          setError(res.error ?? 'Search failed.');
        }
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  // The exact domain the query implies leads the list. If it's available it's the
  // hero; if it's taken we say so plainly (so a near-miss look-alike never reads as
  // "your domain is free") and feature the best available alternative instead.
  const exact = suggestions.find((s) => s.exact);
  const exactTaken = exact && !exact.available ? exact : null;
  const others = suggestions.filter((s) => !s.exact);
  const availableOthers = others.filter((s) => s.available);
  const takenOthers = others.filter((s) => !s.available);
  const hero: DomainSuggestion | null = exact?.available ? exact : (availableOthers[0] ?? null);
  const restAvailable = exact?.available ? availableOthers : availableOthers.slice(1);

  const canAdd = purchaseEnabled && primaryProperty != null;

  return (
    <div className="max-w-xl">
      {/* A domain is already chosen — billed at Launch, not now. Let them drop it. */}
      {selectedHost && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-[var(--module-active)] bg-[var(--module-active-tint)] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Globe className="h-4 w-4 shrink-0 text-[var(--module-active)]" />
            <div className="min-w-0">
              <Text weight="medium" className="truncate">
                {selectedHost}
              </Text>
              <Text size="xs" variant="muted">
                Added — you&apos;ll be charged when you publish.
              </Text>
            </div>
          </div>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            leftIcon={<X className="h-3.5 w-3.5" />}
          >
            Use free address
          </Button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for your domain…"
          className="pl-9"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search for a domain"
        />
      </div>

      {searching && (
        <div className="mt-4 flex items-center gap-2">
          <Spinner size="sm" />
          <Text size="xs" variant="muted">
            Searching…
          </Text>
        </div>
      )}

      {!searching && suggestions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5">
          {exactTaken && <ExactTakenRow domain={exactTaken.domain} />}
          {hero && (
            <DomainRow
              suggestion={hero}
              featured
              comingSoon={!purchaseEnabled}
              disabled={!canAdd}
              onBuy={() => setPurchaseTarget(hero)}
            />
          )}
          {restAvailable.map((s) => (
            <DomainRow
              key={s.domain}
              suggestion={s}
              comingSoon={!purchaseEnabled}
              disabled={!canAdd}
              onBuy={() => setPurchaseTarget(s)}
            />
          ))}
          {takenOthers.map((s) => (
            <DomainRow key={s.domain} suggestion={s} disabled onBuy={() => undefined} />
          ))}
        </div>
      )}

      {!searching && error && (
        <Text size="sm" variant="danger" className="mt-4 block" role="alert" aria-live="polite">
          {error}
        </Text>
      )}

      {!searching && !error && query.trim() && suggestions.length === 0 && (
        <Text size="sm" variant="muted" className="mt-4 block">
          No domains found for &ldquo;{query}&rdquo;. Try a different name.
        </Text>
      )}

      {/* Paid-add-on disclosure — distinct copy for "checkout open" vs "soon". */}
      {purchaseEnabled ? (
        <div className="mt-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3.5">
          <Text size="xs" variant="muted">
            A custom domain is a paid registration — you&apos;ll be charged when you publish at the
            Launch step, not now. It&apos;s the one optional add-on with a cost; signing up and your
            free address are always free.
          </Text>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
          <Text size="xs" variant="muted">
            Custom domains are a paid registration and{' '}
            <span className="font-medium text-[var(--color-text-secondary)]">
              checkout opens soon
            </span>
            . For now, launch on your free address — or connect a domain you already own from
            Settings. You&apos;re never charged to sign up.
          </Text>
        </div>
      )}

      {/* Free-address note — "Continue" (in the setup card) keeps this address. */}
      <div className="mt-3 rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] px-4 py-3.5">
        <Text size="sm" weight="medium">
          Happy on the free address?
        </Text>
        <Text size="xs" variant="muted">
          Your site is live at{' '}
          <span className="font-medium text-[var(--color-text-secondary)]">
            {slug}.{STORE_ZONE}
          </span>{' '}
          — just hit Continue. You can add a domain anytime from Settings.
        </Text>
      </div>

      {purchaseEnabled && primaryProperty && (
        <PurchaseDialog
          open={purchaseTarget !== null}
          onClose={() => setPurchaseTarget(null)}
          suggestion={purchaseTarget}
          properties={[primaryProperty]}
          mode="select"
          onSelect={(selection) => {
            setPurchaseTarget(null);
            onSelect(selection);
          }}
        />
      )}
    </div>
  );
}

function DomainRow({
  suggestion,
  featured = false,
  comingSoon = false,
  disabled,
  onBuy,
}: {
  suggestion: DomainSuggestion;
  featured?: boolean;
  comingSoon?: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5',
        featured
          ? 'border-[var(--module-active)] bg-[var(--module-active-tint)] ring-1 ring-[var(--module-active)]'
          : 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)]'
      )}
    >
      <div className="min-w-0">
        <Text weight="medium" className="truncate">
          {suggestion.domain}
        </Text>
        {suggestion.available ? (
          <span className="mt-0.5 flex items-center gap-1.5">
            <Check className="h-3 w-3 text-[var(--color-success-text)]" />
            <Text size="xs" className="text-[var(--color-success-text)]">
              {featured ? 'Available · best match' : 'Available'}
            </Text>
          </span>
        ) : (
          <Badge color="neutral" variant="soft" size="sm" className="mt-1">
            Taken
          </Badge>
        )}
      </div>
      {suggestion.available && (
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <Text size="sm" variant="muted">
              <span className="font-medium text-[var(--color-text-primary)]">
                ${(suggestion.displayPrice / 100).toFixed(2)}
              </span>
              /yr
            </Text>
            {suggestion.renewalDisplayPrice > suggestion.displayPrice && (
              <Text size="xs" variant="muted">
                then ${(suggestion.renewalDisplayPrice / 100).toFixed(2)}/yr
              </Text>
            )}
          </div>
          {comingSoon ? (
            <Badge color="neutral" variant="soft" size="sm">
              <Clock className="h-3 w-3" /> Soon
            </Badge>
          ) : (
            <Button
              color={featured ? 'module' : 'neutral'}
              variant={featured ? 'solid' : 'outline'}
              size="sm"
              onClick={onBuy}
              disabled={disabled}
            >
              Add
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// The exact domain the tenant searched, when it's already registered. Shown first
// so a near-miss look-alike below is never mistaken for "your domain is available."
function ExactTakenRow({ domain }: { domain: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-3.5">
      <div className="min-w-0">
        <Text weight="medium" className="truncate">
          {domain}
        </Text>
        <Text size="xs" variant="muted" className="mt-0.5">
          Already registered — here are close ones you can grab.
        </Text>
      </div>
      <Badge color="neutral" variant="soft" size="sm">
        Taken
      </Badge>
    </div>
  );
}
