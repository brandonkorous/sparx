'use client';

// WORKING A WALK — one instruction at a time, for someone holding a trolley.
//
// ── Why this is a separate surface from the walk pane ─────────────────────
//
// A supervisor needs the whole route on screen. A picker needs exactly one line,
// enormous, and nothing else — because they are moving, they are looking up at
// racking rather than down at a screen, and every other line on that screen is a
// chance to confirm the wrong one. Trying to serve both from one layout produces
// a screen that is a compromise for both.
//
// So: SHELF, then item, then quantity, in that order of size. That order is not
// decorative. The picker's first question in an aisle is always "am I in the
// right place", and the answer has to be readable from further away than the
// product name.
//
// ── Confirming is the big button; scanning is better ──────────────────────
//
// The scanner field holds focus and takes it back after every action, so a gun
// works with nobody touching the screen. Tapping Confirm is offered because a
// warehouse without barcodes on everything is the normal case and refusing to
// work without them would make the feature unusable — but the two are recorded
// DIFFERENTLY (`verifiedByScan`), and the accuracy report tells them apart rather
// than flattering the number.
//
// ── Short is a first-class button, not a menu item ────────────────────────
//
// It is the most valuable thing that happens on this screen: the moment a wrong
// stock number becomes knowable. Buried behind an overflow menu it does not get
// pressed, and the picker writes "couldn't find" on a bit of paper instead.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  NativeSelect,
  Progress,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import {
  faArrowRight,
  faBox,
  faCheck,
  faForwardStep,
  faPartyHorn,
  faRoute,
  faXmark,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural } from './data';
import { ScanInput, playScanFeedback } from './scan-input';
import {
  SHORT_REASONS,
  pickErrorMessage,
  useConfirmPick,
  usePickList,
  useScanToPick,
  useShortPick,
  useSkipPick,
  type PickLine,
  type ShortPickReason,
} from './picking-data';

/** 44px minimum. The smallest target a gloved thumb reliably hits. */
const TOUCH = 'min-h-11';

