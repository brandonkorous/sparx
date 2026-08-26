'use client';

// A discount's two irreversible-ish moments, kept together at the foot of the
// editor: switching it on for shoppers, and retiring it for good.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faPowerOff, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { Discount } from './discounts-data';

export function DiscountLifecycle({
  discount,
  activating,
  retiring,
  onActivate,
  onRetire,
}: {
  discount: Discount;
  activating: boolean;
  retiring: boolean;
  onActivate: () => void;
  onRetire: () => void;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-4 border-t pt-4">
      {discount.status === 'draft' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text className="text-sm">
            This discount is switched off. Switch it on when you are ready for shoppers to use it.
          </Text>
          <Button size="sm" color="module" loading={activating} onClick={onActivate}>
            <Icon glyph={faPowerOff} className="size-4" aria-hidden />
            Switch on
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text className="text-sm">
          Retiring switches this discount off for good — it cannot be reopened afterwards.
        </Text>
        <Button size="sm" variant="outline" color="danger" loading={retiring} onClick={onRetire}>
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          Retire this discount
        </Button>
      </div>
    </div>
  );
}
