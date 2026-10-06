'use client';

// Offer it on repeat — which schedules a SHOPPER may choose for this product
// (issue 739).
//
// The rest of the Repeat orders pane reports on customers' repeat orders and is
// read-only for a good reason: each one belongs to a customer. This section is the
// product's own setting, so it is the one thing on the pane the owner edits.
//
// It says plainly when shoppers will not see it. A shop that takes payment in
// person, or whose provider cannot keep a card, can tick every box and still offer
// nothing, because a repeat is charged with nobody at the checkout. Saying so is
// the difference between a setting that works and one that looks like it does.

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Text } from '@wizeworks/silicaui-react';
import {
  cadenceKey,
  cadenceLabel,
  REPEAT_CADENCE_CHOICES,
  type RepeatCadence,
} from '@wizeworks/commerce-schemas';

import { FormSection } from '../../components/form-section';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { productErrorMessage, useUpdateProduct, type Product } from './products-data';
import { useGatewayCatalog, usePaymentConfig } from './providers-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function keysOf(list: readonly RepeatCadence[]): string[] {
  return list.map(cadenceKey);
}

export function RepeatOfferSection({ ctx, product }: { ctx: SurfaceContext; product: Product }) {
  const update = useUpdateProduct(product.id);
  const config = usePaymentConfig();
  const catalog = useGatewayCatalog();

  const savedKeys = useMemo(() => keysOf(product.repeatOptions ?? []), [product.repeatOptions]);
  const savedSignature = savedKeys.join(',');
  const [picked, setPicked] = useState<string[]>(savedKeys);
  // A save, or another tab's save, moves what is stored; follow it.
  useEffect(() => {
    setPicked(savedSignature ? savedSignature.split(',') : []);
  }, [savedSignature]);

  const pickedSignature = REPEAT_CADENCE_CHOICES.map(cadenceKey)
    .filter((key) => picked.includes(key))
    .join(',');
  const dirty = pickedSignature !== savedSignature;
  useDirtySource(dirty, 'How often shoppers can order this has changes you have not saved.');

  // Whether a shopper can actually be offered this, today.
  const gateway = catalog.data?.find((entry) => entry.id === config.data?.gatewayId);
  const known = config.data !== undefined && catalog.data !== undefined;
  const canKeepCards =
    config.data?.isActive === true && gateway?.capabilities.storedMethods === true;

  function save() {
    update.mutate({
      repeatOptions: REPEAT_CADENCE_CHOICES.filter((choice) => picked.includes(cadenceKey(choice))),
    });
  }

  return (
    <FormSection
      title="Offer it on repeat"
      description="Let shoppers choose to have this delivered again on a schedule. They pay for the first one at checkout, and each one after that is charged automatically: the same price for the item, plus postage and tax worked out when it goes out, the same way checkout does. They can pause, skip or cancel from their account."
    >
      {known && !canKeepCards ? (
        <Alert color="warning" variant="soft">
          <div className="flex flex-col gap-2">
            <span>
              Shoppers will not see this yet. A repeat is charged with nobody at the checkout, so
              your shop has to take card payments that can be kept for next time.{' '}
              {config.data?.gatewayId === 'manual'
                ? 'You take payment in person at the moment.'
                : config.data?.isActive === false
                  ? 'Your card payments are not switched on yet.'
                  : 'The way you take payment cannot keep a card.'}
            </span>
            <div>
              <Button
                size="sm"
                color="warning"
                variant="outline"
                onClick={(event) => {
                  ctx.open('commerce.providers', {}, { target: targetFor(event) });
                }}
              >
                Change how you take payment
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        {REPEAT_CADENCE_CHOICES.map((choice) => {
          const key = cadenceKey(choice);
          return (
            <label key={key} className="flex items-center gap-2">
              <Checkbox
                color="module"
                checked={picked.includes(key)}
                aria-label={cadenceLabel(choice)}
                onChange={(event) => {
                  setPicked((current) =>
                    event.target.checked
                      ? [...current, key]
                      : current.filter((existing) => existing !== key)
                  );
                }}
              />
              <Text as="span">{cadenceLabel(choice)}</Text>
            </label>
          );
        })}
      </div>

      <Text className="text-sm">
        {pickedSignature === ''
          ? 'Nothing ticked: shoppers buy this once, as they do now.'
          : 'Shoppers see Buy once first, then the schedules you ticked. Buy once stays the default.'}
      </Text>

      {update.isError ? (
        <Alert color="danger" variant="soft">
          {productErrorMessage(update.error, 'Could not save how often this can be ordered.')}
        </Alert>
      ) : null}

      <div>
        <Button
          color="module"
          size="sm"
          disabled={!dirty}
          loading={update.isPending}
          onClick={save}
        >
          Save how often
        </Button>
      </div>
    </FormSection>
  );
}
