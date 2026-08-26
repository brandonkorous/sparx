'use client';

// Shared chrome for a return's action modals.
//
// They are modals rather than panes on purpose: a return action is seconds of
// work with nothing to draft and nothing to come back to, the same class as
// inviting a teammate. Abandon one and nothing is lost — the return is
// untouched and you reopen and redo. That is the ONLY kind of modal this app
// allows.
//
// A modal here belongs to that ONE return via PaneScope, so acting on a return
// in one pane never blacks out the return open in the pane beside it.

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

/** The popup box, its scrolling body, and a Cancel / primary footer. Keeps every
 *  form visually identical so they read as one family of moves on a return. */
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  submitLabel: string;
  submitColor?: 'module' | 'danger' | 'success';
  submitDisabled?: boolean;
  busy: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
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

          <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
            {children}
          </div>

          <DialogFooter>
            <Button color="neutral" variant="ghost" size="sm" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              color={submitColor}
              size="sm"
              loading={busy}
              disabled={submitDisabled}
              onClick={onSubmit}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
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
