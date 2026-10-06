'use client';

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faCheckCircle } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { holdReasonWords } from '../approval-hold-notice';
import {
  formatCents,
  formatDateTime,
  formatDay,
  queueBuyer,
  type QueueItem,
} from '../approvals-data';
import { queueSignOffView } from '../sign-off-words';

export function QueueRow({
  item,
  onOpen,
  onApprove,
  onReject,
}: {
  item: QueueItem;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  // Who it waits on (sparx persona issue 087). An order only the customer is
  // asked about is not this business's to approve, so Approve is not offered:
  // a button the server answers with a refusal is worse than none.
  const signOff = queueSignOffView(item.signOff, item.companyName, formatDay);
  return (
    <li className="border-base-300 flex flex-col gap-3 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <button
          type="button"
          className="link link-hover font-mono text-sm"
          onClick={(event) => {
            onOpen(event);
          }}
        >
          {item.orderNumber}
        </button>
        <span className="min-w-0 flex-1 font-medium">{queueBuyer(item)}</span>
        <Text as="span" className="font-semibold tabular-nums">
          {formatCents(item.totalCents, item.currency)}
        </Text>
      </div>
      <QueueRowWhy item={item} signOff={signOff} />
      <QueueRowFooter item={item} signOff={signOff} onApprove={onApprove} onReject={onReject} />
    </li>
  );
}

// Why it is waiting and who on: over a spending limit, over the account's credit,
// or both (sparx persona issue 085), with the sign-off badges and next step.
function QueueRowWhy({
  item,
  signOff,
}: {
  item: QueueItem;
  signOff: ReturnType<typeof queueSignOffView>;
}) {
  return (
    <>
      {item.holdReasons.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {item.holdReasons.map((reason) => (
            <li key={reason.kind}>{holdReasonWords(reason, formatCents, item.currency)}</li>
          ))}
        </ul>
      ) : null}
      {signOff.badges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {signOff.badges.map((badge) => (
            <Badge key={badge.label} color={badge.tone} variant="soft" size="sm">
              {badge.label}
            </Badge>
          ))}
        </div>
      ) : null}
      {signOff.line ? <p>{signOff.line}</p> : null}
    </>
  );
}

function QueueRowFooter({
  item,
  signOff,
  onApprove,
  onReject,
}: {
  item: QueueItem;
  signOff: ReturnType<typeof queueSignOffView>;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Text as="span" className="text-sm">
        Placed {formatDateTime(item.createdAt)}
      </Text>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" color="danger" onClick={onReject}>
          Reject
        </Button>
        {signOff.canApprove ? (
          <Button size="sm" color="module" onClick={onApprove}>
            <Icon glyph={faCheckCircle} className="size-4" aria-hidden />
            Approve
          </Button>
        ) : null}
      </div>
    </div>
  );
}
