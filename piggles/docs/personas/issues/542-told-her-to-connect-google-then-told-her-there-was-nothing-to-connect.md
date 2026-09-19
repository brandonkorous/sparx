# 542 — Told her to connect Google, then told her there was nothing to connect

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, looking at how people find her shop
**Surface:** `piggles|sparx/apps/workbench/surfaces/seo/performance.tsx`
**Filed:** 2026-09-16

## What she saw

Get Found → How people find you, two figures at the top:

> | Average score   | Visits from search        | Average position          | Pages to improve |
> | --------------- | ------------------------- | ------------------------- | ---------------- |
> | 81              | —                         | —                         | 13               |
> | across 96 pages | **connect Google to see** | **connect Google to see** | scoring under 70 |

And six inches below, on the same screen:

> **Coming soon**
> Google's own search numbers are not ready on this side yet. It is nothing to do
> with your account or your plan, and **there is nothing for you to switch on**.

Both cannot be true. She is told to go and connect something, then told the thing
does not exist.

## Why

Two different flags, and only the card read both:

```ts
const connected = scStatus.data?.connection?.status === 'connected'; // this business
const configured = scStatus.data?.configured ?? false; // the platform
```

The card branched on `configured` and got it right. The figures above it branched
only on `connected`:

```tsx
<StatDesc>{connected ? 'in the last 28 days' : 'connect Google to see'}</StatDesc>
```

So one blank, two causes — "you have not connected yours" and "there is nothing
to connect to" — and the line always said the first. The same shape as issues
[534](issues) and [541](issues), on a third screen.

## Fixed

`searchFigureNote` in `seo-words.ts`, both consoles: three cases, tested.

| platform set up | this business connected | line                  |
| --------------- | ----------------------- | --------------------- |
| yes             | yes                     | in the last 28 days   |
| yes             | no                      | connect Google to see |
| **no**          | no                      | **not ready yet**     |

4 guards each console, one of which is the defect stated directly: the blank
line must never contain the word "connect" when there is nothing to connect to.

On screen now:

> | Visits from search | Average position |
> | ------------------ | ---------------- |
> | —                  | —                |
> | not ready yet      | not ready yet    |

## Files

- `piggles|sparx/apps/workbench/surfaces/seo/seo-words.ts` + `.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/seo/performance.tsx`
