-- Who signs off an order a spending limit holds (sparx persona issue 087).
--
-- A trade account's contact can be given the role "Can approve orders"
-- (b2b_account_contacts.role = 'approver'), and nothing ever asked them to: a
-- held order went to the business's own team, and the approver could look but
-- not approve. A spending limit is now set to be signed off either by the
-- business ('business', every rule until now) or by the account's own approvers
-- ('account'). An account with nobody who can approve falls back to the
-- business, so an order is never held with nobody able to release it.

ALTER TABLE "purchase_approval_rules"
  ADD COLUMN "sign_off_by" VARCHAR(20) NOT NULL DEFAULT 'business';

ALTER TABLE "purchase_approval_rules"
  ADD CONSTRAINT "purchase_approval_rules_sign_off_by_check"
  CHECK ("sign_off_by" IN ('business', 'account'));

-- A rule the account signs names nobody on the business's team.
UPDATE "purchase_approval_rules"
  SET "required_approver_user_id" = NULL
  WHERE "sign_off_by" = 'account';
