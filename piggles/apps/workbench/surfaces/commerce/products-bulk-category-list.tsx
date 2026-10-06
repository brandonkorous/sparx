'use client';

// The categories to choose from in the bulk dialog, plus "make a new one called
// …" when adding and nothing is called what was typed.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  RadioGroup,
  RadioOption,
  Text,
} from '@wizeworks/silicaui-react';
import { InlineWaiting } from '../../components/inline-waiting';
import type { CategoryChoice } from './categories-data';

export const NEW_CATEGORY = '__new__';

/** Case-insensitive over the whole trail, so typing a parent finds its children. */
export function filterCategories(all: CategoryChoice[], search: string): CategoryChoice[] {
  const needle = search.trim().toLowerCase();
  if (needle === '') return all;
  return all.filter((category) => category.trail.join(' › ').toLowerCase().includes(needle));
}

function LoadFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert color="danger" variant="soft">
      <AlertContent>
        <AlertTitle>Could not load your categories</AlertTitle>
        <AlertDescription>
          This is a problem reaching the server. Nothing has been changed.
        </AlertDescription>
      </AlertContent>
      <Button size="sm" color="danger" variant="soft" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}

function Choice({ category }: { category: CategoryChoice }) {
  return (
    <RadioOption value={category.id}>
      <span className="min-w-0">
        {category.trail.slice(0, -1).map((ancestor) => (
          <span key={ancestor}>{ancestor} › </span>
        ))}
        <span className="font-semibold">{category.name}</span>
      </span>
    </RadioOption>
  );
}

export function CategoryChoices({
  state,
  all,
  matches,
  typed,
  canMake,
  adding,
  picked,
  onPick,
  onRetry,
}: {
  state: 'error' | 'pending' | 'ready';
  all: CategoryChoice[];
  matches: CategoryChoice[];
  typed: string;
  canMake: boolean;
  adding: boolean;
  picked: string;
  onPick: (id: string) => void;
  onRetry: () => void;
}) {
  if (state === 'error') return <LoadFailure onRetry={onRetry} />;
  if (state === 'pending') return <InlineWaiting label="Loading your categories…" />;
  if (all.length === 0 && !canMake) {
    return (
      <Text>
        {adding
          ? 'You have no categories yet. Type a name above to make your first one.'
          : 'You have no categories yet, so there is nothing to take these out of.'}
      </Text>
    );
  }
  return (
    <RadioGroup color="module" value={picked} onValueChange={onPick} aria-label="Category">
      {canMake ? (
        <RadioOption value={NEW_CATEGORY}>
          <span className="font-semibold">Make a new category called “{typed}”</span>
        </RadioOption>
      ) : null}
      {matches.map((category) => (
        <Choice key={category.id} category={category} />
      ))}
      {matches.length === 0 && !canMake ? (
        <Text>No category is called anything like “{typed}”.</Text>
      ) : null}
    </RadioGroup>
  );
}
