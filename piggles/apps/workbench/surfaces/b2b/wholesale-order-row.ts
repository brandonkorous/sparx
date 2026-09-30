// What a row of Wholesale orders says about who it is for.
//
// The column is headed **Business** and it drew the PERSON. First wholesale
// order ever taken through this console (O-000018, issue 748) and the Business
// column read "Tamsin Vale" — the buyer who rang, not Loom and Larder, which is
// the whole reason the row is on this screen rather than on Orders.
//
// Nothing had to be fetched to fix it. The order list already joins the
// business, and `ORDER_CUSTOMER_SELECT` in @wizeworks/crm says so in its own
// comment — "paymentTerms rides along so the B2B lens can show what an order is
// owed under" — and the console's own `OrderCustomer` type has carried
// `company: { id, companyName, paymentTerms, status }` all along. It was in the
// component's hand and nothing drew it. [[feedback_fetched_but_never_rendered]]
//
// Both names matter and they are different questions: a shop has several people
// who can order, and which one rang is worth knowing. So the business leads and
// the buyer sits under it, the same shape the customer picker uses (issue 746).

export interface OrderedBy {
  customer: {
    firstName: string | null;
    lastName: string | null;
    b2bAccount: { companyName: string } | null;
  } | null;
}

/** The business this order is for, or null when the row has no business on it
 *  — which on this lens means the join came back empty rather than that one
 *  does not exist, so the row falls back to naming the buyer. */
export function orderBusiness(order: OrderedBy): string | null {
  const name = order.customer?.b2bAccount?.companyName?.trim() ?? '';
  return name === '' ? null : name;
}

/** Who rang, when that is not already the headline. Null when there is no
 *  business above it (the name is the headline) or no person to name. */
export function orderBuyer(order: OrderedBy): string | null {
  if (orderBusiness(order) === null) return null;
  const person = [order.customer?.firstName, order.customer?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return person === '' ? null : person;
}
