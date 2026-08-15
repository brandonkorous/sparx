'use client';

// WHY THIS NUMBER — the reorder level for one item, taken apart.
//
// ── The pane that stops people overriding the maths ───────────────────────
//
// Phase 1 made a stock QUANTITY checkable: click it, see the ledger rows behind
// it. This does the same for a number that was inferred rather than recorded —
// which needs it more, not less, because an inferred number has no rows behind
// it and so nothing to check it against.
//
// The failure this exists to prevent is specific and it happens to every
// planning feature: an operator is shown "reorder at 84", cannot find out why,
// decides the computer is wrong, and types 40 back in. Then the forecast was for
// nothing. So this page answers the question before it is asked — every input,
// where it came from, how much of it is measured and how much is assumed, and
// the two formulas with this item's own numbers substituted into them so anyone
// can check the arithmetic on paper.
//
// ── Confidence is the headline, not a footnote ────────────────────────────
//
// The verdict is the WEAKEST input, never an average: a perfect sales
// measurement against a guessed supplier lead time produces a guessed reorder
// level, and averaging those two into "fairly confident" would be a lie with a
// number attached. What is missing gets its own section, with the specific thing
// that would fix it.
//
// ── Adopting is one button, and it is not the same as automating ──────────
//
// Taking today's figure is a small, reversible act. Handing the level to the
// nightly maths forever is a different, larger one, and it lives in Settings
// where a decision of that size belongs.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Table,
  Text,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { CircleAlert, Lightbulb, PackageX, Sigma, Wand2 } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural, stockErrorMessage } from './data';
import {
  confidenceLabel,
  confidenceTone,
  forecastBasisLabel,
  leadTimeSourceLabel,
  useApplyReorderPoint,
  usePlanningExplanation,
} from './planning-data';
import { InlineWaiting } from '../../components/inline-waiting';

/**
 * A selling rate, at a precision a person can read.
 *
 * The stored figures carry four decimals because the arithmetic downstream wants
 * them; printing them raw put "0.7105 a day" and "3.3118 a day either way" on
 * screen, which reads as machine output rather than an answer. Two decimals is
 * past the point where any of this is meaningful anyway — the input is a count
 * of units on a shelf.
 */
function rate(perDay: number): string {
  if (!Number.isFinite(perDay)) return '—';
  return String(Math.round(perDay * 100) / 100);
}

