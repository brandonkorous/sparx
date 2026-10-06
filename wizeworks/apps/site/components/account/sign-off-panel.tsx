'use client';

// Where a held order's sign-off stands, on the account's order page, and the
// approver's Approve and Turn down (sparx persona issue 087).
//
// Everyone on the account who can see the order reads who it is waiting on and
// who has already said yes. The account's approver, on someone else's order
// while the account is still asked, also gets the two decisions. Turning it
// down cancels the order, so it asks first, naming the order and whoever placed
// it. What the decision did is said by the page afterwards, because this panel
// goes once the order is no longer held. That includes part of the order
// following later when the yes placed it short of stock.

import { useState } from 'react';

import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Label,
  Textarea,
} from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { AccountError, decideAccountOrder, type B2bOrderDetail } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import {
  decisionResultSentence,
  followsLaterSentence,
  overLimitSentence,
  signedSentences,
  signOffWaitingSentence,
} from '@/lib/sign-off-words';

type HeldOrder = B2bOrderDetail & { signOff: NonNullable<B2bOrderDetail['signOff']> };

export interface DecisionOutcome {
  sentence: string;
  approved: boolean;
  followsLater: string | null;
}

export function SignOffPanel({
  tenantSlug,
  accountId,
  order,
  onDecided,
}: {
  tenantSlug: string;
  accountId: string;
  order: HeldOrder;
  /** What the decision did, in a sentence, and whether it was a yes.
   *  `followsLater` is set when part of the placed order was not in stock. */
  onDecided: (outcome: DecisionOutcome) => void;
}) {
  const { signOff } = order;
  // The approver reading this is told "your approval", never their own name.
  const viewerId = useCustomer().customer?.id ?? null;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overLimit = overLimitSentence(signOff.limitCents, order.currency);
  const signed = signedSentences(signOff, null, viewerId);
  const placedBy = order.placedBy ?? 'the person who placed it';
  const total = formatMoney(order.totals.totalCents, order.currency);

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      const result = await decideAccountOrder(
        tenantSlug,
        accountId,
        order.id,
        decision,
        reason.trim() || undefined
      );
      onDecided({
        approved: decision === 'approve',
        sentence: decisionResultSentence({
          decision: decision === 'approve' ? 'approved' : 'turned_down',
          orderNumber: result.orderNumber,
          status: result.status,
          ...(result.waitingOn ? { waitingOn: result.waitingOn } : {}),
        }),
        followsLater: decision === 'approve' ? followsLaterSentence(result.stock) : null,
      });
    } catch (err) {
      // The server's own words: "You placed this order, so someone else on the
      // account has to approve it", "Ana Ruiz has already approved this order".
      setError(
        err instanceof AccountError && err.status < 500
          ? err.message
          : 'Your decision could not be saved just now. Please try again.'
      );
      setBusy(false);
    }
  }

  return (
    <div className="card border-warning gap-3 border p-4">
      <h2 className="text-base-content m-0 text-xl font-semibold">
        {signOffWaitingSentence(signOff, null, viewerId)}
      </h2>
      {overLimit || signed.length > 0 ? (
        <div className="text-base-content flex flex-col gap-1">
          {overLimit ? <p className="m-0">{overLimit}</p> : null}
          {signed.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {signOff.canDecide ? (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sign-off-reason">Your reason (optional)</Label>
            <Textarea
              id="sign-off-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              disabled={busy}
            />
            <span className="text-base-content text-sm">
              We keep this with your decision on the order.
            </span>
          </div>
          {error ? (
            <Alert color="danger" role="alert">
              {error}
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              color="primary"
              disabled={busy}
              onClick={() => void decide('approve')}
            >
              {busy ? 'Saving…' : `Approve order ${order.orderNumber}`}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger>
                {/* Outline: Approve is what this panel exists for, and on a
                    theme whose brand color is red two solid buttons read as
                    equals. The dialog's own button is the solid one. */}
                <Button type="button" color="danger" variant="outline" disabled={busy}>
                  Turn down
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>Turn down order {order.orderNumber}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cancels {placedBy}’s order {order.orderNumber} for {total}. It will not go
                  ahead, and it cannot be undone. To buy these items, someone would have to place a
                  new order.
                </AlertDialogDescription>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <AlertDialogCancel>
                    <Button type="button" variant="ghost">
                      Keep it
                    </Button>
                  </AlertDialogCancel>
                  <AlertDialogAction color="danger" onClick={() => void decide('reject')}>
                    Turn down order {order.orderNumber}
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      ) : null}
    </div>
  );
}
