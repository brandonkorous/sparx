'use client';

// Drafting purchase orders out of the lines you chose. The bar itself is the
// house one; only the actions in it are reorder's.

import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { BulkBar } from '../../components/bulk-bar';
import { faCartShopping } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { plural } from './data';
import type { ReorderSelection } from './reorder-selection';

export function ReorderDraftBar({
  selection,
  toolbar,
}: {
  selection: ReorderSelection;
  toolbar: ReactNode;
}) {
  return (
    <BulkBar
      count={selection.count}
      summary={`${plural(selection.count, 'item', 'items')} chosen · ${plural(selection.orderCount, 'order', 'orders')} to draft`}
      onClear={selection.clear}
      toolbar={toolbar}
    >
      <Button
        size="sm"
        color="module"
        loading={selection.isDrafting}
        onClick={() => {
          void selection.onDraft();
        }}
      >
        <Icon glyph={faCartShopping} className="size-4" aria-hidden />
        Draft {plural(selection.orderCount, 'order', 'orders')}
      </Button>
    </BulkBar>
  );
}
