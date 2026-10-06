# 037 — No screen could turn on the cookie banner the Cookie Policy promises

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Legal pages (both consoles); tenant site cookie choices; the starter Cookie Policy
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2: Legal pages › Cookie banner › "Use cookies and let visitors opt out" + Analytics › Save; `consent_settings` = ccpa, ["analytics"]; the live site carried it 68 s later (see [040]); the Cookie Policy took the new wording, was published and marked reviewed; "All required pages ready"
**Blocked on:** —

## What happened

The Cookie Policy is a required page. Its starter text told visitors they could
manage cookies "through the cookie banner or the Manage cookies link in the
footer". The site has a full consent system (banner, choices dialog, opt-out
button) and `GET/PATCH /v1/tenant/consent`, but **no screen in either console
called that API**. Every site ran with the banner off, so the published policy
was false, and no owner could make it true.

Also:

- the visitor's choices dialog listed Preferences, Analytics and Marketing,
  whatever the site used;
- the starter text claimed all four kinds were in use, and named a footer link
  that does not exist (it is a button in the bottom corner).

## The fix

- New "Cookie banner" section on Legal pages, both consoles
  (`surfaces/cms/cookie-banner-*.ts(x)`, built by a helper agent, driven on screen
  here): Off / ask first / opt out in plain words, the kinds the site uses,
  optional title and message, a live "what visitors will see" summary computed
  with the server's own rule, explicit Save with leave-guard, and the site named
  when there is more than one. The Cookie Policy row warns when the policy is live
  and the banner is off.
- "Ask everyone again" was NOT built: changing the policy version does not re-ask
  visitors (the visitor's cookie carries no version), so the button would lie.
- Site `components/consent/consent-manager.tsx`: the choices list only the
  owner's kinds; with none it says so; proper names as labels.
- `legal-templates`: Cookie Policy wording made true, template version 4 → 5, so
  existing pages are OFFERED the new wording. Legal pages showed "Use the new
  wording" and it worked, with the old text kept in history.
- Piggles `legal-list.tsx` / `legal-checklist-rows.tsx` were split to meet its
  file rules when touched (`legal-actions.ts`, `legal-readiness.tsx`); copy unchanged.

Checks: both workbenches tsc 0, eslint 0, prettier clean, parity green, toolbars
green; site tsc 0; legal-templates 22/22, tsc 0.

**Visitor side, after the restart:** the banner showed "Cookies at Gillett Diesel",
a working "Cookie Policy" link and "Do Not Sell or Share My Info"; **Manage**
listed only "Strictly necessary" and "Analytics", the two kinds he uses.

**Not re-proved on screen:** the Piggles section (only another persona's account
is signed in there).

## Rating effect

Legal pages: a new section to score.
