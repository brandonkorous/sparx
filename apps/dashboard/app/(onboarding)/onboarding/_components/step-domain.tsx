'use client';

import * as React from 'react';
import { Badge, Button, cn, Heading, Input, Label, Spinner, Stack, Text } from '@sparx/ui';
import { Check } from 'lucide-react';
import type { Property } from '@/lib/sites';
import { PurchaseDialog } from '@/app/(dashboard)/settings/domains/purchase-dialog';
import { searchDomains, type DomainSuggestion } from '@/app/(dashboard)/settings/domains/actions';
import {
  checkSlugAction,
  completeDomainStepAction,
  getPrimaryPropertyAction,
  saveSlugAction,
} from '../_lib/actions';
import type { SlugAvailability } from '../_lib/types';
import type { StepNav } from './onboarding-wizard';

const STORE_ZONE = 'sparx.zone';

const REASON_COPY: Record<string, string> = {
  invalid: 'Use lowercase letters, numbers, and hyphens (3–63 characters).',
  reserved: 'That subdomain is reserved — try another.',
  taken: 'That subdomain is already taken — try another.',
};

type Mode = 'search' | 'subdomain';

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; result: SlugAvailability };

export function StepDomain({ initialSlug, nav }: { initialSlug: string; nav: StepNav }) {
  const [mode, setMode] = React.useState<Mode>('search');

  // Domain search state
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<DomainSuggestion[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [purchaseTarget, setPurchaseTarget] = React.useState<DomainSuggestion | null>(null);
  const [primaryProperty, setPrimaryProperty] = React.useState<Property | null>(null);
  const purchaseSucceededRef = React.useRef(false);

  // Subdomain picker state (fallback path)
  const [slug, setSlug] = React.useState(initialSlug);
  const [check, setCheck] = React.useState<CheckState>({ status: 'idle' });
  const [saveError, setSaveError] = React.useState<string | null>(null);

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

  // Debounced subdomain availability check.
  const normalized = slug.trim().toLowerCase();
  React.useEffect(() => {
    if (!normalized) {
      setCheck({ status: 'idle' });
      return;
    }
    setCheck({ status: 'checking' });
    const handle = setTimeout(() => {
      void checkSlugAction(normalized).then((res) => {
        if (res.ok) setCheck({ status: 'done', result: res.data });
        else setCheck({ status: 'idle' });
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [normalized]);

  const subdomainAvailable = check.status === 'done' && check.result.available;

  function onUseSubdomain() {
    if (!subdomainAvailable) return;
    setSaveError(null);
    startTransition(async () => {
      const res = await saveSlugAction(normalized);
      if (res.ok) nav.onNext();
      else setSaveError(res.error);
    });
  }

  // Called when the PurchaseDialog's onSuccess fires (purchase complete, dialog
  // still showing the success screen). We mark the flag here; actual navigation
  // happens when the user clicks "Done" (i.e. onClose fires).
  function handlePurchaseSuccess() {
    purchaseSucceededRef.current = true;
  }

  function handlePurchaseClose() {
    setPurchaseTarget(null);
    if (purchaseSucceededRef.current) {
      purchaseSucceededRef.current = false;
      startTransition(async () => {
        await completeDomainStepAction();
        nav.onNext();
      });
    }
  }

  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Heading level={3}>Set up your storefront address</Heading>
        <Text variant="muted">
          Find and register a custom domain, or start free with a .{STORE_ZONE} address. You can
          change or add domains at any time from Settings.
        </Text>
      </Stack>

      {/* Mode tabs */}
      <div className="flex gap-4 border-b border-[var(--color-border-default)]">
        {(
          [
            { key: 'search', label: 'Find a domain' },
            { key: 'subdomain', label: 'Use a free address' },
          ] as { key: Mode; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              'pb-2 text-sm font-medium transition-colors',
              mode === key
                ? 'border-b-2 border-[var(--module-active)] text-[var(--module-active)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Domain search ─────────────────────────────────────────────────────── */}
      {mode === 'search' && (
        <Stack gap={4}>
          <Stack gap={2}>
            <Label htmlFor="ob-domain-query">Search for a domain</Label>
            <Input
              id="ob-domain-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. acmemotor, besttrucks"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
            />
          </Stack>

          {searching && (
            <Stack direction="row" align="center" gap={2}>
              <Spinner size="sm" />
              <Text size="xs" variant="muted">
                Searching…
              </Text>
            </Stack>
          )}

          {!searching && suggestions.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <div
                  key={s.domain}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border-default)] px-4 py-3"
                >
                  <Stack gap={1}>
                    <Text size="sm" weight="medium">
                      {s.domain}
                    </Text>
                    <Text size="xs" variant="muted">
                      ${(s.displayPrice / 100).toFixed(2)}/yr
                    </Text>
                  </Stack>
                  {s.available ? (
                    <Button
                      size="sm"
                      color="primary"
                      variant="soft"
                      disabled={!primaryProperty || pending}
                      onClick={() => setPurchaseTarget(s)}
                    >
                      Buy
                    </Button>
                  ) : (
                    <Badge color="neutral" variant="soft">
                      Taken
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {!searching && query.trim() && suggestions.length === 0 && (
            <Text size="sm" variant="muted">
              No available domains found for &ldquo;{query}&rdquo;. Try a different name.
            </Text>
          )}
        </Stack>
      )}

      {/* ── Subdomain picker ──────────────────────────────────────────────────── */}
      {mode === 'subdomain' && (
        <Stack gap={4}>
          <Stack gap={2}>
            <Label htmlFor="ob-slug">Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="ob-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-diesel"
                className="flex-1"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
              />
              <Text variant="muted" className="whitespace-nowrap">
                .{STORE_ZONE}
              </Text>
            </div>

            {check.status === 'checking' && (
              <Stack direction="row" align="center" gap={2}>
                <Spinner size="sm" />
                <Text size="xs" variant="muted">
                  Checking availability…
                </Text>
              </Stack>
            )}
            {check.status === 'done' && check.result.available && (
              <Stack direction="row" align="center" gap={1}>
                <Check className="h-4 w-4 text-[var(--color-success-text)]" />
                <Text size="xs" className="text-[var(--color-success-text)]">
                  {normalized}.{STORE_ZONE} is available
                </Text>
              </Stack>
            )}
            {check.status === 'done' && !check.result.available && (
              <Stack gap={1}>
                <Text size="xs" variant="danger">
                  {REASON_COPY[check.result.reason] ?? 'That subdomain is unavailable.'}
                </Text>
                {check.result.suggestions.length > 0 && (
                  <Stack direction="row" align="center" gap={2} className="flex-wrap">
                    <Text size="xs" variant="muted">
                      Try:
                    </Text>
                    {check.result.suggestions.map((s) => (
                      <Button
                        key={s}
                        color="primary"
                        variant="link"
                        size="sm"
                        onClick={() => setSlug(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>

          {saveError && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite">
              {saveError}
            </Text>
          )}
        </Stack>
      )}

      {/* ── Purchase dialog ───────────────────────────────────────────────────── */}
      {primaryProperty && (
        <PurchaseDialog
          open={purchaseTarget !== null}
          onClose={handlePurchaseClose}
          suggestion={purchaseTarget}
          properties={[primaryProperty]}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      {/* ── Nav bar ───────────────────────────────────────────────────────────── */}
      <Stack direction="row" justify="between">
        <Button variant="ghost" onClick={nav.onBack} disabled={pending || nav.navPending}>
          Back
        </Button>
        <Stack direction="row" gap={2}>
          <Button variant="ghost" onClick={nav.onSkip} disabled={pending || nav.navPending}>
            Skip for now
          </Button>
          {mode === 'subdomain' && (
            <Button
              color="module"
              onClick={onUseSubdomain}
              disabled={pending || !subdomainAvailable}
              loading={pending}
            >
              Use this address
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
