// The refusal for a business that is not in the partner program, with a reason a
// console can act on.
//
// It was a bare 403 whose only signal was its sentence, so the partner screens
// could not tell "not a partner" from "you may not see this": Clients and
// Referrals showed "Could not be read" where Commissions explained the program
// (sparx persona issue 307). Matching the sentence would break on the first copy
// edit; the reason is the contract.

import { ApiError } from '@wizeworks/api-core/errors';

export const NOT_A_PARTNER = 'not_a_partner';

export function notAPartner(): ApiError {
  return new ApiError('FORBIDDEN', 'This account is not a partner.', { reason: NOT_A_PARTNER });
}
