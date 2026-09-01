# Piggles — follow-ups

**Version:** 1.12
**Author:** Brandon Korous
**Last Updated:** 2026-09-01

Things found while building that need a **decision** or **work outside the slice
that surfaced them**. One line per item in the register, detail below it.

This is not a bug list and not a backlog:

- **Known defects in what is built** live in [STATUS.md](../STATUS.md) — they are
  facts about the current tree, not open questions.
- **What to build next** lives in STATUS.md's `Next` section.
- **This file** holds the things that would otherwise be forgotten because they
  are nobody's current task: a decision deferred, a mechanism that is right today
  and wrong at a known future point, a deliberate omission somebody will later
  mistake for an oversight.

**When you close one, delete it and say so in the commit.** A register of
resolved items stops being read.

| #   | Item                                                     | Kind     | Bites when                               |
| --- | -------------------------------------------------------- | -------- | ---------------------------------------- |
| 3   | Piggles activations are absent from the WW board         | Decision | Someone asks what Piggles tenants use    |
| 4   | The console declares deps it does not import             | Decision | The first Piggles Dockerfile             |
| 8   | sparx's sign-in offers a Google button that may not work | Defect   | A sparx deployment without the OAuth env |

---

## 3. Piggles module activations are absent from the WizeWorks board

**Kind:** decision (currently deliberate — recorded so nobody "fixes" it blind)

`api-rest`'s activation path publishes to two buses: the tenant's own event bus
(`module.activated`, which drives all the seeding) and the WizeWorks platform
bus via `publishPlatformEvent`, which feeds the internal CRM board.

The Piggles account app's onboarding publishes only the first. The reasoning is
in `piggles/apps/account/lib/activate-modules.ts`: the platform bus records
COMMERCIAL activity, and under Piggles a module going on is not commercial —
there is one flat plan and nothing has been bought.

That reasoning holds for **billing**. It may not hold for **growth**: "which
apps do Piggles businesses actually turn on" is one of the more useful things
the board could answer about a brand whose entire premise is a different
packaging of the same platform, and today it cannot answer it at all.

Note this is narrower than it sounds — the board DOES see Piggles tenants and
what kind of business they are (`brand:piggles` as a contact tag, plus the
story fields on the deal; see STATUS). What is missing is app-level adoption.

Decide: leave it (module activation is not commercial and the board is a
commercial instrument), or publish it with a payload that makes clear no money
moved.

## 4. The console declares dependencies it does not directly import

**Kind:** decision · **Bites when:** the first Piggles Dockerfile is written

`piggles/apps/workbench/package.json` mirrors `sparx/apps/workbench`'s dependency
list — `dockview`, `@dnd-kit/*`, `driver.js`, `qrcode`, `socket.io-client`,
`geist` and the schema packages — even though the console's own 24 files import
almost none of them directly. They arrive through the shared surfaces it mounts.

The argument for declaring them: this app renders that component graph, so its
runtime closure genuinely IS that dependency set; a standalone build has to
trace them; and `transpilePackages` entries must resolve from the app root.

The argument against: a dependency nobody imports reads as cruft, and the two
lists will drift the first time one app adds something.

This becomes a real decision at deployment, because
`scripts/check-dockerfile-deps.mjs` is the guard against a workspace dependency
missing from an app image, and it is currently blind to both Piggles apps (see
STATUS). Whatever is decided here has to be what that checker enforces.

---

## 8. sparx's sign-in offers a Google button that may not work

**Kind:** defect, in a tree this workstream may not touch ·
**Bites when:** a sparx deployment runs without `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET`

The Piggles half of the old item 5 is fixed: `@wizeworks/auth` now answers
"which social sign-ins does this deployment actually have" in ONE place
(`social-providers.ts`), its own server config asks that function before
registering the provider, and the account app asks the same function before
drawing the button. They can no longer disagree.

**The sparx call site was already wrong and still is.**
`sparx/apps/workbench/components/auth-shell.tsx` renders its "Continue with
Google" button unconditionally, so on a deployment without those variables it
offers an entry that can only error — on the screen where somebody is least able
to tell a broken product from their own mistake.

`sparx/**` is off limits to this workstream (piggles/CLAUDE.md RULE #0: never
read, never edit), so this is recorded rather than fixed, and recorded as
inherited from the previous note rather than re-verified.

**The fix is now one line there**, because the primitive exists:

```ts
import { socialProviderConfigured } from '@wizeworks/auth';
// …
{socialProviderConfigured('google') ? <GoogleButton /> : null}
```
