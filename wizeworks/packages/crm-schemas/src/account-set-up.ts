// Is a wholesale account still waiting to be set up? (sparx persona issues 080, 807)
//
// ONE rule, read in two places that must never disagree:
//
//   1. The system automation "New wholesale customer: set-up task" uses it as its
//      condition, so a task to "set up prices and terms" opens only when that job
//      is still to do. Gillett added five accounts with their terms and limit
//      already set and got five open tasks asking for what was already done
//      (issue 080).
//   2. The task closes itself when it stops being true. Nothing closed it before:
//      Wasatch Front was put on Net 30 with a $25,000 limit and its task went on
//      telling the owner to do it. Every save of an account's terms or limit asks
//      this same question (`taskService.closeWhenAccountSetUp`).
//
// Kept as a condition group, not a function, because the automation stores and
// evaluates conditions as data, and a business can read it on the rule's screen.
// The closing side evaluates the very same group with the same evaluator, so a
// change here moves both, and nothing anywhere restates the rule in code.
//
// What it says: no terms chosen, or terms with no credit limit to order against.
// A customer created with no limit is refused at checkout on every order placed
// on terms (`credit_limit` is NOT NULL DEFAULT 0, issue 807). "Pay before it
// ships" (`prepay`) needs no limit.

import {
  type ConditionGroup,
  evaluateConditions,
  type ResolvedFields,
} from '@wizeworks/automation-schemas';

export const ACCOUNT_SET_UP_TO_DO: ConditionGroup = {
  logic: 'OR',
  conditions: [
    { field: 'b2bAccount.paymentTerms', operator: 'is_not_set' },
    {
      logic: 'AND',
      conditions: [
        { field: 'b2bAccount.paymentTerms', operator: 'neq', value: 'prepay' },
        { field: 'b2bAccount.creditLimit', operator: 'lte', value: 0 },
      ],
    },
  ],
};

/** What the rule reads off an account. A Prisma `Decimal`, a number and a numeric
 *  string are all accepted for the limit. */
export interface AccountSetUpFacts {
  paymentTerms: string | null;
  creditLimit: unknown;
}

/**
 * The account's facts under the field names the rule (and every automation
 * condition about an account) uses. The automation resolver builds its
 * `b2bAccount.*` fields with this, so the rule sees the same values whichever
 * side asks.
 */
export function accountSetUpFields(account: AccountSetUpFacts): ResolvedFields {
  const limit =
    account.creditLimit === null || account.creditLimit === undefined
      ? null
      : Number(account.creditLimit);
  return {
    'b2bAccount.paymentTerms': account.paymentTerms,
    'b2bAccount.creditLimit': limit !== null && Number.isFinite(limit) ? limit : null,
  };
}

/** True while the account still needs its prices and terms set up. */
export function accountNeedsSetUp(account: AccountSetUpFacts): boolean {
  return evaluateConditions(ACCOUNT_SET_UP_TO_DO, accountSetUpFields(account));
}
