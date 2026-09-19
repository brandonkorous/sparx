# 618 — My security screen said a device signed in from "::"

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Signing in and security › Devices signed in
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen, before and after)

## What happened

> **Devices signed in**
> Every device currently signed in to your account. If you see one you do not
> recognize, sign it out and change your password.
>
> **Chrome on Windows** · This device
> **From ::** · Active 5 hours ago · Signed in 3 weeks ago

`::` is not a place. It is IPv6 for "all zeros" — what a socket reports when it
has no remote address to report.

The card has exactly one job: let me decide whether I recognize a device. So a
line on it is either evidence or it is nothing, and a placeholder printed as
though it were evidence is the worst of the three
([[feedback_never_present_absence_as_measurement]]).

## Why it happened

```text
{row.ipAddress ? `From ${row.ipAddress} · ` : ''}
```

The guard is `null` or `''`. `'::'` is a non-empty string, so it sailed through.

The field next to it was already handled. `describeDevice(userAgent)` answers
"Unknown device" rather than printing a raw user-agent string. The same thought,
applied to one of two adjacent fields ([[feedback_a_fix_leaves_its_neighbour_behind]]).

## The fix

New `where-from-words.ts`. Every value in it is what some layer writes when it
has nothing to write, not a blocklist of anything suspicious:

| value                | what writes it                                     |
| :------------------- | :------------------------------------------------- |
| `::`                 | IPv6 unspecified, no remote address on the socket  |
| `::1`                | IPv6 loopback, the machine talking to itself       |
| `0.0.0.0`            | IPv4 unspecified                                   |
| `127.0.0.1`          | IPv4 loopback                                      |
| `::ffff:127.0.0.1`   | loopback as Node reports it on a dual-stack socket |
| `unknown`            | what several proxies put in `x-forwarded-for`      |
| `null` / `undefined` | a stringified nothing                              |

Two other things it gets right that the old expression did not:

- **A forwarded chain keeps its FIRST entry.** `x-forwarded-for` is
  `client, proxy1, proxy2`; the hops are not where she is sitting, and the last
  one is our own load balancer.
- **The separator belongs to the clause.** Dropping the address used to be able
  to leave a stray `·` behind, which reads as a missing value, which is the
  thing being fixed.

The sign-out confirm dialog used the same value in a sentence ("It was last seen
from ::") and gets the same treatment.

## Guard

`where-from-words.test.ts`, **12 tests** in each console.

The one that matters most is the one that does NOT reject:

```ts
it('keeps a real IPv6 one', …)   // 2001:db8::42
```

Only the all-zeros and loopback forms mean nothing. Rejecting every v6 address
would be the same bug in reverse: silence where there IS evidence.

Proven red by restoring "any non-empty string is a place": **6 of 12** fail.

## Not changed

**The address is still a raw number when there is one.** It means little to a
non-technical owner, but it is something she can compare or hand to somebody,
and the recognizable part of the row is the line above it (Chrome on Windows,
active 5 hours ago). Turning an address into a place needs a geolocation lookup,
which is a service decision and a new outbound dependency.

## Still open

Nothing from this issue.
