-- Stored-credential chain on a saved payment method (docs/142 §5.4).
--
-- The card networks require a merchant-initiated charge to reference the
-- transaction that ESTABLISHED the mandate. `original_network_trans_id` is
-- mandatory for Discover / Diners Club / JCB / China UnionPay, for Visa on every
-- recurring MIT, and inside the EEA for Mastercard. Without it the issuer sees a
-- scheduled renewal as an unmandated charge on a card nobody is holding, and
-- soft-declines a card that is perfectly good.
--
-- Stripe and PayPal keep this chain themselves and never read these columns.
-- Authorize.net makes the merchant carry it: the FIRST charge against a newly
-- vaulted card declares itself the establishing transaction and returns a
-- networkTransId, which every later renewal quotes back.
--
-- Both nullable with no backfill, deliberately. Every existing row predates the
-- chain, and the adapter treats a missing id as "this is the establishing
-- charge" — which is the correct, self-healing behaviour: the next renewal
-- establishes the chain and stores it. Inventing a value here would be worse
-- than having none.

ALTER TABLE "commerce_customer_payment_methods"
  ADD COLUMN "network_trans_id" VARCHAR(64),
  ADD COLUMN "original_auth_amount" INTEGER;

-- No new index: these columns are only ever read alongside the row that is
-- already being loaded by primary key to make a charge.
