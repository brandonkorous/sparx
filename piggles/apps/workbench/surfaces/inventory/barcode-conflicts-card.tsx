'use client';

// One shared barcode on the Shared barcodes screen: the code, the item waiting
// for it, the item scanning brings up now, and the two answers that end it.

import { Badge, Button, Card, CardBody, Text, Tooltip } from '@wizeworks/silicaui-react';
import { faArrowRightArrowLeft, faEraser } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { BarcodeConflict } from './scan-data';

interface ConflictCardProps {
  row: BarcodeConflict;
  busy: boolean;
  onTake: () => void;
  onClear: () => void;
  onOpenItem: () => void;
}

function ConflictClaimants({ row }: { row: BarcodeConflict }) {
  return (
    <div className="grid gap-2 @lg:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Text className="text-sm">Not scannable. This item is the one waiting</Text>
        <span className="font-medium">{row.productTitle}</span>
        <span className="font-mono text-sm">{row.sku}</span>
      </div>
      <div className="flex flex-col gap-1">
        <Text className="text-sm">Scanning it currently brings up</Text>
        <span className="font-medium">{row.heldByProductTitle ?? 'Unknown item'}</span>
        <span className="font-mono text-sm">{row.heldBySku ?? ''}</span>
      </div>
    </div>
  );
}

function ConflictActions({ row, busy, onTake, onClear, onOpenItem }: ConflictCardProps) {
  return (
    <span className="flex flex-wrap gap-2">
      <Tooltip content="The code belongs to this item: move it here">
        <Button color="module-inventory" size="sm" disabled={busy} onClick={onTake}>
          <Icon glyph={faArrowRightArrowLeft} className="size-4" aria-hidden />
          {row.productTitle} owns it
        </Button>
      </Tooltip>
      <Tooltip content="This item never had this code: drop the claim">
        <Button variant="outline" color="danger" size="sm" disabled={busy} onClick={onClear}>
          <Icon glyph={faEraser} className="size-4" aria-hidden />
          Remove it from this item
        </Button>
      </Tooltip>
      <Button variant="ghost" color="neutral" size="sm" onClick={onOpenItem}>
        Open the item
      </Button>
    </span>
  );
}

// Plain, not tinted. Every row on this screen is a conflict, so a wall of red
// backgrounds would distinguish nothing; the color goes on the badge and actions.
export function BarcodeConflictCard(props: ConflictCardProps) {
  const { row } = props;
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-lg font-semibold">{row.value}</span>
          <Badge color="danger" variant="soft" size="sm">
            Claimed twice
          </Badge>
        </span>
        <ConflictClaimants row={row} />
        <ConflictActions {...props} />
      </CardBody>
    </Card>
  );
}
