// Adding or editing a line: a dialog whose Save writes into the local draft, so
// the pane stays dirty for it. The one sanctioned use of a modal on this screen.

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useLineEditor, type LineEditorProps } from './use-purchase-order-line-editor';
import { LineIdentity, LinePicker } from './purchase-order-line-picker';
import { DescriptionField, LineAmounts, LinePricing } from './purchase-order-line-fields';

export function LineEditor(props: LineEditorProps) {
  const model = useLineEditor(props);
  const { open, isEdit, valid, submit, requestClose } = model;
  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) void requestClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
          <DialogTitle>{isEdit ? 'Edit line' : 'Add a line'}</DialogTitle>
          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            {isEdit ? <LineIdentity model={model} /> : <LinePicker model={model} />}
            <DescriptionField model={model} />
            <LineAmounts model={model} />
            <LinePricing model={model} currency={props.currency} />
          </div>
          <DialogFooter>
            <Button
              color="neutral"
              variant="ghost"
              size="sm"
              onClick={() => {
                void requestClose();
              }}
            >
              Cancel
            </Button>
            <Button color="module" size="sm" disabled={!valid} onClick={submit}>
              {isEdit ? 'Save line' : 'Add line'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
