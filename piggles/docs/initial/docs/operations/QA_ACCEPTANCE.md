# QA and Acceptance Criteria

## Definition of done for Piggles shell

- Piggles branding applied consistently
- no visible Sparx branding in Piggles runtime
- Piggles terminology used in normal customer surfaces
- MDI works with keyboard and pointer
- workspace state persists
- responsive fallback is defined
- auth handoff is secure
- onboarding produces a usable workspace
- app enablement does not change price
- entitlement checks are centralized
- tenant isolation tests pass
- no critical accessibility violations
- analytics events fire
- error monitoring is active

## Cross-product regression

If services are shared with Sparx:

- Piggles changes must not silently break Sparx;
- shared contracts need regression coverage;
- product adapters need tests.

## Core journey tests

1. New user → onboarding → My Piggles
2. Existing user → sign in → workspace restore
3. Enable Bookings → appears in workspace → no billing event
4. Reach capacity warning → expansion path
5. Add team member → permissions respected
6. Publish site → tenant site resolves
7. Custom domain → correct tenant
8. Send email → correct sender/reputation path
