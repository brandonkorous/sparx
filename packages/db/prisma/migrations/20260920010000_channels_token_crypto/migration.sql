-- Channel OAuth tokens: Secret-Manager refs → AES-256-GCM ciphertext on the row
-- (docs/106 §4.6). Per-tenant access tokens rotate hourly (Google) to every few
-- weeks (Meta); a Secret-Manager ref would churn a billed, version-capped secret
-- version on every refresh, whereas a row-stored cipher box rotates with a plain
-- UPDATE — the same pattern the Search Console connector already uses. Decryption
-- happens in api-rest (on connect) and channel-sync-worker (on push) via
-- @sparx/channels/crypto, keyed by CHANNELS_TOKEN_KEY.
--
-- No backfill: channel_connections is empty in every environment (no channel has
-- been connected yet — the connect flow ships in this same change), so dropping
-- the ref columns loses no data. Text, not varchar(512): a boxed refresh token
-- can exceed the old ref budget.

ALTER TABLE channel_connections DROP COLUMN access_token_ref;
ALTER TABLE channel_connections DROP COLUMN refresh_token_ref;
ALTER TABLE channel_connections ADD COLUMN access_token_enc  text;
ALTER TABLE channel_connections ADD COLUMN refresh_token_enc text;
