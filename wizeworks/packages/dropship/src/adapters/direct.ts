// The business's own supplier: a maker or wholesaler who ships to the business's
// customer when sent the order (sparx persona issue 171).
//
// There is no system to plug into, no product list to read and no tracking to
// fetch. What the business gives us is where the supplier takes orders. The
// order router sees `orderRecipient()` and emails the order there, from the
// business, with the customer as the ship-to; the owner types the tracking in
// when the supplier tells them it shipped.
//
// Which products the supplier ships is set on the product itself, not imported:
// the business already sells them.

import type {
  Credentials,
  InventoryMap,
  NormalizedProduct,
  Order,
  SupplierAdapter,
  SupplierOrderResult,
  TrackingInfo,
} from '../types.js';

export interface DirectCredentials extends Credentials {
  /** The address the supplier takes orders at. */
  orderEmail: string;
  /** The person there the business deals with, when it has one. */
  contactName: string;
}

// One `@`, something either side, a dot in the domain. Deliverability is the
// mail provider's to judge; this catches the typo that would send every order
// nowhere.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The supplier's order address, trimmed, or null when it is not one. */
export function directOrderEmail(credentials: Credentials): string | null {
  const email = (credentials.orderEmail ?? '').trim();
  return EMAIL.test(email) ? email : null;
}

export class DirectAdapter implements SupplierAdapter {
  private readonly creds: Credentials;

  constructor(credentials: Credentials) {
    this.creds = credentials;
  }

  /** A connection is healthy when there is somewhere to send the orders. Throws
   *  rather than returning false: a supplier saved with no address would take
   *  every order and send none of them on. */
  authenticate(credentials: Credentials): Promise<boolean> {
    if (directOrderEmail(credentials) === null) {
      return Promise.reject(
        new Error('Enter the email address this supplier takes orders at, like orders@example.com.')
      );
    }
    return Promise.resolve(true);
  }

  orderRecipient(): { email: string; contactName: string | null } {
    const email = directOrderEmail(this.creds);
    if (email === null) throw new Error('This supplier has no address to send orders to.');
    const contact = (this.creds.contactName ?? '').trim();
    return { email, contactName: contact === '' ? null : contact };
  }

  async *syncCatalog(): AsyncGenerator<NormalizedProduct> {
    // No product list. Returning at once is the honest answer to "what do they
    // sell": what the business has said they ship.
  }

  /** Not called for this supplier: the router emails the order. If it ever is,
   *  the order waits for the owner rather than reading as sent. */
  submitOrder(order: Order): Promise<SupplierOrderResult> {
    return Promise.resolve({
      supplierOrderId: `manual-${order.sparxOrderId}`,
      status: 'pending',
      errorMessage: 'Send this order to the supplier yourself, then record it here as placed.',
    });
  }

  getTrackingUpdate(_supplierOrderId: string): Promise<TrackingInfo> {
    return Promise.reject(
      new Error('This supplier sends no tracking of its own: record it on the order.')
    );
  }

  /** They hold the stock and say nothing about it; unknown is not zero. */
  checkInventory(_skus: string[]): Promise<InventoryMap> {
    return Promise.resolve({});
  }
}
