// The records a queued designed email is about, read back off the send (sparx
// persona issue 358).
//
// The automation that queues a send writes every record it knows into
// `entityRefs` (`entityRefsFromFields` in automation-actions): the order, the
// parcel, the booking, the waitlist place, the return. The dispatch tick read
// back only some of them. Without `fulfillmentId` the shipping email described
// the order's newest parcel rather than the one it was sent for, and without
// `bookingId` / `waitlistEntryId` the booking emails' live data was empty. So
// the mapping is one function, tested against every key the enqueuer writes.

import type { EmailRecipientRef } from './email-data.js';

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function recipientRef(
  to: string,
  customerId: string | null | undefined,
  entityRefs: unknown
): EmailRecipientRef {
  const refs =
    entityRefs !== null && typeof entityRefs === 'object' && !Array.isArray(entityRefs)
      ? (entityRefs as Record<string, unknown>)
      : {};
  return {
    email: to,
    customerId: customerId ?? strOrNull(refs.customerId),
    orderId: strOrNull(refs.orderId),
    cartId: strOrNull(refs.cartId),
    quoteId: strOrNull(refs.quoteId),
    billingDocumentId: strOrNull(refs.billingDocumentId),
    // `b2bAccountId` is the pre-rename key (docs/144 §11). Sends queued before
    // the rename still carry it, and a queued email that silently loses its
    // account is one whose credit line and portal link go blank, so both are
    // read, new name first.
    companyId: strOrNull(refs.companyId) ?? strOrNull(refs.b2bAccountId),
    subscriptionId: strOrNull(refs.subscriptionId),
    returnId: strOrNull(refs.returnId),
    fulfillmentId: strOrNull(refs.fulfillmentId),
    bookingId: strOrNull(refs.bookingId),
    waitlistEntryId: strOrNull(refs.waitlistEntryId),
  };
}
