# Track B findings — what the console fork left behind

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-16

`piggles/apps/workbench` was copied from `apps/workbench` on 2026-08-14
(piggles/CLAUDE.md RULE #0). 800 tracked files came from sparx; piggles has 839.
The delta is not what it looks like: the new files are mascot art and the console
chrome, and what the copy dropped is mostly **routes**, not components.

Method: file-by-file `git ls-files` diff of both trees, then every core system
traced from its source file to its mount site. A file existing proves nothing —
four of the six gaps below are files that copied across perfectly and that
nothing renders.

## What is present and correctly wired

Recorded so nobody re-audits it.

| System                                                                                | Evidence                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toast + confirm                                                                       | `ToastProvider` + `ImperativeAlertDialogProvider` at the root, [console-providers.tsx](../../apps/workbench/components/console-providers.tsx)                                                                                   |
| Notifications                                                                         | [lib/api/notifications.ts](../../apps/workbench/lib/api/notifications.ts) byte-identical (45 s poll, unread-only, bell limit 10); `<NotificationCenter />` at [topbar.tsx:335](../../apps/workbench/components/topbar.tsx#L335) |
| Periodic feedback ask                                                                 | [sentiment-chip.tsx](../../apps/workbench/components/feedback/sentiment-chip.tsx) byte-identical, mounted at [status-bar.tsx:310](../../apps/workbench/components/status-bar.tsx#L310)                                          |
| Feedback compose + threads                                                            | `FeedbackProvider` in [console-shell.tsx:303](../../apps/workbench/components/console-shell.tsx#L303), compose dialog, report-problem, list/thread panes                                                                        |
| Activity feed                                                                         | [lib/api/activity.ts](../../apps/workbench/lib/api/activity.ts) identical — projects `audit_logs`, so new modules appear free                                                                                                   |
| Crash + write-failure                                                                 | `RootBoundary`, `CrashListeners`, `WriteFailureReporter`, `ChromeBoundary`, per-pane `surface-mount` boundary                                                                                                                   |
| Product analytics                                                                     | PostHog — **ahead of sparx.** Piggles gates `init()` on the account's consent record; sparx inits unconditionally                                                                                                               |
| Compact / mobile                                                                      | `CompactConsole` is a full reimplementation of sparx's `MobileShell`, not a fallback                                                                                                                                            |
| Update, recents, saved views, print sheet, record board, launcher, deep links, popout | all present and mounted                                                                                                                                                                                                         |

**Real-time user tracking does not exist in either app.** No presence, no SSE, no
"who is online". socket.io ships in both but serves only the builder live session
and chat. If per-user presence is wanted it is new work for the platform, not a
port — it is out of scope for this migration and tracked as **B4**.

## Gap 1 — four OAuth callback routes are missing, and live surfaces link to them

Each surface builds `${window.location.origin}/…` as its redirect URI. On the
Piggles origin that path does not exist, so the provider redirects the customer
into a 404 after they have already authorised.

| Caller                                                                                                   | Route needed                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [surfaces/social/connections.tsx:507](../../apps/workbench/surfaces/social/connections.tsx#L507)         | `app/social/callback/page.tsx`             |
| [surfaces/seo/search-console.tsx:237](../../apps/workbench/surfaces/seo/search-console.tsx#L237)         | `app/seo/search-console/callback/page.tsx` |
| [surfaces/finance/accounting.tsx:805](../../apps/workbench/surfaces/finance/accounting.tsx#L805)         | `app/finance/accounting/callback/page.tsx` |
| [lib/onboarding/use-stripe-connect.ts:93](../../apps/workbench/lib/onboarding/use-stripe-connect.ts#L93) | `app/onboarding/stripe-callback/page.tsx`  |

All four are thin: they read the code from the query string and `postMessage` it
back through `window.opener` to the pane that opened the popup. sparx's are the
reference implementation.

## Gap 2 — MCP OAuth has metadata and no server

[lib/mcp-oauth-metadata.ts](../../apps/workbench/lib/mcp-oauth-metadata.ts) copied
across. Nothing serves it. Missing:

- `app/.well-known/oauth-authorization-server/route.ts`
- `app/.well-known/openid-configuration/route.ts`
- `app/oauth/consent/page.tsx` + `_components/consent-form.tsx` + `_lib/consent.ts`
- `app/oauth/consent/submit/route.ts`

[lib/safe-path.ts:6](../../apps/workbench/lib/safe-path.ts#L6) still documents the
`/sign-in?callbackURL=/oauth/consent` round trip. A Piggles tenant cannot connect
an MCP client at all.

Note the auth split: sparx's consent page redirects to its own `/sign-in`. Piggles
has no sign-in — the authority is `getpiggles.com`. The consent page must bounce
through the account app's handoff instead, which is why this is a port and not a
copy.

## Gap 3 — `/accept-invite` is absent, and the invite mails the wrong host

The team surface can send invitations
([surfaces/team/index.tsx:325](../../apps/workbench/surfaces/team/index.tsx#L325)).
The accept URL is assembled server-side by
[api-rest/routes/v1/team.ts:85](../../../services/api-rest/src/routes/v1/team.ts#L85)
from `appOrigin()` — which reads one global env var and falls back to
`https://app.sparx.works` ([links/src/server.ts:21](../../../packages/links/src/server.ts#L21)).

So a Piggles teammate is invited to sparx. Two bugs stacked: a cross-brand leak
and a page that would not exist even if the host were right. **Fix the origin
first (A2.1), then build the page.**

## Gap 4 — no route error boundaries

No `app/error.tsx`, no `app/global-error.tsx`. `RootBoundary` catches throws
inside the provider tree and `CrashListeners` recovers a tab whose chunks a
deploy purged, so this is partly covered — but a throw in the layout itself, or
in a route segment above the providers, falls through to Next's bare "Application
error" document. sparx wrote `error.tsx` specifically because that white page
_was_ the hard crash on deploy.

## Gap 5 — copied, never mounted

Nineteen files that read as shipped and render nowhere.

| What                                     | Evidence                                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/tour/*` (8 files) + `driver.js` dep | **Zero** references anywhere in `piggles/`. `FirstRunTour` and `ModuleTourOffers` are unreachable. `surfaces/first-run.tsx` replaced the first-run tour; the _module_ tour offers have no replacement. Both files render sparx marks — see [02-dependency-audit.md](02-dependency-audit.md) |
| `lib/billing/{notice,dismissal}.ts`      | Zero references. `components/billing/{billing-banner,trial-chip}.tsx` never copied, so nothing surfaces a capacity or trial state. Piggles has no tiers (RULE #2) but it _does_ have capacity limits, and nothing tells anyone they are near one                                            |
| `surfaces/onboarding/*`                  | The whole tree copied; `OnboardingGate` is never mounted. Onboarding lives in `apps/account`                                                                                                                                                                                                |
| `components/feedback/button.tsx`         | Unmounted — the topbar calls `feedback.openSend()` from its own help button at [topbar.tsx:348](../../apps/workbench/components/topbar.tsx#L348). Harmless, but it is a second copy of one control                                                                                          |

Each needs a decision recorded, not a default. Delete is a legitimate outcome and
is cheaper than a port; what is not legitimate is leaving a file that looks
finished and is unreachable.

## Gap 6 — browser chrome

No `favicon.ico`, `icon.svg`, or `apple-icon.png` under
`piggles/apps/workbench/app/`. The console tab is blank. `apps/account` has an
`icon.svg`; the console never got one. No `public/robots.txt` either, though the
layout does set `robots: { index: false, follow: false }` in metadata, so this is
belt-and-braces rather than a leak.

## Deliberate, not gaps

Recorded so they are not "fixed" by mistake.

- **No `api/auth/[...all]`, sign-in, sign-up, reset-password, `AuthWrapper`, or
  Google One Tap.** `getpiggles.com` is the auth authority; the console receives
  a session through the one-time handoff at `app/auth/callback`. A second thing
  that can mint a session is what the three-domain split exists to prevent. The
  2FA challenge _is_ handled, in
  [account/components/sign-in-form.tsx:118](../../apps/account/components/sign-in-form.tsx#L118).
- **`Rail` / `Toolbar` / `ModulePanel` / `MobileShell` absent.** Reimplemented as
  `AppRail` / `Topbar` / `AppPanel` / `CompactConsole`.
- **`app/health/route.ts` absent.** Piggles has `app/api/health/route.ts`; sparx
  carries both.
- **No `eslint.config.js`.** Flat config resolves from the repo root and turbo
  runs the workspace's `lint` script. Covered.
