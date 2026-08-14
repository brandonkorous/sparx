# Security and Privacy Requirements

Piggles will handle business, customer, commerce, scheduling, invoice, and potentially financial-adjacent data.

## Required controls

- TLS everywhere
- secure HttpOnly cookies
- CSRF protection
- rate limiting and brute-force protection
- MFA-ready authentication
- encrypted secrets
- least-privilege service accounts
- tenant-isolation tests
- audit logs for sensitive changes
- role-based access
- secure media validation
- dependency and secret scanning
- backup/restore testing
- incident runbook
- data export/delete workflows

## Tenant isolation

Every tenant-scoped request must derive business scope from trusted auth/session context, not untrusted client input alone.

## Billing

Avoid storing raw card data. Use provider tokenization.

## Logging

Never log passwords, auth tokens, secrets, raw payment details, or unnecessary personal data.
