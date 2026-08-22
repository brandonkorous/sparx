# 100 — The check before publishing said "1 things to look at"

**Status:** fixed
**Severity:** minor
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › My Site › Publish › Check my site
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on screen 2026-08-22

## What happened

Nia ran the pre-publish check before putting her site live. It found one thing:

> **1 things to look at across 4 pages.** None of them stops you publishing.

The check itself is good — it caught a real problem (an image block with no
picture in it) and named the page. The sentence reporting it does not agree with
itself.

The clean branch had the same fault waiting: a one-page site reads
"Nothing to fix across 1 pages."

## Why it matters

Minor, and worth fixing anyway. This console's voice is a feature — the whole
product is written for someone who is not technical, and the care shows on every
other screen. A sentence that does not parse in the moment before she publishes
her business's website is the wrong place to sound careless.

## Where it lives

[piggles/apps/workbench/surfaces/studio/publish-checks.tsx](../../../apps/workbench/surfaces/studio/publish-checks.tsx)
— two template literals, each pluralised by never doing it:

```ts
`${String(report.findings.length)} things to look at across ${String(report.pagesChecked)} pages.`;
```

## The fix

One helper, used by both branches and both counts:

```ts
/** "1 page", "2 pages" — a count nobody has to read past. */
function count(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? '' : 's'}`;
}
```

## Confirmed by

Re-run as Nia on 2026-08-22: the check reports **"Nothing to fix across 4 pages.
It reads well."**, and the one-finding form now reads "1 thing to look at".

## Rating effect

`My Site › Publish` is scored in [rating.md](../rating.md).
