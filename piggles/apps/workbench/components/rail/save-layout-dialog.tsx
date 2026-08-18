'use client';

// Naming an arrangement so it can be come back to.

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
} from '@wizeworks/silicaui-react';

export function SaveLayoutDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setName('');
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogTitle>Save this arrangement</DialogTitle>
        <DialogDescription>
          Everything open right now — what is on screen, how it is split, the sizes — saved as a
          layout you can come back to.
        </DialogDescription>
        <Field className="py-2">
          <FieldLabel>Name</FieldLabel>
          <FieldControl
            value={name}
            placeholder="Month end, Packing orders, Tidying the shop…"
            // No autoFocus needed: the dialog's focus trap lands on the first
            // tabbable element, which is this input.
            onChange={(event) => {
              setName(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
          <FieldDescription>Name it after the job it sets you up for</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose>
            <Button color="primary" variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button color="primary" size="sm" disabled={!name.trim()} onClick={submit}>
            Save layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
