-- Issue 064 — a customer collecting a bun had to type a postal address.
--
-- Checkout asked for "Full name" inside the SHIPPING ADDRESS form, so the only
-- way a shop could learn who was buying was to make them fill in a street, a
-- city and a postal code first. A collection-only bakery therefore demanded a
-- delivery address for an order that would never be delivered, and then wrote
-- that fictional address onto the order as though it meant something.
--
-- The name moves to where it belongs: the contact step, beside the email. It is
-- NULLABLE and carries no default, because a session that has not reached the
-- contact step has not been told a name, and no default can say that.
ALTER TABLE commerce_checkout_sessions
    ADD COLUMN customer_name VARCHAR(255);
