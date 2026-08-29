'use client';

// Versions that belong to no combination, and the control that puts them back.
//
// Two situations arrive here and they look different on the row: one is on sale
// but sits on no combination, so no shopper can reach it; the other was stopped
// and has nowhere to go back to. The cure is identical for both — say which
// combination it belongs to — so they share a section rather than sitting in two
// places with two different offers.
//
// This section used to state the problem and stop there, while the toast that
// sent people here said "Open the Variants tab to put them right." It could not
// be put right there, so the only versions that had lost their place were the
// only ones nothing could give one back (issue 305).

import { useState } from 'react';
import { Badge, Button, Select, Text } from '@wizeworks/silicaui-react';

import { FormSection } from '../../../components/form-section';
import { slotLabel, type Slot } from './slots';
import { formatCents, type Variant } from '../products-data';

const ROW =
  'border-base-300 flex flex-col gap-2 border-b pb-3 last:border-b-0 @md:flex-row @md:items-center';

export function FindAPlace({
  stranded,
  homeless,
  free,
  placingId,
  onPlace,
}: {
  /** On sale, but sitting on no combination. */
  stranded: Variant[];
  /** Stopped, and with no combination to come back to. */
  homeless: Variant[];
  /** Combinations with nothing on sale in them. */
  free: Slot[];
  placingId: string | null;
  onPlace: (variant: Variant, slot: Slot) => void;
}) {
  const versions = [...stranded, ...homeless];
  if (versions.length === 0) return null;

  return (
    <FormSection
      title="Versions with no place in the grid"
      description={
        free.length > 0
          ? 'These do not belong to any combination of choices, so nobody can reach them on your website. Say where each one belongs and it goes back in the grid keeping its price, code and stock.'
          : 'These do not belong to any combination of choices, so nobody can reach them on your website. Every combination already has something on sale in it. Add the choice these belong to on the Options tab, or stop selling whatever is sitting in the combination you want, and they can go back.'
      }
    >
      {versions.map((variant) => (
        <PlaceRow
          key={variant.id}
          variant={variant}
          free={free}
          busy={placingId === variant.id}
          onPlace={onPlace}
        />
      ))}
    </FormSection>
  );
}

function PlaceRow({
  variant,
  free,
  busy,
  onPlace,
}: {
  variant: Variant;
  free: Slot[];
  busy: boolean;
  onPlace: (variant: Variant, slot: Slot) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  // The list moves under her as each version is placed, so a stale choice falls
  // back rather than writing somewhere else — and it falls back to an EMPTY
  // combination first. Offering one that already holds a stopped version is
  // right; defaulting to it stacks two on a square nobody asked to share.
  const chosen =
    free.find((slot) => slot.key === picked) ??
    free.find((slot) => slot.retired.length === 0) ??
    free[0] ??
    null;

  return (
    <div className={ROW}>
      {/* Never truncated. Two versions on one shop can differ only in a "-2" at
          the end, and a "…" there is the difference between the version holding
          the stock and the one holding none. */}
      <Text className="min-w-0 flex-1 break-all">{variant.title ?? variant.sku}</Text>
      <Text as="span" className="tabular-nums">
        {formatCents(variant.priceCents, variant.currency)}
      </Text>
      {variant.deletedAt === null ? (
        <Badge color="warning" variant="soft" size="sm">
          On sale, but hidden
        </Badge>
      ) : (
        <Badge variant="outline" size="sm">
          Not sold
        </Badge>
      )}

      {chosen ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-[11rem]">
            <Select
              color="module"
              aria-label={`Where ${variant.sku} belongs`}
              value={chosen.key}
              items={Object.fromEntries(free.map((slot) => [slot.key, choiceLabel(slot)]))}
              onValueChange={(next) => {
                setPicked((next as string | null) ?? null);
              }}
            />
          </div>
          <Button
            size="sm"
            color="module"
            loading={busy}
            onClick={() => {
              onPlace(variant, chosen);
            }}
          >
            Put it here
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** A combination already holding a stopped version is still a fine place to put
 *  one, and saying so beats letting her discover it afterwards.
 *
 *  Kept short deliberately. A select truncates its own trigger, and at 360px
 *  "(has a stopped version)" was cut to "(has a stopped ver…" — losing the whole
 *  caveat while keeping the words that introduce it. */
function choiceLabel(slot: Slot): string {
  const held = slot.retired.length;
  if (held === 0) return slotLabel(slot);
  return `${slotLabel(slot)} (${String(held)} not sold)`;
}
