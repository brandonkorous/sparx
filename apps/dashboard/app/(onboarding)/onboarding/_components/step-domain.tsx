'use client';

import * as React from 'react';
import { Badge, Button, Input, Spinner, Text, cn } from '@sparx/ui';
import { Check, Search } from 'lucide-react';
import type { Property } from '@/lib/sites';
import { PurchaseDialog } from '@/app/(dashboard)/settings/domains/purchase-dialog';
import { searchDomains, type DomainSuggestion } from '@/app/(dashboard)/settings/domains/actions';
import { getPrimaryPropertyAction } from '../_lib/actions';

const STORE_ZONE = 'sparx.zone';

// Step 4 — Domain (work pane). The featured upsell, never minimized: search-led,
// best match highlighted, buy in place. The free `<slug>.sparx.zone` fallback is
// the card's default Continue, so this body is just the search + results; buying a
// domain reports up (`onPurchased`) and the orchestrator advances.
export function StepDomain({
  slug,
  defaultQuery,
  onPurchased,
}: {
  slug: string;
  defaultQuery: string;
  onPurchased: (host: string) => void;
}) {
  const [query, setQuery] = React.useState(defaultQuery);
  const [suggestions, setSuggestions] = React.useState<DomainSuggestion[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [purchaseTarget, setPurchaseTarget] = React.useState<DomainSuggestion | null>(null);
  const [primaryProperty, setPrimaryProperty] = React.useState<Property | null>(null);
  const purchasedHostRef = React.useRef<string | null>(null);

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

  function handlePurchaseClose() {
    const host = purchasedHostRef.current;
    setPurchaseTarget(null);
    if (host) {
      purchasedHostRef.current = null;
      onPurchased(host);
    }
  }

  const available = suggestions.filter((s) => s.available);
  const taken = suggestions.filter((s) => !s.available);
  const [featured, ...alternatives] = available;

  return (
    <div className="max-w-xl">
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
          {featured && (
            <DomainRow
              suggestion={featured}
              featured
              disabled={!primaryProperty}
              onBuy={() => setPurchaseTarget(featured)}
            />
          )}
          {alternatives.map((s) => (
            <DomainRow
              key={s.domain}
              suggestion={s}
              disabled={!primaryProperty}
              onBuy={() => setPurchaseTarget(s)}
            />
          ))}
          {taken.map((s) => (
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

      {/* Free-address note — "Continue" (in the setup card) keeps this address. */}
      <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] px-4 py-3.5">
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

      {primaryProperty && (
        <PurchaseDialog
          open={purchaseTarget !== null}
          onClose={handlePurchaseClose}
          suggestion={purchaseTarget}
          properties={[primaryProperty]}
          onSuccess={() => {
            purchasedHostRef.current = purchaseTarget?.domain ?? null;
          }}
        />
      )}
    </div>
  );
}

function DomainRow({
  suggestion,
  featured = false,
  disabled,
  onBuy,
}: {
  suggestion: DomainSuggestion;
  featured?: boolean;
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
          <Button
            color={featured ? 'module' : 'neutral'}
            variant={featured ? 'solid' : 'outline'}
            size="sm"
            onClick={onBuy}
            disabled={disabled}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
