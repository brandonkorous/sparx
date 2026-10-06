'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Textarea,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../../lib/dock/window-boundary';
import { formatCents, formatDay, queueBuyer, type QueueItem } from '../approvals-data';
import {
  approveWords,
  rejectWords,
  type ApprovedStockNotice,
  type DecisionFacts,
} from '../sign-off-words';
import { type Decision } from './shared';
import { useDecisionSubmit } from './decision-submit';

/** The facts both decision dialogs are worded from. */
function decisionFacts(item: QueueItem): DecisionFacts {
  return {
    orderNumber: item.orderNumber,
    buyer: queueBuyer(item),
    total: formatCents(item.totalCents, item.currency),
    companyName: item.companyName,
    signOff: item.signOff,
    overCreditLimit: item.holdReasons.some((reason) => reason.kind === 'over_credit_limit'),
  };
}

export function DecisionDialog({
  decision,
  onDone,
  onStockShort,
}: {
  decision: NonNullable<Decision>;
  onDone: () => void;
  /** Placing it took stock the shelves did not have (sparx persona issue 087). */
  onStockShort: (notice: ApprovedStockNotice) => void;
}) {
  const [reason, setReason] = useState('');
  const { submit, pending } = useDecisionSubmit(decision, reason, onDone, onStockShort);

  const isApprove = decision.action === 'approve';
  const { item } = decision;
  const facts = decisionFacts(item);

  return (
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onDone();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>{decisionTitle(isApprove, item)}</DialogTitle>
          <DialogDescription>
            {isApprove ? approveWords(facts) : rejectWords(facts, formatDay)}
          </DialogDescription>

          <ReasonField isApprove={isApprove} reason={reason} setReason={setReason} />
          <DecisionFooter isApprove={isApprove} pending={pending} submit={submit} />
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

function decisionTitle(isApprove: boolean, item: QueueItem): string {
  return !isApprove
    ? 'Reject this order?'
    : item.signOff.waitingOn.includes('account')
      ? 'Approve your side of this order?'
      : 'Approve this order?';
}

function ReasonField({
  isApprove,
  reason,
  setReason,
}: {
  isApprove: boolean;
  reason: string;
  setReason: (next: string) => void;
}) {
  return (
    <div className="py-2">
      <Field>
        <FieldLabel>Reason</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={2}
              value={reason}
              placeholder={
                isApprove
                  ? 'Optional: noted against the order.'
                  : 'Optional: why it was turned down.'
              }
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>Kept on the order&apos;s history.</FieldDescription>
      </Field>
    </div>
  );
}

function DecisionFooter({
  isApprove,
  pending,
  submit,
}: {
  isApprove: boolean;
  pending: boolean;
  submit: () => void;
}) {
  return (
    <DialogFooter>
      <DialogClose>
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
      </DialogClose>
      <Button color={isApprove ? 'module' : 'danger'} size="sm" loading={pending} onClick={submit}>
        {isApprove ? 'Approve order' : 'Reject order'}
      </Button>
    </DialogFooter>
  );
}
