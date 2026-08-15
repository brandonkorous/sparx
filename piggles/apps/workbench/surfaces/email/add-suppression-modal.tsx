'use client';

// Adding an address to the do-not-email list — an address and a reason, in a
// popup.
//
// This EARNS a modal by the pane-or-modal rule. It clears all four hurdles: an
// abandoned form costs at most retyping one address; there is no suppression
// surface you would return to (the result is a row in a list, not a thing with
// its own screen); nothing else needs to be on screen while you do it; and it is
// two fields, over in seconds. Its result commits to the SERVER, but that is fine
// because there is nothing durable to lose here — a suppression is a fact, not a
// draft you keep working on.
//
// It stays MOUNTED for the whole life of the list surface rather than being
// swapped in when it opens, so the list refetching behind it can never take a
// half-typed address with it.

import { useEffect, useId, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import {
  MANUAL_REASONS,
  reasonMeta,
  suppressionErrorMessage,
  useAddSuppression,
  type ManualReason,
} from './suppressions-data';
import { productCopy, productCopyWith } from '../../lib/product';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The reason a hand-added address starts on: someone asked to be removed is by
 *  far the most common thing an owner is doing here. */
const DEFAULT_REASON: ManualReason = 'unsubscribe';

export function AddSuppressionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const add = useAddSuppression();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState<ManualReason>(DEFAULT_REASON);
  const [touched, setTouched] = useState(false);
  // Two of these can be open at once (a list beside a list), so the id linking the
  // footer button to the form must be unique per instance.
  const formId = useId();

  // Wipe on the way IN, not on the way out: an accidental Escape should not clear
  // a half-typed address, but a second, deliberate add should always start clean.
  useEffect(() => {
    if (!open) return;
    setEmail('');
    setReason(DEFAULT_REASON);
    setTouched(false);
  }, [open]);

  const trimmed = email.trim();
  const malformed = trimmed !== '' && !EMAIL_PATTERN.test(trimmed);
  const error = malformed && touched ? 'Enter an address like sarah@example.com' : null;

  const submit = () => {
    setTouched(true);
    if (trimmed === '' || malformed) return;
    add.mutate(
      { email: trimmed, reason },
      {
        onSuccess: () => {
          // Close first, then say so: the list underneath already carries the new
          // row by the time the popup is gone, so the toast lands over proof.
          onClose();
          toast.add({
            title: productCopyWith(
              'email.suppression.added',
              `Piggles will no longer email ${trimmed}`,
              { address: trimmed }
            ),
            description: 'They now appear on your do-not-email list.',
            type: 'success',
          });
        },
        onError: (err) => {
          // The popup stays open with what they typed still in it. Show the
          // server's own sentence — it names the exact problem (a malformed
          // address, one already on the list) better than a generic line could.
          toast.add({
            title: 'Could not add that address',
            description: suppressionErrorMessage(
              err,
              'Something went wrong reaching the server. Nothing was changed — try again in a moment.'
            ),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    // PaneScope portals the dialog into the pane that opened it: in a
    // multi-document workbench a modal belongs to ONE document, and must not
    // black out whatever sits in the pane beside it.
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Every dismissal lands here and simply closes — nothing was sent and
          // nothing was lost that took longer than a sentence to type, so a
          // "discard your changes?" question would cost more than it protects.
          if (!next) onClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-md flex-col overflow-hidden">
          <DialogTitle>Add an address to your do-not-email list</DialogTitle>

          <form
            id={formId}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Field>
              <FieldLabel>Email address</FieldLabel>
              <Input
                color={error ? 'error' : 'module'}
                type="email"
                value={email}
                placeholder="sarah@example.com"
                autoComplete="off"
                onBlur={() => {
                  setTouched(true);
                }}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
              {error ? <FieldStatus status="error">{error}</FieldStatus> : null}
            </Field>

            <Field>
              <FieldLabel>Why are you adding them?</FieldLabel>
              <NativeSelect
                color="module"
                aria-label="Reason for adding this address"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value as ManualReason);
                }}
              >
                {MANUAL_REASONS.map((value) => (
                  <option key={value} value={value}>
                    {reasonMeta(value).label}
                  </option>
                ))}
              </NativeSelect>
              {/* The chosen reason explained in one line, where the decision is
                  made rather than in a help article. */}
              <Text className="text-sm">{reasonMeta(reason).detail}</Text>
            </Field>

            <Text className="text-sm">
              {productCopy(
                'email.suppression.addNote',
                'Piggles will stop sending this address every kind of email — newsletters, offers and account messages alike. You can take them off this list at any time.'
              )}
            </Text>
          </form>

          <DialogFooter>
            <Button color="neutral" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {/* Tied to the form by id rather than nested in it — the footer is a
                sibling of the scrolling body, so Enter in the email field submits
                the same form this button does. */}
            <Button
              type="submit"
              form={formId}
              color="module"
              size="sm"
              disabled={add.isPending || trimmed === ''}
            >
              {add.isPending ? 'Adding…' : 'Add to list'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
