-- Remove the self-generated DKIM keypair columns from `domains`.
--
-- These were a Postal-era artifact: sparx generated an RSA DKIM keypair at
-- domain purchase, stored the PRIVATE key here (plaintext), and published the
-- public key in a `sparx._domainkey` TXT record. Postal was decommissioned in
-- favour of Mailgun, which signs outbound mail with its OWN per-domain DKIM key
-- (selector `mx._domainkey.<domain>`, provisioned during Mailgun domain
-- verification). Nothing ever consumed `dkim_private_key`, so it was a dormant
-- secret at rest with no purpose — dropping both columns removes the liability.

ALTER TABLE "domains" DROP COLUMN IF EXISTS "dkim_public_key";
ALTER TABLE "domains" DROP COLUMN IF EXISTS "dkim_private_key";
