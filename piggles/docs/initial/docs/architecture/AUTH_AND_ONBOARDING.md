# Authentication and Onboarding

## getpiggles.com owns

- sign up
- sign in
- email verification
- password reset
- invite acceptance
- plan selection
- billing setup
- business creation
- onboarding
- initial app selection
- initial branding
- initial site/business basics
- provisioning
- readiness checks

## mypiggles.com owns

- all normal post-onboarding work
- settings/admin after onboarding
- workspace state
- daily operations

## Onboarding outcome

The user should enter My Piggles with an account, a business, a usable workspace, initial apps selected, basic identity/branding, and enough setup to avoid an empty workbench.

## Recommended sequence

1. Create account
2. Verify email
3. Business name
4. What do you do?
5. Business type/use case
6. Contact basics
7. Choose what you want Piggles to help with
8. Brand basics
9. Optional import
10. Billing/trial
11. Provision workspace
12. "Your Piggles is ready"
13. Secure handoff to My Piggles

## App selection language

Ask: **What do you want Piggles to help with?**

Options can include:

- Build my site
- Sell products
- Sell services
- Take bookings
- Keep track of customers
- Send messages
- Send invoices
- Track stock
- Keep an eye on money

This configures the workspace. It does not change price.

## Provisioning state copy

- Creating your workspace
- Setting up your tools
- Adding your branding
- Preparing your site
- Almost there

## Security

Use short-lived handoff codes, OIDC/PKCE where applicable, secure HttpOnly cookies, CSRF protection, redirect allowlists, and no long-lived bearer token in query strings.
