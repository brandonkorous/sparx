'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandPalette as UICommandPalette,
  CommandShortcut,
} from '@sparx/ui';
import { findFavoritableById, listFavoritableItems } from '../_shell/registry';
import type { FavoriteRow, RecentRow } from '../_shell/service';
import { searchEntities, type PaletteResults } from './search-action';

// ⌘K palette. Two layers:
//   • Quick Mode (default / short query): manifest-driven nav — Favorites,
//     Recents, Everything.
//   • Deep Mode: once the query is long enough, a debounced server call hits
//     the Typesense-backed /v1/search palette and shows matching products,
//     customers, and orders ABOVE the nav groups. Selecting any item
//     navigates to its detail route.
//
// We own filtering (cmdk's shouldFilter is off) because the server results are
// typo-tolerant — "boach" should keep "Bosch Injector", which cmdk's fuzzy
// match would discard. Nav items are filtered here with a simple substring.

interface CommandPaletteProps {
  favorites: FavoriteRow[];
  recents: RecentRow[];
}

const EMPTY_RESULTS: PaletteResults = { products: [], customers: [], orders: [], other: [] };
const MIN_DEEP_QUERY = 2;
const DEBOUNCE_MS = 200;

export function CommandPalette({ favorites, recents }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<PaletteResults>(EMPTY_RESULTS);
  const [loading, setLoading] = React.useState(false);

  // Let non-keyboard surfaces (the rail/mobile-nav Search affordance) open the
  // palette without re-implementing the ⌘K shortcut.
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('sparx:open-command-palette', handler);
    return () => window.removeEventListener('sparx:open-command-palette', handler);
  }, []);

  // Reset transient state when the palette closes so the next open is clean.
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(EMPTY_RESULTS);
      setLoading(false);
    }
  }, [open]);

  // Debounced deep search. A request token guards against out-of-order
  // responses (a slow early query resolving after a faster later one).
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_DEEP_QUERY) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    let active = true;
    const handle = setTimeout(() => {
      void searchEntities(q)
        .then((r) => {
          if (active) {
            setResults(r);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setResults(EMPTY_RESULTS);
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  const all = listFavoritableItems();

  const favoritedItems = favorites
    .map((f) => findFavoritableById(f.actionId))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const recentItems = recents
    .map((r) => findFavoritableById(r.actionId))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .filter((item) => !favoritedItems.some((f) => f.id === item.id))
    .slice(0, 5);

  // We own filtering now (cmdk shouldFilter=false). Apply a substring match to
  // nav items so Quick Mode still narrows as you type.
  const needle = query.trim().toLowerCase();
  const matchesNeedle = (label: string, extra: string) =>
    needle.length === 0 || `${label} ${extra}`.toLowerCase().includes(needle);

  const everythingElse = all
    .filter((item) => !favoritedItems.some((f) => f.id === item.id))
    .filter((item) => !recentItems.some((r) => r.id === item.id))
    .filter((item) => matchesNeedle(item.label, `${item.moduleId} ${item.kind}`));

  const visibleFavorites = favoritedItems.filter((i) => matchesNeedle(i.label, i.moduleId));
  const visibleRecents = recentItems.filter((i) => matchesNeedle(i.label, i.moduleId));

  const resultCount =
    results.products.length +
    results.customers.length +
    results.orders.length +
    results.other.length;
  const hasResults = resultCount > 0;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <UICommandPalette
      open={open}
      onOpenChange={setOpen}
      placeholder="Search products, customers, orders…"
      search={query}
      onSearchChange={setQuery}
      shouldFilter={false}
    >
      <CommandList>
        <CommandEmpty>{loading ? 'Searching…' : 'No matches.'}</CommandEmpty>

        {results.products.length > 0 && (
          <CommandGroup heading="Products">
            {results.products.map((hit) => (
              <CommandItem key={hit.id} value={`product-${hit.id}`} onSelect={() => go(hit.href)}>
                <span>{hit.label}</span>
                {hit.sublabel ? <CommandShortcut>{hit.sublabel}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.customers.length > 0 && (
          <CommandGroup heading="Customers">
            {results.customers.map((hit) => (
              <CommandItem key={hit.id} value={`customer-${hit.id}`} onSelect={() => go(hit.href)}>
                <span>{hit.label}</span>
                {hit.sublabel ? <CommandShortcut>{hit.sublabel}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.orders.length > 0 && (
          <CommandGroup heading="Orders">
            {results.orders.map((hit) => (
              <CommandItem key={hit.id} value={`order-${hit.id}`} onSelect={() => go(hit.href)}>
                <span>{hit.label}</span>
                {hit.sublabel ? <CommandShortcut>{hit.sublabel}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.other.length > 0 && (
          <CommandGroup heading="More">
            {results.other.map((hit) => (
              <CommandItem key={hit.id} value={`other-${hit.id}`} onSelect={() => go(hit.href)}>
                <span>{hit.label}</span>
                {hit.sublabel ? <CommandShortcut>{hit.sublabel}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {visibleFavorites.length > 0 && (
          <CommandGroup heading="Favorites">
            {visibleFavorites.map((item) => (
              <CommandItem key={item.id} value={`fav-${item.id}`} onSelect={() => go(item.href)}>
                <ItemIcon icon={item.icon} />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {visibleRecents.length > 0 && (
          <CommandGroup heading="Recents">
            {visibleRecents.map((item) => (
              <CommandItem key={item.id} value={`recent-${item.id}`} onSelect={() => go(item.href)}>
                <ItemIcon icon={item.icon} />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {everythingElse.length > 0 && (
          <CommandGroup heading={hasResults ? 'Go to' : 'Everything'}>
            {everythingElse.map((item) => (
              <CommandItem key={item.id} value={`nav-${item.id}`} onSelect={() => go(item.href)}>
                <ItemIcon icon={item.icon} />
                {item.label}
                <CommandShortcut>{item.moduleId}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </UICommandPalette>
  );
}

function ItemIcon({ icon: Icon }: { icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }) {
  return <Icon className="h-4 w-4" />;
}