export function PickGuidedSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const { data: walk, isLoading, isError } = usePickList(id);

  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'warning' | 'danger'>('success');
  const [shorting, setShorting] = useState(false);

  const scan = useScanToPick(id);
  const confirm = useConfirmPick(id);
  const skip = useSkipPick(id);
  const short = useShortPick(id);

  if (isError) {
    return (
      <div className={PANE_SHELL}>
        <EmptyState
          icon={<Icon glyph={faRoute} className="size-6" aria-hidden />}
          title="Could not open that walk"
          description="It may have been abandoned. Go back to the list and pick another."
        />
      </div>
    );
  }

  if (isLoading || !walk) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting label="Loading the walk…" />
      </div>
    );
  }

  const current = walk.lines.find((l) => l.status === 'pending') ?? null;
  const done = walk.lines.filter((l) => l.status !== 'pending' && l.status !== 'skipped').length;
  const skipped = walk.lines.filter((l) => l.status === 'skipped');

  const say = (text: string, next: 'success' | 'warning' | 'danger') => {
    setMessage(text);
    setTone(next);
  };

  const onScan = async (value: string) => {
    try {
      const result = await scan.mutateAsync({ value });
      playScanFeedback(result.outcome);
      say(result.message, result.outcome === 'applied' ? 'success' : 'warning');
    } catch (err) {
      playScanFeedback('rejected');
      say(pickErrorMessage(err, 'That scan could not be sent. Scan it again.'), 'danger');
    }
  };

  return (
    <div className={PANE_SHELL}>
      {/* How far through. A bar rather than "12 of 30" alone, because a picker
          glances at it and a shape reads faster than two numbers. */}
      <div className="flex shrink-0 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm">{walk.number}</span>
          <span className="text-sm">
            {done} of {walk.lineCount} done
          </span>
        </span>
        <Progress color="module-inventory" value={done} max={Math.max(1, walk.lineCount)} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {current === null ? (
          <FinishedPanel walk={walk} ctx={ctx} skipped={skipped} />
        ) : (
          <>
            <InstructionCard line={current} usesBins={walk.usesBins} />

            <Card>
              <div className="p-4">
                <ScanInput
                  onScan={onScan}
                  placeholder="Scan the item"
                  busy={scan.isPending}
                  large
                />
              </div>
            </Card>

            {message ? (
              <Alert color={tone} variant="soft">
                <AlertContent>
                  <AlertTitle>{message}</AlertTitle>
                </AlertContent>
              </Alert>
            ) : null}

            {shorting ? (
              <ShortPanel
                busy={short.isPending}
                max={current.quantity - current.pickedQuantity}
                onCancel={() => {
                  setShorting(false);
                }}
                onSubmit={(input) => {
                  void (async () => {
                    try {
                      const result = await short.mutateAsync({
                        lineId: current.id,
                        ...input,
                      });
                      playScanFeedback('rejected');
                      say(result.message, 'warning');
                      setShorting(false);
                    } catch (err) {
                      say(pickErrorMessage(err, 'Could not record that.'), 'danger');
                    }
                  })();
                }}
              />
            ) : (
              <div className="grid shrink-0 grid-cols-1 gap-2 @md:grid-cols-3">
                <Button
                  color="module-inventory"
                  size="lg"
                  className={`${TOUCH} @md:col-span-1`}
                  disabled={confirm.isPending}
                  onClick={() => {
                    void (async () => {
                      try {
                        const result = await confirm.mutateAsync({ lineId: current.id });
                        playScanFeedback('applied');
                        say(result.message, 'success');
                      } catch (err) {
                        say(pickErrorMessage(err, 'Could not confirm that.'), 'danger');
                      }
                    })();
                  }}
                >
                  <Icon glyph={faCheck} className="size-5" aria-hidden />
                  Got all {current.quantity - current.pickedQuantity}
                </Button>

                <Button
                  color="danger"
                  variant="outline"
                  size="lg"
                  className={TOUCH}
                  onClick={() => {
                    setShorting(true);
                  }}
                >
                  <Icon glyph={faXmark} className="size-5" aria-hidden />
                  Not there
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className={TOUCH}
                  disabled={skip.isPending}
                  onClick={() => {
                    void (async () => {
                      try {
                        const result = await skip.mutateAsync(current.id);
                        say(result.message, 'warning');
                      } catch (err) {
                        say(pickErrorMessage(err, 'Could not skip that.'), 'danger');
                      }
                    })();
                  }}
                >
                  <Icon glyph={faForwardStep} className="size-5" aria-hidden />
                  Come back to it
                </Button>
              </div>
            )}

            {skipped.length > 0 ? (
              <Text className="text-sm">
                {plural(skipped.length, 'line', 'lines')} left for later. They come back round once
                the rest are done.
              </Text>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The one instruction, in the order a picker needs it.
 *
 * SHELF first and biggest — the first question in an aisle is always "am I in
 * the right place", and it has to be readable from further away than the product
 * name. Then the item. Then the count, which is the last thing you check and the
 * one you check twice.
 */
function InstructionCard({ line, usesBins }: { line: PickLine; usesBins: boolean }) {
  const remaining = line.quantity - line.pickedQuantity;
  return (
    <Card>
      <div className="flex flex-col gap-4 p-4">
        {usesBins ? (
          <span className="flex flex-col">
            <Text className="text-sm">Go to</Text>
            <span className="font-mono text-4xl leading-tight font-bold">
              {line.binCode ?? 'Anywhere here'}
            </span>
            {line.binZone ? <Text className="text-sm">Zone {line.binZone}</Text> : null}
          </span>
        ) : null}

        <span className="flex flex-col">
          <Text className="text-sm">Take</Text>
          <span className="text-2xl leading-tight font-semibold">{line.productTitle}</span>
          <span className="font-mono text-sm">{line.sku}</span>
          {line.variantTitle ? <Text className="text-sm">{line.variantTitle}</Text> : null}
        </span>

        <span className="flex flex-wrap items-center gap-3">
          <span className="flex flex-col">
            <Text className="text-sm">How many</Text>
            <span className="text-5xl leading-none font-bold tabular-nums">{remaining}</span>
          </span>
          <span className="flex flex-col gap-1">
            <Badge color="module-commerce" variant="soft" size="lg">
              For {line.orderNumber}
            </Badge>
            {line.lotNumber ? (
              // FEFO chose this batch. Saying WHICH lets the picker check the box
              // in their hand against it, which is the entire point of tracking
              // lots — an expiry date nobody reads at the shelf is a date that
              // ships anyway.
              <Badge color="warning" variant="soft" size="lg">
                Batch {line.lotNumber}
              </Badge>
            ) : null}
          </span>
        </span>

        {line.primaryBarcode ? (
          <Text className="text-sm">
            The code on it should read <span className="font-mono">{line.primaryBarcode}</span>.
          </Text>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Saying what happened.
 *
 * Reason FIRST, quantity second, because the overwhelmingly common case is "none
 * of them were there" and making somebody type a zero before they can say why is
 * a step that exists only for the database.
 */
function ShortPanel({
  busy,
  max,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  max: number;
  onCancel: () => void;
  onSubmit: (input: { quantity?: number; reason: ShortPickReason; note?: string }) => void;
}) {
  const [reason, setReason] = useState<ShortPickReason>('not_found');
  const [found, setFound] = useState(0);
  const [note, setNote] = useState('');

  const hint = SHORT_REASONS.find((r) => r.value === reason)?.hint ?? '';

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <span className="flex flex-col">
          <Text className="text-sm">What happened</Text>
          <NativeSelect
            size="lg"
            className={TOUCH}
            aria-label="Why the items were not there"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value as ShortPickReason);
            }}
          >
            {SHORT_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <Text className="mt-1 text-sm">{hint}</Text>
        </span>

        <span className="flex flex-col">
          <Text className="text-sm">How many DID you find? (of {max})</Text>
          <NativeSelect
            size="lg"
            className={TOUCH}
            aria-label="How many you found"
            value={String(found)}
            onChange={(event) => {
              setFound(Number(event.target.value));
            }}
          >
            {Array.from({ length: max }, (_, index) => index).map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'None of them' : String(n)}
              </option>
            ))}
          </NativeSelect>
        </span>

        {reason === 'other' ? (
          <Textarea
            rows={2}
            placeholder="Say what happened"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        ) : null}

        <Alert color="info">
          <AlertContent>
            <AlertDescription>
              The units you could not find go back into stock and are held for this order, so nobody
              else can buy them. The shelf goes on a count so somebody settles what is really there.
            </AlertDescription>
          </AlertContent>
        </Alert>

        <span className="flex flex-wrap gap-2">
          <Button
            color="danger"
            size="lg"
            className={TOUCH}
            disabled={busy}
            onClick={() => {
              onSubmit({
                ...(found > 0 ? { quantity: found } : {}),
                reason,
                ...(note.trim() ? { note: note.trim() } : {}),
              });
            }}
          >
            Record it
          </Button>
          <Button variant="ghost" size="lg" className={TOUCH} onClick={onCancel}>
            Cancel
          </Button>
        </span>
      </div>
    </Card>
  );
}

/** The end of the walk, and the one thing anybody wants next: a box. */
function FinishedPanel({
  walk,
  ctx,
  skipped,
}: {
  walk: {
    id: string;
    number: string;
    shortCount: number;
    orders: { orderId: string; orderNumber: string }[];
  };
  ctx: SurfaceContext;
  skipped: PickLine[];
}) {
  if (skipped.length > 0) {
    return (
      <Alert color="warning">
        <AlertContent>
          <AlertTitle>{plural(skipped.length, 'line', 'lines')} still to come back to</AlertTitle>
          <AlertDescription>
            Everything else is done. Go back for {skipped.map((l) => l.sku).join(', ')} — the walk
            finishes when they are picked or marked as not there.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert color="success" variant="soft">
        <AlertContent>
          <AlertTitle>
            <Icon glyph={faPartyHorn} className="mr-1 inline size-5" aria-hidden />
            Walk {walk.number} is done
          </AlertTitle>
          <AlertDescription>
            {walk.shortCount > 0
              ? `${plural(walk.shortCount, 'line', 'lines')} came up short — those shelves are on a count now. Everything else is on the trolley.`
              : 'Everything was found. Take the trolley to the pack bench.'}
          </AlertDescription>
        </AlertContent>
      </Alert>

      {walk.orders.map((order) => (
        <Button
          key={order.orderId}
          color="module-inventory"
          size="lg"
          className={TOUCH}
          onClick={() => {
            ctx.open('inventory.packing.bench', {
              orderId: order.orderId,
              pickListId: walk.id,
            });
          }}
        >
          <Icon glyph={faBox} className="size-5" aria-hidden />
          Pack {order.orderNumber}
          <Icon glyph={faArrowRight} className="size-5" aria-hidden />
        </Button>
      ))}
    </div>
  );
}
