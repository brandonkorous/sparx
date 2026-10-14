'use client';

// Picking what they had off her list. Moved out of sale-lines.tsx (sparx
// persona issue 230); the rows and the words are unchanged.

import { useState } from 'react';
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  SearchInput,
  Text,
} from '@wizeworks/silicaui-react';

import { PaneWaiting } from '../../components/pane-waiting';
import { formatCents } from './products-data';
import type { Sellable } from './sale-data';
import { matchingSellables } from './sale-sellable-search';
import { useSellables } from './sale-sellables';

function CouldNotLoad({ retry }: { retry: () => void }) {
  return (
    <Alert color="error">
      <AlertContent>
        <AlertTitle>Could not load what you sell</AlertTitle>
        <AlertDescription>
          This is a problem reaching the server, not a problem with this sale. You can still write
          what they had in by hand below, or try again.
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button size="sm" variant="outline" onClick={retry}>
          Try again
        </Button>
      </AlertActions>
    </Alert>
  );
}

function SellableRow({ item, onPick }: { item: Sellable; onPick: (s: Sellable) => void }) {
  return (
    <button
      type="button"
      className="hover:bg-base-200 flex w-full items-center gap-3 rounded px-2 py-2 text-left"
      onClick={() => {
        onPick(item);
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{item.name}</span>
        {item.detail ? (
          <Text as="span" className="block text-sm">
            {item.detail}
          </Text>
        ) : null}
      </span>
      {item.kind === 'service' ? (
        <Badge color="module-scheduling" variant="soft" size="sm">
          Appointment
        </Badge>
      ) : null}
      {item.core ? (
        <Badge color="info" variant="soft" size="sm">
          Core deposit {formatCents(item.core.depositCents, item.currency)}
        </Badge>
      ) : null}
      <Text as="span" className="shrink-0 text-sm tabular-nums">
        {formatCents(item.priceCents, item.currency)}
      </Text>
    </button>
  );
}

/** What sits under the search box while there are no rows to draw. */
function NoRows({
  isPending,
  searching,
  term,
}: {
  isPending: boolean;
  searching: boolean;
  term: string;
}) {
  // Never "nothing set up to sell" while the list is still on its way: an empty
  // answer that is really an unanswered question sends somebody off to write in
  // by hand something they already sell. The same for a search still on its way.
  if (isPending) return <PaneWaiting label="Loading what you sell…" />;
  if (searching) return <PaneWaiting label="Looking through what you sell…" />;
  return (
    <Text className="text-sm">
      {term
        ? `Nothing you sell matches “${term}”. Try fewer words, or the code off the box. If it really is a one-off, write it in below.`
        : 'Nothing set up to sell yet. Add what they had by hand below.'}
    </Text>
  );
}

export function SellablePicker({ onPick }: { onPick: (s: Sellable) => void }) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  // The server searches what is typed, however big the catalog (sparx issue 069).
  const { items, isPending, isError, searching, retry } = useSellables(search);
  // Name, version AND code, word by word: see sale-sellable-search.ts. Most of
  // what a maker sells shares a product name, so searching the name alone made
  // "Marlow Knit XL" find nothing while eight Marlow Knits sat on the screen.
  const results = matchingSellables(items, term);

  if (isError) return <CouldNotLoad retry={retry} />;
  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-sm min-w-0">
        <SearchInput
          size="sm"
          aria-label="Search what you sell"
          placeholder="Search what you sell…"
          value={search}
          onValueChange={setSearch}
        />
      </div>
      {isPending || results.length === 0 ? (
        <NoRows isPending={isPending} searching={searching} term={term} />
      ) : (
        <div className="border-base-300 max-h-64 overflow-y-auto rounded border p-1">
          {results.map((item) => (
            <SellableRow key={item.key} item={item} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  );
}
