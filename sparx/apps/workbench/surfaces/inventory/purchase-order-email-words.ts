// The words around emailing a purchase order to the supplier (sparx persona
// issue 071). Pure, so the promises they make can be tested against the order
// they describe.

export interface EmailedRecord {
  to: string;
  at: string;
}

/**
 * One line saying whether the supplier has the order, for a PLACED order.
 *
 * "Placed" is the owner's word for what he did; whether the supplier has heard
 * about it is a separate fact, and the screen used to leave it out entirely.
 * Never says "sent" for an order nobody emailed: it may have gone by phone or on
 * paper, which this screen cannot know, so the never-emailed line says only what
 * is true here.
 */
export function emailedLine(
  order: { supplierName: string | null; emails: EmailedRecord[] },
  formatMoment: (iso: string) => string
): string {
  const supplier = order.supplierName ?? 'the supplier';
  const [latest] = order.emails;
  if (!latest) return `Not emailed to ${supplier} from here.`;
  const earlier = order.emails.length - 1;
  return (
    `Emailed to ${latest.to} on ${formatMoment(latest.at)}.` +
    (earlier > 0 ? ` Sent ${String(order.emails.length)} times in all.` : '')
  );
}

/** What placing does about the supplier, given whether it will email them. */
export function placeAndEmailWords(
  order: { number: string; supplierName: string | null; supplierEmail: string | null },
  emailIt: boolean
): { confirmLabel: string; after: string } {
  const supplier = order.supplierName ?? 'the supplier';
  if (emailIt && order.supplierEmail) {
    return {
      confirmLabel: 'Place and email it',
      after: `${supplier} gets the order by email at ${order.supplierEmail}, with every line, price and your delivery address in it.`,
    };
  }
  return {
    confirmLabel: 'Place the order',
    after: `Nothing goes to ${supplier}. Print the order or email it from here later.`,
  };
}

/** The toast after a placed order was handed to the mail. */
export function emailedToast(
  order: { number: string },
  to: string
): {
  title: string;
  description: string;
} {
  return {
    title: `${order.number} emailed to ${to}`,
    description: 'If they reply, it comes to your business email.',
  };
}
