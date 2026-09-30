'use client';

// What the customer said about this order, and what the shop wrote down about it.
//
// ── THIS SECTION USED TO BE UNREACHABLE ─────────────────────────────────────
//
// Both consoles printed the two notes and rendered NOTHING when both were empty,
// which they were on every order on the platform: 0 of 122 measured 2026-09-29.
// Nothing in either console wrote either one, and neither did checkout nor the
// till, so a heading reading "Your team's note" had never once appeared and could
// not be made to (issue 874).
//
// `PATCH /v1/orders/:id` takes four things. Two of them were wired when a
// quote-turned-order arrived with nowhere to send it; these two were left.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// A note on an order is not a nicety for a shop that takes work over a counter.
// "Wants the cuffs shorter, spoke to her Tuesday." "Leave it with the neighbor."
// "Collecting Saturday, not Friday." There was nowhere to write any of it, under a
// heading promising there was.
//
// ── WHY ONLY ONE OF THE TWO IS A BOX ────────────────────────────────────────
//
// The shop's note is hers to write. The customer's note is a record of what
// somebody SAID, and a box beside it would be a box for editing what a customer
// told her, which is not a thing a record should offer. It stays print-only and
// appears only when there is something to print.
//
// ONE SAVE, LAST WRITE WINS, and an unsaved note registers the leave-guard, like
// every other editor in this console. No autosave: a half-typed note saving
// itself is how "Leave it with the" ends up on an order.
//
// Byte-identical in both consoles.

import { useEffect, useState } from 'react';
import { shownInPlace } from '@wizeworks/query';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { useDirtySource } from '../../lib/workbench/dirty';
import { orderErrorMessage, useSetOrderNote, type Order } from './data';

export function OrderNotes({ order }: { order: Order }) {
  const saved = order.internalNote ?? '';
  const save = useSetOrderNote(order.id);
  const [draft, setDraft] = useState(saved);

  // Reseeded when the STORED note changes, never on every refetch. Keying this
  // on the order object would wipe what she is halfway through typing each time
  // the pane refetches underneath her.
  useEffect(() => {
    setDraft(order.internalNote ?? '');
  }, [order.id, order.internalNote]);

  const dirty = draft.trim() !== saved.trim();
  useDirtySource(dirty, 'Your note on this order has not been saved. Close it anyway?');
  const failure = save.isError ? orderErrorMessage(save.error, 'Could not save this note.') : null;

  return (
    <FormSection title="Notes">
      {order.customerNote ? (
        <div className="flex flex-col gap-1">
          <Heading level={3} className="text-base font-semibold">
            From the customer
          </Heading>
          <Text className="text-base whitespace-pre-wrap">{order.customerNote}</Text>
        </div>
      ) : null}

      <Field>
        <FieldLabel>Your team’s note</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={3}
              value={draft}
              placeholder="Anything about this order the people packing it should know."
              onChange={(event) => {
                setDraft(event.target.value);
              }}
            />
          }
        />
        {/* True as written, and checked before it was written: nothing outside
            this console reads this field. It is on no email, no invoice and no
            packing slip, and the customer's own order page picks its fields by
            hand and does not include it.
            [[feedback_a_promise_in_copy_is_a_contract]] */}
        <FieldDescription>
          Only your team sees this. It is not on the receipt, the invoice, or anything else the
          customer gets.
        </FieldDescription>
      </Field>

      {failure ? <Text className="text-error text-base">{failure}</Text> : null}

      {dirty ? (
        <div className="flex flex-wrap gap-2">
          <Button
            color="module"
            disabled={save.isPending}
            onClick={() => {
              save.mutate(draft, { onError: shownInPlace });
            }}
          >
            {save.isPending ? 'Saving…' : 'Save the note'}
          </Button>
          <Button
            variant="ghost"
            disabled={save.isPending}
            onClick={() => {
              setDraft(saved);
            }}
          >
            Put it back
          </Button>
        </div>
      ) : null}
    </FormSection>
  );
}
