-- Let the accounting mapping table carry the stock journal's account roles
-- (docs/146 Phase 10.7–10.8).
--
-- `finance_accounting_mappings` was built loosely-keyed on purpose: docs/148 §6
-- says "the mappable set grows — categories today, tax rates and payment methods
-- and income accounts next — and a column per concept means a migration every
-- time the accountant asks for one more". This is that growth arriving, and it
-- costs one CHECK constraint rather than a table.
--
-- `inventory_account` rows map the five ROLES a stock journal posts to — the
-- asset, cost of goods, accrued purchases, shrinkage, corrections — onto
-- whatever those accounts are called in the tenant's own chart. They are not
-- expense categories and never will be: a category is the owner's vocabulary for
-- money going out, and these are fixed positions in double entry.

ALTER TABLE "finance_accounting_mappings"
  DROP CONSTRAINT "finance_accounting_mappings_sparx_type_check";

ALTER TABLE "finance_accounting_mappings"
  ADD CONSTRAINT "finance_accounting_mappings_sparx_type_check" CHECK (
    "sparx_type" IN (
      'expense_category',
      'tax_rate',
      'payment_method',
      'income_account',
      'vendor',
      'inventory_account'
    )
  );
