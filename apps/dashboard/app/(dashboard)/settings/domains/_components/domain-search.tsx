'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Plus, Search } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardTitle, Input, Loading, Skeleton } from 'silicaui-react';

import type { Property } from '@/lib/sites';
import { searchDomains, type DomainSuggestion } from '../actions';
import { PurchaseDialog } from '../purchase-dialog';
import { formatPrice } from '../_lib';

// "Find a new domain" — the search + buy section, extracted from the old
// DomainsManager. Not a list of the tenant's items (that's the inventory table
// above), so it stays a search form + result grid rather than a SelectionList.
// When checkout is disabled, search + pricing stay live and the buy action reads
// "Soon".

function SearchResults({
  suggestions,
  purchaseEnabled,
  onSelect,
}: {
  suggestions: DomainSuggestion[];
  purchaseEnabled: boolean;
  onSelect: (s: DomainSuggestion) => void;
}) {
  if (suggestions.length === 0) {
    return (
      <p className="text-base-content/70 py-2 text-sm">No suggestions found for that query.</p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {suggestions.map((s) => (
        <div
          key={s.domain}
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-4 py-3"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{s.domain}</p>
            <p className="text-base-content/70 text-sm">{formatPrice(s.displayPrice)}/yr</p>
          </div>
          {!s.available ? (
            <Badge color="neutral" variant="soft">
              Taken
            </Badge>
          ) : purchaseEnabled ? (
            <Button
              size="sm"
              color="primary"
              onClick={() => onSelect(s)}
              iconStart={<Plus className="size-3.5" />}
            >
              Buy
            </Button>
          ) : (
            <Badge color="neutral" variant="soft">
              <Clock className="size-3" /> Soon
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

export function DomainSearch({
  properties,
  purchaseEnabled,
}: {
  properties: Property[];
  purchaseEnabled: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<DomainSuggestion[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<DomainSuggestion | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = React.useCallback((value: string) => {
    setQuery(value);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setSearching(true);
        const res = await searchDomains(value.trim());
        setSearching(false);
        if (res.ok) {
          setSuggestions(res.data ?? []);
        } else {
          setSearchError(res.error ?? 'Search failed.');
        }
      })();
    }, 300);
  }, []);

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Card>
      <CardBody>
        <CardTitle>Find a new domain</CardTitle>
        <div className="flex flex-col gap-4">
          {!purchaseEnabled && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--color-bg-subtle)] px-4 py-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-[var(--color-text-secondary)]" />
              <p className="text-base-content/70 text-sm">
                <strong className="font-medium text-[var(--color-text)]">
                  Checkout opens soon.
                </strong>{' '}
                Search and pricing are live, but buying a new domain isn&apos;t open yet. In the
                meantime, connect a domain you already own from{' '}
                <Link href="/settings/sites" className="underline">
                  Sites
                </Link>
                .
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <Input
                placeholder="Search for a domain (e.g. yourbrand.com)"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="pl-9"
              />
            </div>
            {searching && <Loading className="mt-2 size-5 shrink-0" />}
          </div>

          {searchError && <p className="text-danger text-sm">{searchError}</p>}

          {searching && (
            <div className="grid gap-2 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          )}

          {!searching && suggestions !== null && (
            <SearchResults
              suggestions={suggestions}
              purchaseEnabled={purchaseEnabled}
              onSelect={(s) => setSelected(s)}
            />
          )}

          {!query && (
            <p className="text-base-content/70 text-sm">
              Already have a domain? Connect it from{' '}
              <Link href="/settings/sites" className="underline">
                Settings → Sites
              </Link>
              .
            </p>
          )}
        </div>
      </CardBody>

      <PurchaseDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        suggestion={selected}
        properties={properties}
        onSuccess={() => router.refresh()}
      />
    </Card>
  );
}
