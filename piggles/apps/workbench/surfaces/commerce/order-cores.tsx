'use client';

// The core on one order line (issues 051, 057): its kind, where it stands, and
// the counter's moves. The Cores owed list offers the same moves (core-line-words.ts).

import { useState } from 'react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { type OrderItem } from './data';
import { coreLineOfItem, type CoreLine } from './cores-data';
import { coreBadges, coreMoves, coreSummary, moveLabel, type CoreMove } from './core-line-words';
import { ReceiveCoresModal } from './order-cores-receive';
import { KeepDepositsModal } from './order-cores-keep';
import { OldPartArrivedModal } from './order-cores-arrived';
import { ReleaseHoldModal } from './order-cores-release';

/** Getting the old part in is the common move; shipping without waiting lets
 *  goods go with nothing held; keeping a deposit is quiet bookkeeping. */
const MOVE_LOOK: Record<CoreMove, { color?: string; variant: 'outline' | 'ghost' }> = {
  receive: { color: 'module', variant: 'outline' },
  release: { color: 'warning', variant: 'outline' },
  keep: { variant: 'ghost' },
};

export function CoreBadges({ line }: { line: CoreLine }) {
  return (
    <>
      {coreBadges(line).map((badge) => (
        <Badge key={badge.label} color={badge.tone} variant="soft" size="sm">
          {badge.label}
        </Badge>
      ))}
    </>
  );
}

/** `stopPropagation` is for a clickable row: a move is not "open the order". */
export function CoreMoveButtons({
  line,
  onMove,
  stopPropagation = false,
}: {
  line: CoreLine;
  onMove: (move: CoreMove) => void;
  stopPropagation?: boolean;
}) {
  return (
    <>
      {coreMoves(line).map((move) => (
        <Button
          key={move}
          size="sm"
          variant={MOVE_LOOK[move].variant}
          {...(MOVE_LOOK[move].color ? { color: MOVE_LOOK[move].color } : {})}
          onClick={(event) => {
            if (stopPropagation) event.stopPropagation();
            onMove(move);
          }}
          onKeyDown={(event) => {
            if (stopPropagation) event.stopPropagation();
          }}
        >
          {moveLabel(line, move)}
        </Button>
      ))}
    </>
  );
}

/** Drawn OUTSIDE any clickable row: a click in a portal bubbles up the React
 *  tree, so a dialog inside a row would open the order on every click. */
export function CoreMoveDialog({
  line,
  move,
  onClose,
}: {
  line: CoreLine;
  move: CoreMove | null;
  onClose: () => void;
}) {
  return (
    <>
      {line.coreFirst ? (
        <OldPartArrivedModal line={line} open={move === 'receive'} onClose={onClose} />
      ) : (
        <ReceiveCoresModal line={line} open={move === 'receive'} onClose={onClose} />
      )}
      <KeepDepositsModal line={line} open={move === 'keep'} onClose={onClose} />
      <ReleaseHoldModal line={line} open={move === 'release'} onClose={onClose} />
    </>
  );
}

/** The core line under a part, with its state and moves. Nothing for a part
 *  sold without a core. */
export function OrderLineCore({
  item,
  currency,
  customerName,
}: {
  item: OrderItem;
  currency: string;
  customerName: string;
}) {
  const [move, setMove] = useState<CoreMove | null>(null);
  if (item.coreCharge === null && !item.coreFirst) return null;

  const line = coreLineOfItem(item, currency, customerName);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm">{coreSummary(item, currency)}</span>
      <div className="flex flex-wrap items-center gap-2">
        <CoreBadges line={line} />
        <CoreMoveButtons line={line} onMove={setMove} />
      </div>
      <CoreMoveDialog
        line={line}
        move={move}
        onClose={() => {
          setMove(null);
        }}
      />
    </div>
  );
}
