'use client';

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { ModuleScope } from '../../../components/module-scope';
import { type ApprovedStockNotice } from '../sign-off-words';

// An approval that placed the order short of stock (sparx persona issue 087): a
// warning that stays until dismissed. The Waiting list is inventory's, so its button
// wears that hue, and shows only when this customer is owed something.
export function StockShortNotice({
  notice,
  onOpenWaitingList,
  onDismiss,
}: {
  notice: ApprovedStockNotice;
  onOpenWaitingList: () => void;
  onDismiss: () => void;
}) {
  return (
    <Alert color="warning" variant="soft" role="status">
      <AlertContent>
        <AlertTitle>{notice.title}</AlertTitle>
        <AlertDescription>{notice.detail}</AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
        {notice.owed ? (
          <ModuleScope module="inventory">
            <Button size="sm" color="module" onClick={onOpenWaitingList}>
              Open Waiting list
            </Button>
          </ModuleScope>
        ) : null}
      </AlertActions>
    </Alert>
  );
}
