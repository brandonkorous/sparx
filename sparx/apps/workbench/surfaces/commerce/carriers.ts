// Who is carrying the parcel, in the words a business would use.
//
// Extracted from the handover modal the day a SECOND screen needed the same
// list. A replacement going out on a swap is the same question as an order being
// handed to a courier, and two copies of a list like this drift the first time
// one of them gains a carrier — which is exactly the sort of change nobody
// remembers to make twice.
//
// The WORDS are not ours. They come from `carrierLabel` in the schema package,
// which is the one map turning a stored code into something readable — the
// consoles, the shopper's own order page and every customer email all read it.
// This file only says which codes a person may PICK. Holding its own labels is
// how it drifted before: this picker said "Someone else" and the customer's
// email said "Another courier" about the same parcel.
//
// `digital` and `dropship` are absent on purpose: neither is a thing somebody
// hands over at a counter, and both are set by the systems that perform them.
// `pickup` is absent too — a parcel being carried is the whole premise of both
// screens that read this.

import { carrierLabel } from '@wizeworks/commerce-schemas';

const CARRIER_CODES = ['usps', 'ups', 'fedex', 'dhl', 'other'] as const;

export type CarrierValue = (typeof CARRIER_CODES)[number];

export const CARRIERS: readonly { value: CarrierValue; label: string }[] = CARRIER_CODES.map(
  (value) => ({ value, label: carrierLabel(value) })
);
