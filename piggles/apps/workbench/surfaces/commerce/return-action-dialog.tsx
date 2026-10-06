'use client';

// Shared chrome for a return's (and a core's) action modals: seconds of work with
// nothing to draft, so abandoning one loses nothing. PaneScope keeps each modal to
// its own pane, so acting in one never blacks out the pane beside it.

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Text,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { formatMoney } from './data';

/** Returns carry money in integer cents; every other commerce surface formats
 *  dollars. One conversion, at the render edge. */
export function money(cents: number, currency: string): string {
  return formatMoney(cents / 100, currency);
}

export const CONDITIONS = [
  'unopened',
  'like_new',
  'used_good',
  'used_acceptable',
  'damaged',
  'destroyed',
] as const;

type SubmitColor = 'module' | 'danger' | 'success' | 'warning';

function ActionFooter(props: {
  submitLabel: string;
  submitColor: SubmitColor;
  submitDisabled?: boolean | undefined;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <DialogFooter>
      <Button
        color="neutral"
        variant="ghost"
        size="sm"
        disabled={props.busy}
        onClick={props.onClose}
      >
        Cancel
      </Button>
      <Button
        color={props.submitColor}
        size="sm"
        loading={props.busy}
        disabled={props.submitDisabled}
        onClick={props.onSubmit}
      >
        {props.submitLabel}
      </Button>
    </DialogFooter>
  );
}

/** The popup box, its scrolling body, and a Cancel / primary footer. Keeps every
 *  form visually identical so they read as one family of moves on a return. */
interface ActionDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  submitLabel: string;
  submitColor?: SubmitColor;
  submitDisabled?: boolean;
  busy: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}

export function ActionDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  submitColor = 'module',
  submitDisabled,
  busy,
  onSubmit,
  children,
}: ActionDialogProps) {
  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>

          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            {children}
          </div>

          <ActionFooter
            submitLabel={submitLabel}
            submitColor={submitColor}
            submitDisabled={submitDisabled}
            busy={busy}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

/** A plain action row, sitting after the record under a divider — the same shape
 *  the order pane uses for cancel. Rare, one-way moves never get a card of their
 *  own beside the things people came to read. */
export function ActionRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text className="text-base font-medium">{title}</Text>
        <Text className="text-sm">{description}</Text>
      </div>
      {children}
    </div>
  );
}
