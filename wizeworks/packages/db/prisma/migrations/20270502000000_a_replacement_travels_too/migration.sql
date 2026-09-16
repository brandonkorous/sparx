-- A REPLACEMENT TRAVELS TOO
--
-- When a shop settles a swap, the replacement leaves the building. The platform
-- recorded that it had left — stock moved, an event fired, the customer was
-- emailed — and recorded NOTHING about the journey. No carrier, no tracking
-- number, no date it was posted.
--
-- So the email that tells a customer their replacement is on its way could only
-- say "on its way" and stop, on a platform whose ordinary shipping confirmation
-- leads with the tracking number because that is what the recipient opened the
-- email for. The customer then writes to ask where it is, which is the exact
-- exchange the shop bought this product to stop having.
--
-- `commerce_return_labels` is already the right table, one leg short. It holds a
-- parcel that exists BECAUSE of a return, with a tracking number and a tracking
-- URL, and today every row in it is the label the customer uses to send the goods
-- BACK. The replacement going the other way is the same fact pointing the other
-- direction, so this gives the table a direction rather than building a second
-- table to hold the same six columns.
--
-- Why not an order fulfillment, which is where a parcel normally lives: the
-- order line was fulfilled once already, when the customer first received the
-- thing they are now returning. `createFulfillment` refuses a quantity beyond
-- what remains, and getting past that would double-count `quantity_fulfilled`
-- and publish a second `order.fulfilled`, sending "your order has shipped" about
-- an order that shipped weeks ago. A replacement is not another go at an order
-- line. It is its own parcel, and it belongs to the return that caused it.

-- Every existing row is the customer's own way to send it back. Defaulted rather
-- than backfilled-then-tightened for that reason: there is no ambiguity to
-- resolve, the 30 rows on this database and every row on every other one predate
-- outbound entirely.
ALTER TABLE "commerce_return_labels"
  ADD COLUMN "direction" VARCHAR(16) NOT NULL DEFAULT 'inbound';

-- The carrier as a PERSON names it. `provider_slug` answers "which integration
-- bought this label" and is meaningless when the answer is "she walked to the
-- post office", which is how most replacements go out. Nullable, because a label
-- bought through a provider already carries the carrier inside the label.
ALTER TABLE "commerce_return_labels"
  ADD COLUMN "carrier" VARCHAR(63);

-- The carrier's own id for a label it issued. There is no such id when nobody
-- bought a label, and NOT NULL would have forced a fake one — which is how a
-- column that means "the carrier said this" starts holding 'manual'.
ALTER TABLE "commerce_return_labels"
  ALTER COLUMN "label_ref" DROP NOT NULL;

-- When it was actually posted, which is not when the row was written: a shop
-- settling a swap on Tuesday and recording Monday's tracking number must not
-- tell the customer it went today.
ALTER TABLE "commerce_return_labels"
  ADD COLUMN "shipped_at" TIMESTAMPTZ;

-- "What is travelling on this return, and which way" — the question both the
-- return pane and the replacement's own email ask.
CREATE INDEX "commerce_return_labels_tenant_return_direction_idx"
  ON "commerce_return_labels" ("tenant_id", "return_id", "direction");
