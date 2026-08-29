'use client';

// Ask to send something back. The shopper half of the RMA the model always had
// (`requestedBy: 'customer'`) and no screen ever offered.
//
// One page, one job: pick the lines, say why, say whether you want the money or
// a swap, send. Everything after that is the shop's — this never promises an
// outcome, because approving a return is their decision and their policy.

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import {
  getReturnable,
  requestReturn,
  AccountError,
  type OrderReturnability,
} from '@/lib/customer-client';
import { Alert, Button, NativeSelect, Textarea } from '@wizeworks/silicaui-react';

import { ReturnLineRow, type LinePick } from './line-row';

export default function RequestReturnPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ orderId: string }>();
  const router = useRouter();

  const [state, setState] = useState<OrderReturnability | null>(null);
  const [picks, setPicks] = useState<Record<string, LinePick>>({});
  const [outcome, setOutcome] = useState<'refund' | 'exchange'>('refund');
  const [note, setNote] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getReturnable(tenantSlug, params.orderId)
      .then((r) => active && setState(r))
      .catch((err) =>
        active
          ? setLoadError(
              err instanceof AccountError && err.status === 404
                ? 'We could not find that order.'
                : 'We could not load this order just now.'
            )
          : null
      );
    return () => {
      active = false;
    };
  }, [tenantSlug, params.orderId]);

  const chosen = Object.entries(picks).filter(([, p]) => p.quantity > 0);
  const canSend = chosen.length > 0 && chosen.every(([, p]) => p.reasonCode !== null);

  async function send() {
    setSending(true);
    setSendError(null);
    try {
      const created = await requestReturn(tenantSlug, {
        orderId: params.orderId,
        preferredOutcome: outcome,
        // `flatMap` rather than a cast: `canSend` already guarantees every chosen
        // line has a reason, and narrowing here says so to the type system instead
        // of asserting it away.
        items: chosen.flatMap(([orderItemId, p]) =>
          p.reasonCode === null
            ? []
            : [
                {
                  orderItemId,
                  quantity: p.quantity,
                  reasonCode: p.reasonCode,
                  ...(note.trim() ? { customerNote: note.trim() } : {}),
                },
              ]
        ),
      });
      router.push(`/account/returns/${created.id}`);
    } catch (err) {
      // The server re-checks what is left, so this is a real answer rather than a
      // generic failure — show what it said.
      setSendError(err instanceof AccountError ? err.message : 'We could not send that just now.');
      setSending(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <Alert color="danger" role="alert">
          {loadError}
        </Alert>
        <Button render={<Link href="/account/orders" />} className="mt-4">
          ← Back to your orders
        </Button>
      </div>
    );
  }
  if (!state) return <div className="skeleton h-80" />;

  // Not a dead end: say WHY there is nothing to do here, and where to go instead.
  if (!state.eligible) {
    return (
      <div>
        <h1 className="text-base-content mb-3 text-3xl font-semibold tracking-tight">
          Send something back
        </h1>
        <Alert color="info">
          {state.reason === 'not_sent_yet'
            ? 'This order has not been sent out yet, so there is nothing to send back. Once it is on its way you can start a return here.'
            : 'You have already asked to send back everything on this order.'}
        </Alert>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button render={<Link href={`/account/orders/${params.orderId}`} />}>
            Back to this order
          </Button>
          <Button render={<Link href="/account/returns" />} color="primary" variant="soft">
            See your returns
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/account/orders/${params.orderId}`} className="link link-hover text-sm">
        ← Back to this order
      </Link>
      <h1 className="text-base-content mt-2 mb-1 text-3xl font-semibold tracking-tight">
        Send something back
      </h1>
      <p className="text-base-content mb-6">
        Choose what you would like to return and tell us why. We will look at it and come back to
        you — nothing is charged or refunded until we do.
      </p>

      <div className="flex flex-col gap-3">
        {state.lines
          .filter((line) => line.returnableQuantity > 0)
          .map((line) => (
            <ReturnLineRow
              key={line.orderItemId}
              line={line}
              pick={picks[line.orderItemId] ?? { quantity: 0, reasonCode: null }}
              onChange={(pick) => setPicks((prev) => ({ ...prev, [line.orderItemId]: pick }))}
            />
          ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-base-content font-medium">What would you like to happen?</span>
          <NativeSelect
            value={outcome}
            onChange={(e) =>
              setOutcome(e.currentTarget.value === 'exchange' ? 'exchange' : 'refund')
            }
            className="max-w-sm"
          >
            <option value="refund">Refund my money</option>
            <option value="exchange">Swap it for another</option>
          </NativeSelect>
          <span className="text-base-content text-sm">
            {outcome === 'exchange'
              ? 'Tell us below which size or color you would like instead.'
              : 'We will put the money back the way you paid.'}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base-content font-medium">
            Anything else we should know? <span className="font-normal">(optional)</span>
          </span>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            rows={3}
            maxLength={2000}
            className="max-w-xl"
            placeholder="A size up in the same color, if you have it."
          />
        </label>
      </div>

      {sendError ? (
        <Alert color="danger" role="alert" className="mt-5">
          {sendError}
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          color="primary"
          size="lg"
          onClick={() => void send()}
          disabled={!canSend || sending}
        >
          {sending ? 'Sending…' : 'Send this request'}
        </Button>
        <Button render={<Link href={`/account/orders/${params.orderId}`} />} variant="ghost">
          Cancel
        </Button>
      </div>
      {!canSend ? (
        <p className="text-base-content mt-3 text-sm">
          {chosen.length === 0
            ? 'Choose at least one item to send back.'
            : 'Tell us why for each item you chose.'}
        </p>
      ) : null}

      <p className="text-base-content mt-8 text-sm">
        Our{' '}
        <Link href="/returns-policy" className="link">
          returns policy
        </Link>{' '}
        explains what we can take back and how long you have.
      </p>
    </div>
  );
}
