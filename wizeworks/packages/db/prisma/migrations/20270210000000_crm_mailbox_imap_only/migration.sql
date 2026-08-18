-- CRM mailboxes: IMAP/SMTP only (docs/144 §5.2)
--
-- WHY THIS DROPS COLUMNS ONE MIGRATION AFTER ADDING THEM.
--
-- 20270209 shaped `crm_mailbox_connections` after scheduling's
-- CalendarConnection, which carries an OAuth token lifecycle because connecting
-- a Google Calendar needs one. Connecting a MAILBOX through the Gmail API or
-- Microsoft Graph is a different proposition: `gmail.readonly` is a RESTRICTED
-- scope, so Google requires an annual third-party CASA security assessment
-- before an app may use it in production, and Microsoft requires publisher
-- verification for Graph mail scopes. That is a recurring audit — and a vendor
-- holding a veto — as the standing price of one connector.
--
-- IMAP reaches the same mailboxes. Gmail and Microsoft 365 both speak it, over
-- an app password the tenant issues in their own account settings and revokes
-- the same way, which also puts the tenant rather than sparx in the consent
-- loop. So the OAuth half of this table describes a capability the platform has
-- decided not to have, and a column named `access_token_enc` on a table that
-- stores no tokens is an invitation to half-build the thing again.
--
-- Safe to drop: the columns have never been written to. The feature was built
-- and removed inside one unreleased change set.

ALTER TABLE "crm_mailbox_connections"
    DROP COLUMN IF EXISTS "connection_kind",
    DROP COLUMN IF EXISTS "credential_source",
    DROP COLUMN IF EXISTS "access_token_enc",
    DROP COLUMN IF EXISTS "refresh_token_enc",
    DROP COLUMN IF EXISTS "token_expires_at",
    DROP COLUMN IF EXISTS "oauth_client_id",
    DROP COLUMN IF EXISTS "oauth_client_secret_enc",
    DROP COLUMN IF EXISTS "channel_id",
    DROP COLUMN IF EXISTS "channel_expires_at";

-- Every remaining connection is IMAP/SMTP. Stated as a constraint rather than a
-- convention so a future code path cannot quietly reintroduce a provider whose
-- credentials this table no longer has anywhere to put.
ALTER TABLE "crm_mailbox_connections"
    DROP CONSTRAINT IF EXISTS "crm_mailbox_connections_provider_supported";
ALTER TABLE "crm_mailbox_connections"
    ADD CONSTRAINT "crm_mailbox_connections_provider_supported"
    CHECK ("provider" = 'imap_smtp');

-- A connection that cannot say where to read and where to send is not a
-- connection. The columns are individually nullable because a row is written in
-- one statement, but the ROW must be complete.
ALTER TABLE "crm_mailbox_connections"
    DROP CONSTRAINT IF EXISTS "crm_mailbox_connections_hosts_present";
ALTER TABLE "crm_mailbox_connections"
    ADD CONSTRAINT "crm_mailbox_connections_hosts_present"
    CHECK ("imap_host" IS NOT NULL AND "smtp_host" IS NOT NULL);
