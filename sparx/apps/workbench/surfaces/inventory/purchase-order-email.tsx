'use client';

// Placing an order, and emailing it to the supplier (sparx persona issue 071).
//
// Placing used to be a yes/no confirm that ended "Nothing is sent to the
// supplier for you: print the order or pass it on yourself". An owner with the
// supplier's address already on file then printed to PDF and attached it from
// his own mailbox. These two dialogs are the place-and-email choice and the
// later "email it" for an order that is already placed (a sign-off came
// through, the supplier lost it, it should go to a second address).

import { useEffect, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Text,
} from '@wizeworks/silicaui-react';
import { PaneScope } from '../../lib/dock/window-boundary';
import { emailedLine, placeAndEmailWords, type EmailedRecord } from './purchase-order-email-words';

interface OrderForEmail {
  number: string;
  supplierName: string | null;
  supplierEmail: string | null;
  emails: EmailedRecord[];
}

/**
 * Place a draft, and choose whether it goes to the supplier by email.
 *
 * Only for an order that places straight away. One held for sign-off has not
 * been approved, so it cannot go to the supplier yet; that path keeps its own
 * confirm, which says so.
 */
export function PlaceOrderDialog({
  open,
  order,
  title,
  description,
  pending,
  onClose,
  onPlace,
}: {
  open: boolean;
  order: OrderForEmail;
  title: string;
  /** What placing locks and how goods are booked in, from `placingWords`. */
  description: string;
  pending: boolean;
  onClose: () => void;
  onPlace: (emailIt: boolean) => void;
}) {
  const canEmail = order.supplierEmail !== null;
  const [emailIt, setEmailIt] = useState(canEmail);
  // Re-armed each time it opens: a box left unticked last time must not quietly
  // decide this order too.
  useEffect(() => {
    if (open) setEmailIt(canEmail);
  }, [open, canEmail]);
  const words = placeAndEmailWords(order, emailIt);
  const supplier = order.supplierName ?? 'The supplier';

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="flex max-w-lg flex-col gap-4">
          <DialogTitle>{title}</DialogTitle>
          <Text>{description}</Text>
          {canEmail ? (
            <label className="flex items-start gap-3">
              <Checkbox
                color="module"
                checked={emailIt}
                aria-label={`Email the order to ${supplier}`}
                onChange={(event) => {
                  setEmailIt(event.target.checked);
                }}
              />
              <span className="flex flex-col gap-0.5">
                <Text as="span" className="font-medium">
                  Email the order to {supplier}
                </Text>
                <Text as="span" className="text-sm">
                  {words.after}
                </Text>
              </span>
            </label>
          ) : (
            <Alert color="info" variant="soft">
              <AlertContent>
                <AlertDescription>
                  {supplier} has no email address on file, so nothing goes to them. Print the order
                  and send it yourself, or add their address on their supplier page to email orders
                  from here.
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Keep it a draft
            </Button>
            <Button
              color="module"
              size="sm"
              loading={pending}
              onClick={() => {
                onPlace(canEmail && emailIt);
              }}
            >
              {words.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

/** Email a placed order: to the supplier's own address, or one typed here. */
export function EmailOrderDialog({
  open,
  order,
  pending,
  formatMoment,
  onClose,
  onSend,
}: {
  open: boolean;
  order: OrderForEmail;
  pending: boolean;
  formatMoment: (iso: string) => string;
  onClose: () => void;
  onSend: (to: string) => void;
}) {
  const [to, setTo] = useState(order.supplierEmail ?? '');
  useEffect(() => {
    if (open) setTo(order.supplierEmail ?? '');
  }, [open, order.supplierEmail]);
  const address = to.trim();
  // The server checks it properly; this only keeps the button from sending
  // something that is plainly not an address.
  const looksLikeAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  const supplier = order.supplierName ?? 'the supplier';

  return (
    <PaneScope>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="flex max-w-lg flex-col gap-4">
          <DialogTitle>
            Email {order.number} to {supplier}
          </DialogTitle>
          <Text>
            They get the order in the email itself: every line with its price and code, where it
            goes, and when you want it. If they reply, it comes to your business email.
          </Text>
          <Field>
            <FieldLabel>Send to</FieldLabel>
            <Input
              type="email"
              value={to}
              placeholder="orders@supplier.com"
              onChange={(event) => {
                setTo(event.target.value);
              }}
            />
            <FieldDescription>
              {order.supplierEmail
                ? address === order.supplierEmail
                  ? `Their address from their supplier page.`
                  : `Only this one email goes here. Their supplier page still says ${order.supplierEmail}.`
                : `${supplier} has no address on their supplier page. Type one for this email.`}
            </FieldDescription>
          </Field>
          {order.emails.length > 0 ? (
            <Text className="text-sm">{emailedLine(order, formatMoment)}</Text>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="module"
              size="sm"
              loading={pending}
              disabled={!looksLikeAddress}
              onClick={() => {
                onSend(address);
              }}
            >
              Send it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}
