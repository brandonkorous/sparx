# 164 — Setting up her shop failed twice, then worked

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 1
**Surface:** getpiggles › Set up your business → api-rest furnishing
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** three reloads of the same pack from the console — below

## What happened

Devi pressed **Take me in**. It thought about it, then:

> We saved your details but could not finish setting things up. Please try again.

She pressed it again. Same sentence. She pressed it a third time and was let
straight into her business, with 116 products, 568 variants, 7 customers and 450
stock levels waiting for her.

Nothing changed between the second attempt and the third. Same answers, same
button, roughly a minute apart.

## What should have happened

Once. This is the product's headline promise measured ten times over — a working
business in under five minutes — and it is the first thing a new customer does.

## How to reproduce

Intermittently, on the **apparel** trade. Twice out of three here.

1. Sign up, reach **Set up your business**.
2. `Juniper Row`, **Clothing & accessories**, any ticks, look **Fashion Boutique
   (Minimal)**.
3. Press **Take me in**.

The other trades that have been run — salon (P02), food (P01) — have never done
it, and their tenants furnished first time.

## Why it matters

Twice is enough to lose somebody. She has already been told the software could
not finish, twice, with no idea whether pressing again will make things worse —
and she is a person who left a marketplace because she could not afford a month
of broken checkout.

It is also silent about what happened. The attempt writes nothing, so a support
conversation the next morning has no trace to look at: the tenant simply has no
customers and nobody can say why.

## Where it lives

[wizeworks/packages/db/src/sample-data/index.ts](../../../../wizeworks/packages/db/src/sample-data/index.ts) — `loadSampleData`
[wizeworks/packages/db/src/tenant-context.ts](../../../../wizeworks/packages/db/src/tenant-context.ts) — `withTenant`

`loadSampleData` does the whole pack inside one `withTenant`, and `withTenant`
calls `client.$transaction(fn)` **with no options**. Prisma's default interactive
transaction timeout is **5 seconds**.

Measured on the attempt that worked, from the rows it left behind:

|                |              |
| -------------- | ------------ |
| First insert   | 10:50:01.969 |
| Last insert    | 10:50:06.220 |
| **Span**       | **4.25s**    |
| Rows           | 559          |
| Prisma's limit | 5.00s        |

Three quarters of a second of headroom, and that is only the span between the
first and last row — the reads, the clear, and the transaction's own setup all
sit inside the same five seconds. Apparel is by far the largest pack: 116
products against salon's 6 and food's 10, because `apparel.ts` pulls in
`apparel-scale.ts`.

The failure mode is why nobody caught it. The load rolls back completely, so a
failed attempt leaves no partial rows, no half-written pack, and no evidence of
how close it came. The tenant just looks unfurnished.

**The distinction was already written down elsewhere in this package:**
`advisory-tick-lock.ts` sets `{ maxWait: 5_000, timeout: 600_000 }` with a
comment explaining that `maxWait` is time to GET a connection and `timeout` is
time to use it. The sample loader never got the same treatment.

## The fix

`withTenant` gains an optional `timeoutMs`, and the two bulk sample-data calls
pass it. Everything else keeps Prisma's defaults, because five seconds failing
loudly is the right guard for a request handler — the options object is omitted
entirely when nobody asks, so no other caller's behaviour changes.

- [tenant-context.ts](../../../../wizeworks/packages/db/src/tenant-context.ts) —
  `WithTenantOptions`, and `maxWait: 10_000` alongside it, keeping the
  connection-versus-usage distinction `advisory-tick-lock.ts` already documents.
- [sample-data/index.ts](../../../../wizeworks/packages/db/src/sample-data/index.ts) —
  `PACK_TIMEOUT_MS = 60_000` on `loadSampleData` **and** on `clearSampleData`.
  Removing apparel's 559 rows is the same bulk write in reverse, and act 1 of
  this persona is a customer doing exactly that on her first morning.

Sixty seconds rather than something larger on purpose: a load still has to fail
if it is genuinely stuck, and a minute is well past busy.

**What is NOT fixed, and is worth saying:** a rolled-back load leaves no trace,
so the only reason this was diagnosable was that the rows from the attempt that
worked could be timed. A failed furnish still tells its customer nothing and
leaves its operator nothing to read.

## Confirmed by

The console's **Practice data** pane runs the same `loadSampleData` on the same
apparel pack, so it is the screen that re-runs the step. Pressed **Reload sample
data → Replace it** three times in a row as Devi. All three came back "Saved just
now" with the pack intact — 101 products, 27 reviews, 913 stock movements, 104
images.

Each run, measured off the rows it wrote:

| Run | Insert span | Rows |
| --- | ----------- | ---- |
| 1   | 4.44s       | 559  |
| 2   | ~4.3s       | 559  |
| 3   | 4.26s       | 559  |

Against the 5.00s ceiling those had before, the margin was under three quarters
of a second every time — which is the same margin that lost twice at signup.
Three for three now, and the ceiling is no longer in the way.

**What this does not prove:** that those three particular runs would have failed
before. Nobody can prove that about a timing race. What is measured is the margin,
and it was never more than 15% of the limit.
