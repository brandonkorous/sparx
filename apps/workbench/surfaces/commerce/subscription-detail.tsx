'use client';

// One repeat order — what's delivered, what it's worth, what has happened to
// it, and the levers that change it.
//
// This is a TRANSACTION-shaped detail: a standing arrangement with a customer,
// so it keeps a real identity heading (whose it is, and its state) rather than
// an editable name. Nothing here is a draft — there is no Save. The lifecycle
// verbs (pause, resume, stop) are their OWN confirmed actions, because each one
// changes what a real customer is charged and sent, and batching them behind a
// Save is exactly how that goes wrong.
//
// Pause and resume are the routine lever and sit up top. Stopping is rare and
// hard to undo, so it sits in a plain row after the work, under a divider —
// never at the same weight as the thing someone opened this to check.

import { useEffect } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Heading,
  Text,
  Timestamp,
  useImperativeAlertDialog,
  useToast,
} from '@wizeworks/silicaui-react';
import { CreditCard, Pause, Play, Repeat2, Square } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, formatDate, productErrorMessage, subscriptionState } from './products-data';
import {
  cadenceLabel,
  dunningOutcomeState,
  subscriptionEventLabel,
  useCancelSubscription,
  usePauseSubscription,
  useResumeSubscription,
  useSubscription,
  type SubscriptionDetail,
} from './subscriptions-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/** A headline number with the sentence that stops it being misread. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Text as="span" className="text-2xl font-semibold">
        {value}
      </Text>
      <Text className="text-sm">{label}</Text>
    </div>
  );
}

