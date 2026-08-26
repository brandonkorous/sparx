# 251 — "Nobody opened it" was green, and "twenty-three went out" was grey

**Status:** fixed and confirmed
**Severity:** design
**Found by:** P03 · Juniper Row · act 10 — scoring the sent broadcast in dark before rating it
**Surface:** mypiggles › Messages › Broadcasts › a sent broadcast › How it did
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 10 — the same six tiles, in dark: 23 in blue "On their way", both zeros plain

## What happened

Scoring the pane after [246]'s fix, in dark. The six tiles read:

```
Delivered      23   ← plain white
Opened          0   ← GREEN
Clicked         0   ← GREEN
Bounced         0   ← plain
Unsubscribed    0   ← plain
Spam complaints 0   ← plain
```

The two numbers meaning "nobody has opened this and nobody has clicked it" were
the only colored things on the screen, in success green. The one number meaning
"twenty-three emails went out" had no color at all.

## What should have happened

Color carries the meaning. A zero is not good news dressed in green, and the
one genuinely positive fact on the screen is not the one thing left grey.

## Why it matters

This is the screen an owner reads to find out whether her newsletter worked, and
its color says the opposite of its numbers. Green on `Opened 0` reads as a
result that is fine; there is nothing fine about nobody opening a newsletter,
and the sentence underneath — "0% of those sent" — is saying so at the same
moment.

It is the platform's own color rule from the other side. RULE #4's test is
whether the color lets you delete the explanation, and here the color
CONTRADICTS the explanation, so the owner has to read past it to get the answer.
Green means "this is going well" everywhere else in this console.

It also wastes the one thing worth coloring. **Delivered 23** is the fact she
came to this screen for, and it was the only tile with no color on it.

## Where it lives

[broadcast-stats.tsx](../../../apps/workbench/surfaces/email/broadcast-stats.tsx).
Three of the six tones were computed from the value and three were constants:

```tsx
<StatBlock label="Delivered" … tone="neutral" />
<StatBlock label="Opened"    … tone="success" />
<StatBlock label="Clicked"   … tone="success" />
<StatBlock label="Bounced"   … tone={stats.bounced > 0 ? 'warning' : 'neutral'} />
```

So the correct pattern was already in the file, three rows below the wrong one:
a tone is a statement about what the number MEANS, and a count of zero does not
mean the same thing as a count of forty. Bounced knew that. Opened did not.

This is a file I had just edited for [246] and did not look at in color. A
number's honesty was fixed and its color, contradicting it, was left in place —
which is what RULE #6's "not scored until you have seen it in dark" is for.

## The fix

Every tone is now derived from the value, and the Delivered tile's color tracks
the three states it already has sentences for:

| Tile                       | Color                                                |
| -------------------------- | ---------------------------------------------------- |
| Delivered, confirmed       | `success` — "Confirmed by the receiving mail server" |
| Delivered, handed over     | `info` — "On their way. Confirmations arrive…"       |
| Delivered, nothing sent    | plain — "Nothing has gone out yet"                   |
| Opened / Clicked, above 0  | `success`                                            |
| Opened / Clicked, at 0     | plain                                                |
| Bounced / Unsubscribed > 0 | `warning` (unchanged)                                |
| Spam complaints > 0        | `error` (unchanged)                                  |

Now the color and the sentence say the same thing, which is what makes the
color worth having.

The tone value `'neutral'` was renamed `'plain'` in the same pass. It never
emitted a color class — it is the colorless case, which is the correct control
for an untyped number and needs no approval — but naming it after the one token
that does need approval every time is an invitation to reach for the real thing.

## What it looked like once fixed

```
Delivered      23   ← blue, "On their way. Confirmations arrive over the next few minutes."
Opened          0   ← plain, "0% of those sent"
Clicked         0   ← plain, "0% of those sent"
```

Read in dark on her own sent broadcast. When the confirmations arrive it turns
green, and the sentence changes with it.

## Related

[246](246-delivered-nothing-a-minute-after-twenty-three-emails-went-out.md) is
the same six tiles, one pass earlier: the number was wrong then, the color was
wrong now, and both were saying "this campaign failed" about a campaign that had
not.

## Rating effect

`Messages › Broadcasts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
