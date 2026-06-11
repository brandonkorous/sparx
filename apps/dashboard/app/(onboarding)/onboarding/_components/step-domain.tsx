'use client';

import * as React from 'react';
import { Badge, Button, Input, Spinner, Text, WizardStep, cn } from '@sparx/ui';
import { ArrowRight, Check, Search } from 'lucide-react';
import type { Property } from '@/lib/sites';
import { PurchaseDialog } from '@/app/(dashboard)/settings/domains/purchase-dialog';
import { searchDomains, type DomainSuggestion } from '@/app/(dashboard)/settings/domains/actions';
import { completeDomainStepAction, getPrimaryPropertyAction } from '../_lib/actions';
import type { StepNav } from './onboarding-wizard';

const STORE_ZONE = 'sparx.zone';

// Step 4 — Domain. The featured upsell, never minimized: a custom domain builds
// trust and is the tenant's to keep. Search-led, best match highlighted, buy in
// place. The free `<slug>.sparx.zone` address is always there as the no-cost
// fallback. The storefront subdomain itself was set in the Workspace step — this
// step is purely about claiming a real domain.
export function StepDomain({
  slug,
  defaultQuery,
  nav,
}: {
  slug: string;
  defaultQuery: string;
  nav: StepNav;
}) {
  const [query, setQuery] = React.useState(defaultQuery);
  const [suggestions, setSuggestions] = React.useState<DomainSuggestion[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [purchaseTarget, setPurchaseTarget] = React.useState<DomainSuggestion | null>(null);
  const [primaryProperty, setPrimaryProperty] = React.useState<Property | null>(null);
  const purchaseSucceededRef = React.useRef(false);
  const [pending, startTransition] = React.useTransition();

  // Load primary property once so the PurchaseDialog has a pre-filled propertyId.
  React.useEffect(() => {
    void getPrimaryPropertyAction().then((res) => {
      if (res.ok && res.data) setPrimaryProperty(res.data);
    });
  }, []);

  // Debounced domain search.
  React.useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      void searchDomains(query.trim()).then((res) => {
        setSearching(false);
        if (res.ok) setSuggestions(res.data ?? []);
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  function advance() {
    startTransition(async () => {
      await completeDomainStepAction(nav.nextKey);
      nav.onNext();
    });
  }

  function handlePurchaseSuccess() {
    purchaseSucceededRef.current = true;
  }

  function handlePurchaseClose() {
    setPurchaseTarget(null);
    if (purchaseSucceededRef.current) {
      purchaseSucceededRef.current = false;
      advance();
    }
  }

  // First available result is the "best match"; the rest are alternatives.
  const available = suggestions.filter((s) => s.available);
  const taken = suggestions.filter((s) => !s.available);
  const [featured, ...alternatives] = available;

  return (
    <WizardStep
      width="default"
      header={{
        title: 'Make it yours',
        supporting:
          "A custom domain builds trust — and it's yours to keep. Grab the perfect one now, or start free on your .sparx.zone address and add a domain anytime.",
      }}
      actions={{ onBack: nav.onBack }}
    >
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
                disabled={!primaryProperty || pending}
                onBuy={() => setPurchaseTarget(featured)}
              />
            )}
            {alternatives.map((s) => (
              <DomainRow
                key={s.domain}
                suggestion={s}
                disabled={!primaryProperty || pending}
                onBuy={() => setPurchaseTarget(s)}
              />
            ))}
            {taken.map((s) => (
              <DomainRow key={s.domain} suggestion={s} disabled onBuy={() => undefined} />
            ))}
          </div>
        )}

        {!searching && query.trim() && suggestions.length === 0 && (
          <Text size="sm" variant="muted" className="mt-4 block">
            No domains found for &ldquo;{query}&rdquo;. Try a different name.
          </Text>
        )}

        {/* ── Free-address fallback ───────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] px-4 py-3.5">
          <div>
            <Text size="sm" weight="medium">
              Start free for now
            </Text>
            <Text size="xs" variant="muted">
              Your site is live at{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">
                {slug}.{STORE_ZONE}
              </span>{' '}
              — add a domain anytime from Settings.
            </Text>
          </div>
          <Button
            variant="ghost"
            color="neutral"
            onClick={advance}
            disabled={pending}
            loading={pending}
            rightIcon={pending ? undefined : <ArrowRight className="h-4 w-4" />}
          >
            Use free address
          </Button>
        </div>
      </div>

      {primaryProperty && (
        <PurchaseDialog
          open={purchaseTarget !== null}
          onClose={handlePurchaseClose}
          suggestion={purchaseTarget}
          properties={[primaryProperty]}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </WizardStep>
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
          <Text size="sm" variant="muted">
            <span className="font-medium text-[var(--color-text-primary)]">
              ${(suggestion.displayPrice / 100).toFixed(2)}
            </span>
            /yr
          </Text>
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