function DetailBody({ sub }: { sub: SubscriptionDetail }) {
  const toast = useToast();
  const confirm = useImperativeAlertDialog();
  const pause = usePauseSubscription(sub.id);
  const resume = useResumeSubscription(sub.id);
  const cancel = useCancelSubscription(sub.id);

  const state = subscriptionState(sub.status);
  const customer = sub.customerName ?? 'A customer';
  const cadence = cadenceLabel(sub.intervalUnit, sub.intervalCount);
  const stopped = sub.status === 'cancelled';
  const paused = sub.status === 'paused';

  const failed = (title: string) => (error: unknown) => {
    toast.add({
      title,
      description: productErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };

  const onPause = () => {
    void (async () => {
      const ok = await confirm({
        title: `Pause ${customer}'s repeat order?`,
        description:
          'No more deliveries go out and no more payments are taken until you resume it. Nothing is cancelled — you can start it again at any time.',
        confirmLabel: 'Pause it',
        cancelLabel: 'Leave it running',
      });
      if (!ok) return;
      pause.mutate(
        {},
        {
          onSuccess: () => {
            toast.add({ title: 'Repeat order paused', type: 'success' });
          },
          onError: failed('Could not pause this repeat order'),
        }
      );
    })();
  };

  const onResume = () => {
    resume.mutate(undefined, {
      onSuccess: () => {
        toast.add({ title: 'Repeat order resumed', type: 'success' });
      },
      onError: failed('Could not resume this repeat order'),
    });
  };

  const onStop = () => {
    void (async () => {
      const ok = await confirm({
        title: `Stop ${customer}'s repeat order?`,
        description: `It will not renew again, so no further deliveries go out and no more payments are taken. This can't be undone — ${customer} would have to set up a new repeat order to start again. Past orders are unaffected.`,
        confirmLabel: 'Stop it',
        cancelLabel: 'Keep it',
        color: 'danger',
      });
      if (!ok) return;
      cancel.mutate(
        { atPeriodEnd: true },
        {
          onSuccess: () => {
            toast.add({ title: 'Repeat order stopped', type: 'success' });
          },
          onError: failed('Could not stop this repeat order'),
        }
      );
    })();
  };

  return (
    <div className={COLUMN}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Heading level={1} className="text-2xl font-semibold">
            {customer}
          </Heading>
          <Badge color={state.tone} variant="soft">
            {state.label}
          </Badge>
        </div>
        <Text className="text-sm">
          A repeat order delivered {cadence}
          {sub.deliveriesPerCycle > 1
            ? `, ${String(sub.deliveriesPerCycle)} deliveries each time`
            : ''}
          .
        </Text>

        {/* The routine lever — pause a running one, resume a paused one. Not
            offered on a stopped order, which has nothing to pause or resume. */}
        {!stopped ? (
          <div className="flex flex-wrap items-center gap-2">
            {paused ? (
              <Button size="sm" color="module" loading={resume.isPending} onClick={onResume}>
                <Play className="size-4" aria-hidden />
                Resume it
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                color="neutral"
                loading={pause.isPending}
                onClick={onPause}
              >
                <Pause className="size-4" aria-hidden />
                Pause it
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {sub.status === 'past_due' ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>A payment failed</AlertTitle>
            <AlertDescription>
              The last charge for this repeat order did not go through, so deliveries are on hold
              until it is paid. It is worth reaching out to {customer} to update their card.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <FormSection title="What it's worth">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Figure
            value={formatCents(sub.monthlyRecurringRevenueCents, sub.currency)}
            label="a month, while it keeps running"
          />
          <Figure
            value={sub.nextOccurrenceAt ? formatDate(sub.nextOccurrenceAt) : '—'}
            label={paused ? 'next delivery once resumed' : 'next delivery'}
          />
          <Figure value={sub.startedAt ? formatDate(sub.startedAt) : '—'} label="started" />
        </div>
        {paused && sub.pausedUntil ? (
          <Text className="text-sm">
            Set to resume on its own on {formatDate(sub.pausedUntil)}.
          </Text>
        ) : null}
      </FormSection>

      <FormSection title="What is delivered each time">
        <div className="flex flex-col gap-3">
          {sub.items.map((item) => (
            <div
              key={item.id}
              className="border-base-300 flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                {/* The line carries the variant, not the product id, so the
                    product name is shown, not linked — there is nothing reliable
                    to open it by. */}
                <Text as="span" className="min-w-0 truncate font-medium">
                  {item.productTitle ?? item.variantSku ?? 'A product'}
                </Text>
                <Text className="text-sm">
                  {item.quantity === 1 ? '1 each time' : `${String(item.quantity)} each time`}
                  {item.variantSku ? ` · ${item.variantSku}` : ''}
                  {item.addonOfName ? ` · added on to ${item.addonOfName}` : ''}
                </Text>
              </div>
              <Text as="span" className="font-medium tabular-nums">
                {formatCents(item.unitPriceCents, sub.currency)}
              </Text>
            </div>
          ))}
        </div>
      </FormSection>

      {sub.dunningAttempts.length > 0 ? (
        <FormSection
          title="Payment attempts"
          description="Every time we tried to take a payment for this repeat order, and how it went."
        >
          <div className="flex flex-col gap-3">
            {sub.dunningAttempts.map((attempt) => {
              const outcome = dunningOutcomeState(attempt.outcome);
              return (
                <div
                  key={attempt.id}
                  className="border-base-300 flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CreditCard className="size-4 shrink-0" aria-hidden />
                      <Text as="span" className="font-medium">
                        Attempt {attempt.attemptNumber}
                      </Text>
                      <Badge color={outcome.tone} variant="soft" size="sm">
                        {outcome.label}
                      </Badge>
                    </div>
                    <Text className="text-sm">
                      <Timestamp value={attempt.attemptedAt} format="relative" />
                      {attempt.failureReason ? ` · ${attempt.failureReason}` : ''}
                      {attempt.nextRetryAt
                        ? ` · will try again ${formatDate(attempt.nextRetryAt)}`
                        : ''}
                    </Text>
                  </div>
                </div>
              );
            })}
          </div>
        </FormSection>
      ) : null}

      {sub.events.length > 0 ? (
        <FormSection title="History">
          <div className="flex flex-col gap-3">
            {sub.events.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2">
                <Text as="span" className="font-medium">
                  {subscriptionEventLabel(event.event)}
                </Text>
                <Text as="span" className="text-sm">
                  <Timestamp value={event.occurredAt} format="relative" />
                </Text>
              </div>
            ))}
          </div>
        </FormSection>
      ) : null}

      {/* Stopping is rare and hard to undo, so it lives after the work, under a
          divider, at a quieter weight than the pause lever above. */}
      {!stopped ? (
        <div className="border-base-300 flex flex-col gap-2 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Text as="span" className="font-medium">
                Stop this repeat order
              </Text>
              <Text className="text-sm">
                Ends it for good. If they just want a break, pause it instead.
              </Text>
            </div>
            <Button
              size="sm"
              variant="outline"
              color="danger"
              loading={cancel.isPending}
              onClick={onStop}
            >
              <Square className="size-4" aria-hidden />
              Stop it
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-base-300 flex items-center gap-2 border-t pt-4">
          <Text className="text-sm">
            This repeat order was stopped
            {sub.cancelledAt ? (
              <>
                {' '}
                <Timestamp value={sub.cancelledAt} format="relative" />
              </>
            ) : null}
            . Past orders from it are unaffected.
          </Text>
        </div>
      )}
    </div>
  );
}

export function SubscriptionDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';
  const { data: sub, isPending, isError, refetch, isFetching, dataUpdatedAt } = useSubscription(id);

  const customerName = sub?.customerName ?? null;
  useEffect(() => {
    if (customerName) ctx.setTitle(`${customerName} · repeat order`);
  }, [ctx, customerName]);

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Repeat order actions">
        <Repeat2 className="size-4 shrink-0" aria-hidden />
        <Heading level={2} className="min-w-0 truncate text-base font-semibold">
          {sub?.customerName ?? 'Repeat order'}
        </Heading>
        <RefreshButton
          className="ml-auto"
          isFetching={isFetching}
          updatedAt={sub ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <div className="flex h-full items-center justify-center p-8">
            <Alert color="error" variant="soft" className="max-w-md">
              <AlertContent>
                <AlertTitle>Could not load this repeat order</AlertTitle>
                <AlertDescription>
                  This is a problem reaching the server. The repeat order itself is unaffected —
                  nothing has been changed or lost.
                </AlertDescription>
              </AlertContent>
              <Button
                size="sm"
                color="error"
                variant="soft"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            </Alert>
          </div>
        ) : isPending || !sub ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : (
          <div className="py-1">
            <DetailBody sub={sub} />
          </div>
        )}
      </div>
    </div>
  );
}