export function PlanningExplainSurface({ ctx }: { ctx: SurfaceContext }) {
  const variantId = ctx.params.variantId ?? '';
  const warehouseId = ctx.params.warehouseId ?? '';

  const explanation = usePlanningExplanation(variantId, warehouseId);
  const apply = useApplyReorderPoint();
  const confirm = useConfirm();
  const toast = useToast();

  if (explanation.isError) {
    return (
      <div className={PANE_SHELL}>
        <EmptyState
          icon={<PackageX className="size-6" aria-hidden />}
          title="Could not explain this number"
          description="Nothing has ever stocked this item at this location, or the server could not be reached. Either way there is no calculation to show."
        />
      </div>
    );
  }

  if (explanation.isLoading || !explanation.data) {
    return (
      <div className={PANE_SHELL}>
        <InlineWaiting label="Taking the number apart…" />
      </div>
    );
  }

  const data = explanation.data;

  const onApply = async () => {
    if (data.computedReorderPoint === null) return;
    const ok = await confirm({
      title: 'Use the worked-out level?',
      description: `This sets the reorder level for ${
        data.title ?? data.sku ?? 'this item'
      } to ${data.computedReorderPoint}${
        data.currentReorderPoint === null ? '' : `, up from ${data.currentReorderPoint}`
      }. It takes today's figure once — the level stays yours, and nothing changes it again unless you say so.`,
      confirmLabel: 'Use it',
      cancelLabel: 'Leave it',
      color: 'module',
    });
    if (!ok) return;
    apply.mutate(
      { variantId, warehouseId },
      {
        onSuccess: () => {
          toast.add({
            title: 'Reorder level updated',
            description: `This item now flags as running low at ${String(data.computedReorderPoint)}.`,
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not change the level',
            description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className={`${PANE_SHELL} overflow-y-auto`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Heading level={2} className="truncate text-lg">
            {data.title ?? data.sku ?? 'This item'}
          </Heading>
          <Text className="text-sm">
            {data.sku ? <span className="font-mono">{data.sku}</span> : 'No product code'}
            {data.warehouseName ? ` · ${data.warehouseName}` : ''}
          </Text>
        </div>
        <Badge color={confidenceTone(data.confidence)} variant="soft">
          {confidenceLabel(data.confidence)}
        </Badge>
      </div>

      <Stats className="w-full">
        <Stat>
          <StatTitle>Reorders at</StatTitle>
          <StatValue>{data.currentReorderPoint ?? '—'}</StatValue>
          <StatDesc>
            {data.currentReorderPoint === null
              ? 'No level set — nothing will warn you'
              : data.isAutoManaged
                ? 'Set automatically each night'
                : 'Set by hand'}
          </StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Worked out as</StatTitle>
          <StatValue className={data.differs ? 'text-module' : undefined}>
            {data.computedReorderPoint ?? '—'}
          </StatValue>
          <StatDesc>
            {data.safetyStockUnits === null
              ? 'Not worked out yet'
              : `${plural(data.safetyStockUnits, 'unit', 'units')} of that is spare cover`}
          </StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Aiming to be in stock</StatTitle>
          <StatValue className="text-base">{data.serviceLevelLabel}</StatValue>
          <StatDesc>Set under Planning → Settings</StatDesc>
        </Stat>
      </Stats>

      {/* The whole reason the pane exists: the two numbers disagree and someone
          has to decide. Never auto-resolved, and the button says what it does. */}
      {data.differs && data.computedReorderPoint !== null ? (
        <Alert color="module" variant="soft">
          <AlertContent>
            <AlertTitle>
              The worked-out level is {data.computedReorderPoint}, not {data.currentReorderPoint}
            </AlertTitle>
            <AlertDescription>
              Your level is left exactly as you set it. The figures below say where the difference
              comes from — if the reasoning holds up, take it.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="module"
            loading={apply.isPending}
            onClick={() => {
              void onApply();
            }}
          >
            <Wand2 className="size-4" aria-hidden />
            Use {data.computedReorderPoint}
          </Button>
        </Alert>
      ) : null}

      {data.currentReorderPoint === null && data.computedReorderPoint !== null ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>Nothing will warn you about this item</AlertTitle>
            <AlertDescription>
              It has no reorder level, so it will run out without appearing on any list. Based on
              how it sells and how long its supplier takes, {data.computedReorderPoint} would be the
              right level.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="module"
            loading={apply.isPending}
            onClick={() => {
              void onApply();
            }}
          >
            <Wand2 className="size-4" aria-hidden />
            Set it to {data.computedReorderPoint}
          </Button>
        </Alert>
      ) : null}

      {/* ── The inputs ── */}
      <Card className="flex flex-col gap-2 p-3">
        <Heading level={3} className="text-base">
          What went into it
        </Heading>
        <div className="overflow-x-auto">
          <Table size="sm">
            <thead>
              <tr>
                <th>Input</th>
                <th>Figure</th>
                <th className="hidden @xl:table-cell">Where it came from</th>
                <th className="whitespace-nowrap">How solid</th>
              </tr>
            </thead>
            <tbody>
              {data.inputs.map((input) => (
                <tr key={input.key}>
                  <td className="whitespace-nowrap">{input.label}</td>
                  <td className="font-medium">{input.value}</td>
                  <td className="hidden @xl:table-cell">
                    <span className="flex flex-col">
                      <span>{input.source}</span>
                      {input.caveat ? <span className="text-sm">{input.caveat}</span> : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <Badge color={confidenceTone(input.confidence)} variant="soft" size="sm">
                      {confidenceLabel(input.confidence)}
                    </Badge>
                    {/* On a narrow pane the source column is gone, so the caveat
                        — the part that changes a decision — folds in here. */}
                    {input.caveat ? (
                      <span className="block text-sm @xl:hidden">{input.caveat}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* ── The arithmetic ── */}
      <Card className="flex flex-col gap-2 p-3">
        <Heading level={3} className="text-base">
          <Sigma className="mr-1 inline size-4 align-text-bottom" aria-hidden />
          The arithmetic, with your numbers in it
        </Heading>
        <Text className="text-sm">
          Nothing here is a black box. Check it on paper if you like — that is the point of showing
          it.
        </Text>
        <dl className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <dt className="text-sm">Spare cover</dt>
            <dd className="bg-base-200 rounded-field overflow-x-auto p-2 font-mono text-sm">
              {data.workings.safetyStock}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm">Reorder level</dt>
            <dd className="bg-base-200 rounded-field overflow-x-auto p-2 font-mono text-sm">
              {data.workings.reorderPoint}
            </dd>
          </div>
        </dl>
      </Card>

      {/* ── How it sells ── */}
      {data.velocity ? (
        <Card className="flex flex-col gap-2 p-3">
          <Heading level={3} className="text-base">
            How it has been selling
          </Heading>
          <div className="overflow-x-auto">
            <Table size="sm">
              <thead>
                <tr>
                  <th>Window</th>
                  <th className="text-right">Sold</th>
                  <th className="text-right">A day</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Last 7 days</td>
                  <td className="text-right tabular-nums">{data.velocity.units7}</td>
                  <td className="text-right tabular-nums">{rate(data.velocity.perDay7)}</td>
                </tr>
                <tr>
                  <td>Last 30 days</td>
                  <td className="text-right tabular-nums">{data.velocity.units30}</td>
                  <td className="text-right tabular-nums">{rate(data.velocity.perDay30)}</td>
                </tr>
                <tr>
                  <td>Last 90 days</td>
                  <td className="text-right tabular-nums">{data.velocity.units90}</td>
                  <td className="text-right tabular-nums">{rate(data.velocity.perDay90)}</td>
                </tr>
              </tbody>
            </Table>
          </div>
          <Text className="text-sm">
            The forecast uses the {forecastBasisLabel(data.velocity.forecastBasis)}, at{' '}
            {rate(data.velocity.forecastPerDay)} a day. Sales landed on{' '}
            {plural(data.velocity.daysWithDemand, 'day', 'days')} out of the last 90, and there
            {data.velocity.historyDays === 1 ? ' is ' : ' are '}
            {plural(data.velocity.historyDays, 'day', 'days')} of history for it.
          </Text>
        </Card>
      ) : null}

      {/* ── The supplier ── */}
      {data.leadTime ? (
        <Card className="flex flex-col gap-2 p-3">
          <Heading level={3} className="text-base">
            How long the supplier takes
          </Heading>
          <Text>
            {data.leadTime.supplierName ?? 'The supplier'} — {data.leadTime.days} days
            {data.leadTime.stdDevDays > 0 ? `, give or take ${data.leadTime.stdDevDays}` : ''}.{' '}
            {leadTimeSourceLabel(data.leadTime.source)}
            {data.leadTime.sampleCount > 0
              ? ` across ${plural(data.leadTime.sampleCount, 'delivery', 'deliveries')}`
              : ''}
            .
          </Text>
          {data.leadTime.promisedDays !== null &&
          data.leadTime.source === 'measured' &&
          Math.abs(data.leadTime.days - data.leadTime.promisedDays) >= 1 ? (
            <Alert
              color={data.leadTime.days > data.leadTime.promisedDays ? 'warning' : 'success'}
              variant="soft"
            >
              <AlertContent>
                <AlertDescription>
                  They say {data.leadTime.promisedDays} days and actually take {data.leadTime.days}
                  {data.leadTime.days > data.leadTime.promisedDays
                    ? ' — which is why the level is higher than their quoted time would suggest.'
                    : ' — they beat their own quote, so less spare cover is needed.'}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}
        </Card>
      ) : null}

      {/* ── What would make this better ── */}
      {data.improve.length > 0 ? (
        <Card className="flex flex-col gap-2 p-3">
          <Heading level={3} className="text-base">
            <Lightbulb className="mr-1 inline size-4 align-text-bottom" aria-hidden />
            What would make this number better
          </Heading>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {data.improve.map((item) => (
              <li key={item} className="text-base">
                {item}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Text className="px-1 text-sm">
        <CircleAlert className="mr-1 inline size-4 align-text-bottom" aria-hidden />
        {data.computedAt ? (
          <>
            Worked out <Timestamp value={data.computedAt} format="relative" />. It is redone every
            night from your own sales and deliveries.
          </>
        ) : (
          'This item has not been through a planning run yet, so the figures above are what the current measurements would give.'
        )}
      </Text>
    </div>
  );
}
