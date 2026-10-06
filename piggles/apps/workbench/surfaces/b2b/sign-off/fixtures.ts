// The account, its approvers and the sign-off shapes the sign-off/ tests share.
import type { AccountApprover, SignOff } from './people-words';

export const WASATCH = 'Wasatch Front Utility Contractors, LLC';
export const TEODORA: AccountApprover = {
  customerId: 'c-teodora',
  name: 'Teodora Vukić-Hale',
  email: 'teodora@wasatch.test',
};
export const SAM: AccountApprover = { customerId: 'c-sam', name: 'Sam Okafor', email: null };
export const day = (iso: string) => `day(${iso.slice(0, 10)})`;

export function signOff(partial: Partial<SignOff> = {}): SignOff {
  return {
    needs: ['business'],
    waitingOn: ['business'],
    signed: {},
    accountApprovers: [],
    ...partial,
  };
}

/** Only the account is asked: the limit is set to its own approvers. */
export const accountOnly = signOff({
  needs: ['account'],
  waitingOn: ['account'],
  accountApprovers: [TEODORA],
});

/** Both are asked: account-signed limit, and over the credit limit too. */
export const both = signOff({
  needs: ['account', 'business'],
  waitingOn: ['account', 'business'],
  accountApprovers: [TEODORA],
});
