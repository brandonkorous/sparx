-- Widen verifications.value from VARCHAR(255) to TEXT.
--
-- Better Auth's own flows (email verification, password reset) store a hashed
-- token here that fits in 255 chars. The MCP OAuth provider (docs/07 §5),
-- however, REUSES this table as the authorization-code store: on /mcp/authorize
-- it serializes the entire code payload — client id, redirect URI, the full
-- scope array, PKCE code_challenge, state, nonce, userId, authTime — as JSON
-- into `value`. For a real connector request that JSON runs ~300–450 chars, so
-- the 255-char cap made the INSERT raise `value too long for type character
-- varying(255)`; the provider caught it and returned `error=server_error`, so
-- the OAuth handshake could never mint a code. TEXT removes the cap.
--
-- Non-destructive: VARCHAR(255) → TEXT is an in-place metadata change (no
-- rewrite, no data loss). RLS on `verifications` is unchanged (auth table:
-- ENABLE, no FORCE, no policy).

ALTER TABLE "verifications" ALTER COLUMN "value" TYPE text;
