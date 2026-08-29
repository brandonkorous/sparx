'use client';

// What a version weighs, and the two moves at the bottom of it.

import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { WholeNumber } from './fields';
import type { VariantDraft } from './draft';
import type { Variant } from '../products-data';

export function ParcelSize({
  draft,
  onChange,
}: {
  draft: VariantDraft;
  onChange: (change: Partial<VariantDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Heading level={4} className="text-base font-semibold">
        For working out postage
      </Heading>
      <div className="flex flex-col gap-3 @md:flex-row">
        <WholeNumber
          label="Weight"
          unit="grams"
          value={draft.weightGrams}
          onChange={(next) => {
            onChange({ weightGrams: next });
          }}
        />
        <WholeNumber
          label="Length"
          unit="mm"
          value={draft.lengthMm}
          onChange={(next) => {
            onChange({ lengthMm: next });
          }}
        />
        <WholeNumber
          label="Width"
          unit="mm"
          value={draft.widthMm}
          onChange={(next) => {
            onChange({ widthMm: next });
          }}
        />
        <WholeNumber
          label="Height"
          unit="mm"
          value={draft.heightMm}
          onChange={(next) => {
            onChange({ heightMm: next });
          }}
        />
      </div>
    </div>
  );
}

/** Rare, and one of them takes something off sale. Plain rows after the work,
 *  under a divider — not cards competing with the price someone came to change. */
export function VariantRisks({
  variant,
  onRetire,
  onMakeDefault,
}: {
  variant: Variant;
  onRetire: (variant: Variant) => void;
  onMakeDefault: (variant: Variant) => void;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-3">
      {variant.isDefault ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text>
            Shoppers see one version selected when the page opens. Right now that is not this one.
          </Text>
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            onClick={() => {
              onMakeDefault(variant);
            }}
          >
            Show this one first
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text>
          Stop selling this version without losing it. Its code stays reserved and past orders keep
          their record.
        </Text>
        <Button
          size="sm"
          variant="outline"
          color="danger"
          onClick={() => {
            onRetire(variant);
          }}
        >
          <Icon glyph={faXmark} className="size-4" aria-hidden />
          Stop selling it
        </Button>
      </div>
    </div>
  );
}
