'use client';

// The two Phase 8 panels that live on a supplier's own pane: how they have
// actually performed, and what they charge at what quantity.
//
// Their own file because supplier-detail.tsx is already the supplier RECORD —
// name, address, terms, what you buy from them — and these two are a different
// job: one is a measurement nobody edits, the other is a price ladder. Adding
// three hundred lines to that file would have made it a screen with four
// unrelated responsibilities.
//
// ── Both panels refuse to fill a gap with a number ────────────────────────
//
// A supplier the nightly pass has never reached has NO scorecard, and the panel
// says so in a sentence with a button. It does not render a card of zeroes,
// because a card of zeroes is a judgement and this is an absence. Likewise a
// purchasing link with no cost recorded reads "no price recorded" rather than
// free.

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Input,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Table,
  Text,
  Timestamp,
  Tooltip,
  useToast,
} from '@wizeworks/silicaui-react';
import { faCalculator, faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { afterCommit } from '../../lib/defer';
import { formatCents, plural, stockErrorMessage } from './data';
import type { SupplierVariant } from './suppliers-data';
import {
  componentsLabel,
  damageTone,
  fillRateTone,
  gradeLabel,
  gradeTone,
  onTimeTone,
  priceVarianceTone,
  rateOrUnknown,
  usePriceLadder,
  useRecomputeScorecards,
  useSetPriceBreaks,
  useSupplierScorecard,
} from './supplier-performance-data';
import { InlineWaiting } from '../../components/inline-waiting';

/* ── How they have actually performed ───────────────────────────────────── */

export function SupplierScorecardPanel({ supplierId }: { supplierId: string }) {
  const card = useSupplierScorecard(supplierId);
  const recompute = useRecomputeScorecards();
  const toast = useToast();

  const onMeasure = () => {
    recompute.mutate(undefined, {
      onSuccess: () => {
        afterCommit(() => {
          toast.add({ title: 'Suppliers measured', type: 'success' });
        });
      },
      onError: (error) => {
        afterCommit(() => {
          toast.add({
            title: 'Could not measure your suppliers',
            description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
            type: 'error',
          });
        });
      },
    });
  };

  // A 404 here is the NORMAL state for a supplier nobody has measured, so it is
  // handled as a sentence rather than as an error. A card of zeroes would be a
  // judgement about somebody nothing is known about.
  if (card.isError || (!card.isLoading && !card.data)) {
    return (
      <FormSection
        title="How they have performed"
        description="Worked out from your own orders and deliveries — nothing here is typed in by hand."
      >
        <Text className="text-sm">
          Nobody has been measured yet. This is empty because no pass has been made over your orders
          and deliveries, not because this supplier has no record.
        </Text>
        <div>
          <Button color="module" size="sm" loading={recompute.isPending} onClick={onMeasure}>
            <Icon glyph={faCalculator} className="size-4" aria-hidden />
            Measure now
          </Button>
        </div>
      </FormSection>
    );
  }

  if (card.isLoading || !card.data) {
    return (
      <FormSection title="How they have performed">
        <InlineWaiting label="Working out how they have done…" />
      </FormSection>
    );
  }

  const data = card.data;

  return (
    <FormSection
      title="How they have performed"
      description={`Over the last ${data.windowDays} days, from your own orders and deliveries.`}
      action={
        <Badge color={gradeTone(data.grade)} variant="soft">
          {data.grade ? `${data.grade} · ${data.score}` : gradeLabel(null)}
        </Badge>
      }
    >
      {data.score === null ? (
        <Alert color="info" variant="soft">
          <AlertContent>
            <AlertTitle>Not enough to grade them on yet</AlertTitle>
            <AlertDescription>
              A grade needs at least two of the four measures below, and each needs something to
              measure — a delivery with a date on it, an order that has finished, a price to
              compare, or units received. What IS known is shown; the rest says so.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : (
        <Text className="text-sm">
          Based on {componentsLabel(data.scoredComponents)}, across{' '}
          {plural(data.deliveries, 'delivery', 'deliveries')} and{' '}
          {plural(data.ordersPlaced, 'order', 'orders')} worth {formatCents(data.spendCents)}.
        </Text>
      )}

      <Stats className="w-full">
        <Stat>
          <StatTitle>On time</StatTitle>
          <StatValue>
            <Badge color={onTimeTone(data.onTimeRate)} variant="soft">
              {rateOrUnknown(data.onTimeRate)}
            </Badge>
          </StatValue>
          <StatDesc>
            {data.onTimeRate === null ? (
              <Tooltip content="No delivery from this supplier has ever had a date to be judged against — either nobody set an expected arrival, or they never stated a delivery time.">
                <span>no dates to judge against</span>
              </Tooltip>
            ) : (
              <>
                {data.lateDeliveries} of {data.onTimeSample} late
                {data.avgDaysLate !== null ? `, by ${data.avgDaysLate} days on average` : ''}
              </>
            )}
          </StatDesc>
        </Stat>

        <Stat>
          <StatTitle>In full</StatTitle>
          <StatValue>
            <Badge color={fillRateTone(data.fillRate)} variant="soft">
              {rateOrUnknown(data.fillRate)}
            </Badge>
          </StatValue>
          <StatDesc>
            {data.fillRate === null
              ? 'no order from them has finished yet'
              : `${data.shortLines} short of ${plural(data.fillRateSample, 'line', 'lines')}`}
          </StatDesc>
        </Stat>

        <Stat>
          <StatTitle>Price vs agreed</StatTitle>
          <StatValue>
            <Badge color={priceVarianceTone(data.priceVariancePct)} variant="soft">
              {data.priceVariancePct === null
                ? 'Not measured'
                : `${data.priceVariancePct > 0 ? '+' : ''}${data.priceVariancePct.toFixed(1)}%`}
            </Badge>
          </StatValue>
          <StatDesc>
            {data.priceVariancePct === null
              ? 'nothing comparable in the same currency'
              : data.priceVarianceCents === 0
                ? 'exactly what was agreed'
                : `${formatCents(Math.abs(data.priceVarianceCents ?? 0))} ${
                    (data.priceVarianceCents ?? 0) > 0 ? 'more' : 'less'
                  } than agreed`}
          </StatDesc>
        </Stat>

        <Stat>
          <StatTitle>Damaged on arrival</StatTitle>
          <StatValue>
            <Badge color={damageTone(data.damageRate)} variant="soft">
              {rateOrUnknown(data.damageRate)}
            </Badge>
          </StatValue>
          <StatDesc>
            {data.damageRate === null
              ? 'nothing received yet'
              : `${data.damagedUnits} of ${data.receivedUnits + data.damagedUnits} units`}
          </StatDesc>
        </Stat>
      </Stats>

      {/* Their stated delivery time against the measured one. The gap is the
          single most useful number on this panel for planning: every reorder
          level built on the promise inherits its optimism. */}
      {data.leadTimeMeanDays !== null ? (
        <Text className="text-sm">
          Deliveries take {data.leadTimeMeanDays} days on average, measured across{' '}
          {plural(data.leadTimeSample, 'delivery', 'deliveries')}
          {data.leadTimePromisedDays !== null
            ? ` — they say ${data.leadTimePromisedDays}, so they run ${
                (data.leadTimeVarianceDays ?? 0) >= 0 ? 'slower' : 'faster'
              } than stated by ${Math.abs(data.leadTimeVarianceDays ?? 0)} days.`
            : ', and they have never stated a delivery time to compare it against.'}
        </Text>
      ) : (
        <Text className="text-sm">
          No delivery from them has been measured yet, so planning still uses whatever delivery time
          was typed in on their record.
        </Text>
      )}

      <Text className="text-sm">
        Measured <Timestamp value={data.measuredAt} format="relative" />.
      </Text>
    </FormSection>
  );
}

/* ── What they charge at what quantity ──────────────────────────────────── */

export function PriceLadders({
  variants,
  currency,
}: {
  variants: SupplierVariant[];
  currency: string;
}) {
  if (variants.length === 0) return null;

  return (
    <FormSection
      title="Quantity prices"
      description="“£4.10 each, or £3.60 if you take fifty.” Set the ladder here and a purchase order picks the right price for the quantity being ordered — and tells the buyer what the next step down would save."
    >
      {variants.map((link) => (
        <PriceLadderRow key={link.id} link={link} currency={currency} />
      ))}
    </FormSection>
  );
}

interface Rung {
  minQuantity: string;
  unitCost: string;
}

function PriceLadderRow({ link, currency }: { link: SupplierVariant; currency: string }) {
  const ladder = usePriceLadder(link.id);
  const save = useSetPriceBreaks(link.id);
  const toast = useToast();

  const [rungs, setRungs] = useState<Rung[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!ladder.data) return;
    setRungs(
      ladder.data.breaks.map((step) => ({
        minQuantity: String(step.minQuantity),
        unitCost: (step.unitCostCents / 100).toString(),
      }))
    );
    setDirty(false);
  }, [ladder.data]);

  const valid = rungs.every(
    (rung) => Number.parseInt(rung.minQuantity, 10) >= 2 && Number.parseFloat(rung.unitCost) >= 0
  );

  const onSave = () => {
    save.mutate(
      rungs.map((rung) => ({
        minQuantity: Number.parseInt(rung.minQuantity, 10),
        unitCostCents: Math.round(Number.parseFloat(rung.unitCost) * 100),
      })),
      {
        onSuccess: () => {
          setDirty(false);
          afterCommit(() => {
            toast.add({
              title: 'Quantity prices saved',
              description: `Purchase orders for ${link.productTitle ?? link.variantSku ?? 'this item'} will use them from now on.`,
              type: 'success',
            });
          });
        },
        onError: (error) => {
          afterCommit(() => {
            toast.add({
              title: 'Could not save those prices',
              description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
              type: 'error',
            });
          });
        },
      }
    );
  };

  return (
    <div className="border-base-300 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Text className="font-medium">{link.productTitle ?? link.variantSku ?? 'Item'}</Text>
        <Text className="text-sm">
          {link.unitCostCents === null
            ? 'No price recorded'
            : `${formatCents(link.unitCostCents, currency)} each below the first step`}
        </Text>
      </div>

      {rungs.length === 0 ? (
        <Text className="text-sm">
          One price at every quantity. Add a step if they discount for volume.
        </Text>
      ) : (
        <Table size="sm">
          <thead>
            <tr>
              <th className="w-32">From quantity</th>
              <th className="w-32">Price each</th>
              <th className="w-0" />
            </tr>
          </thead>
          <tbody>
            {rungs.map((rung, index) => (
              <tr key={index}>
                <td>
                  <Input
                    size="sm"
                    color="module"
                    type="number"
                    min={2}
                    aria-label="From quantity"
                    value={rung.minQuantity}
                    onChange={(event) => {
                      const minQuantity = event.target.value;
                      setDirty(true);
                      setRungs((current) =>
                        current.map((r, i) => (i === index ? { ...r, minQuantity } : r))
                      );
                    }}
                  />
                </td>
                <td>
                  <Input
                    size="sm"
                    color="module"
                    type="number"
                    min={0}
                    step="0.01"
                    aria-label="Price each at this quantity"
                    value={rung.unitCost}
                    onChange={(event) => {
                      const unitCost = event.target.value;
                      setDirty(true);
                      setRungs((current) =>
                        current.map((r, i) => (i === index ? { ...r, unitCost } : r))
                      );
                    }}
                  />
                </td>
                <td className="w-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    color="danger"
                    shape="square"
                    aria-label="Remove this step"
                    onClick={() => {
                      setDirty(true);
                      setRungs((current) => current.filter((_, i) => i !== index));
                    }}
                  >
                    <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            setDirty(true);
            setRungs((current) => [...current, { minQuantity: '', unitCost: '' }]);
          }}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add a step
        </Button>
        {dirty ? (
          <Button
            size="sm"
            color="module"
            disabled={!valid}
            loading={save.isPending}
            onClick={onSave}
          >
            Save quantity prices
          </Button>
        ) : null}
        {dirty && !valid ? (
          <Text className="text-sm">
            A step starts at 2 or more — a step at 1 is just the price above.
          </Text>
        ) : null}
      </div>
    </div>
  );
}
