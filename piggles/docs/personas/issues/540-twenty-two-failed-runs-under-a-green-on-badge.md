# 540 — Twenty-two failed runs under a green "On" badge

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, opening Automations for the first time
**Surface:** `automation/src/actions/install-once.ts`, 10 install sites, `automations/automation-health.ts`
**Filed:** 2026-09-16

## What she saw

Automations. Twelve rules, every one of them badged **On**, in success green:

> | Name                         | Runs    | Last run        | Status |
> | ---------------------------- | ------- | --------------- | ------ |
> | Invoice overdue (7 days)     | ⚠ 8 · 8 | yesterday       | **On** |
> | Return approved: email       | ⚠ 4 · 4 | last week       | **On** |
> | Return received: email       | ⚠ 3 · 4 | last week       | **On** |
> | Post-purchase review request | ⚠ 5 · 7 | last week       | **On** |
> | Order refunded: email        | ⚠ 2 · 0 | **Not run yet** | **On** |

**Twenty-two of her thirty-one runs had failed.** Three rules had a run count of
**zero** — set off, failed, never once done the thing. "Return approved: email"
had failed all four times, so four customers whose return she approved were
promised a confirmation and got nothing.

And the Last run column said **"Not run yet"** for the three that had never
succeeded. They had run. They had not worked.

## Measured

```
73 failed runs, 4 tenants, most recent 2026-09-15

  no executor registered for action "email.send_campaign"   35
  no executor registered for action "crm.add_tag"           28
  no executor registered for action "crm.create_task"        8
  boom (a test fixture)                                      2
```

The telling part is per-action-type:

| action                | completed | failed |
| --------------------- | --------- | ------ |
| `crm.create_task`     | **446**   | 8      |
| `email.send_campaign` | **46**    | 35     |
| `crm.add_tag`         | **15**    | 28     |

**The same action both works and fails.** That is not a missing executor. That is
a process that booted badly.

## Why: a latch set before the work

Every action module guarded itself like this:

```ts
let installed = false;
export function installEmailActions(): void {
  if (installed) return;
  installed = true;            // ← set BEFORE registering anything
  registerAction({ type: 'email.send_campaign', … });
  …
}
```

If anything after that line throws, the module is left **part registered and
marked done**. Every later call returns immediately, and the process serves
traffic for the rest of its life with a registry missing whatever came after the
throw. Nothing says so. The next automation to need one of those actions fails
with "no executor registered", which reads like an unimplemented feature.

**Ten places had this shape**, including the engine's own
`ensureEngineInstalled`.

## And the badge was waiting on a state nothing produces

There IS an `error` status, with a "Needs attention" badge already shipped for
it. The engine says why it never arrives:

```ts
/** A single failed run does NOT flip the automation's own status to `error` —
 *  that pause-on-repeated-failure policy is a later (UI) slice. */
```

It never landed. **Zero of the platform's 2,411 automations carry `error`** —
2,313 active, 97 paused, 1 draft. So the Status column read a word that could
only ever be good news.

## Fixed

**1. `installOnce`** — one tested helper in the engine, replacing ten hand-rolled
flags. It latches on SUCCESS, so a throw leaves the flag down and the next caller
retries. A boot that cannot succeed now fails loudly every time instead of going
quiet once. 4 guards, one of which is exactly "does not latch when the setup
throws".

**2. `automationHealth`** — the Status badge now reads the counters that were
already on the row and already drawn two columns to its left. No sixth stored
word for another table to make stale:

| runs | failures | badge             |
| ---- | -------- | ----------------- |
| 12   | 0        | On                |
| 6    | 2        | **Some failures** |
| 0    | 4        | **Not working**   |

**3. `lastAttempt`** — a failed run writes `lastErrorAt`, not `lastRunAt`, and
the column only read the second. `lastErrorAt` was already fetched and nothing
drew it. It now reads **"3 weeks ago · failed"** in red.

Both are leaf modules with 10 guards each console, because a rule shaped like a
sentence rots inside a component.

## On screen

> | Return refunded: email | ⚠ 2 · 0 | **3 weeks ago · failed** | **Not working** |
> | Invoice overdue (7 days) | ⚠ 8 · 8 | **9 hours ago · failed** | **Some failures** |

## Still open

The engine still never sets `status = 'error'`, and nothing pauses a rule that
fails repeatedly. That is the policy slice its own comment describes, and it is a
behavior change (does an `error` rule stop matching?) rather than a display one.
The screen now tells the truth without it.

## Files

- `wizeworks/packages/automation/src/actions/install-once.ts` + `test/unit/install-once.test.ts` (new)
- `wizeworks/packages/automation/src/index.ts`, `src/actions/builtins.ts`
- `wizeworks/packages/automation-actions/src/{b2b,crm,email,forms,inventory,resolvers,sequences,social}.ts`
- `wizeworks/packages/automation-worker/src/runtime.ts`
- `piggles|sparx/apps/workbench/surfaces/automations/automation-health.ts` + `.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/automations/automations-list.tsx`, `automation-detail.tsx`
