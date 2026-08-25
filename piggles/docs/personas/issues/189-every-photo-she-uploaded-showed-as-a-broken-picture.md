# 189 — Every photo she uploaded showed as a broken picture

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 4
**Surface:** mypiggles › Sell › Product › Media
**Filed:** 2026-08-24
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 4, on screen

## What happened

Devi dropped three photographs of The Ash Overshirt onto the Media tab. All three
uploaded. All three rendered as a **broken-image glyph with the alt text beside
it** — "The Ash Overshirt in Clay, a soft terracotta, laid flat…", and the same
for Slate and Bone.

She has no way to tell which shot is which except by the colorway name underneath,
and no way to see whether the thing she uploaded is the thing she meant to upload.

## What should have happened

A photo she just handed the console appears in the console.

## Why it matters

Photographs are her product. She edits her own images and picks between near
identical frames, and the surface where that choice is made cannot show her any
of them. It affects **every product photo in the whole console**, not this
product: the same `next/image` route serves every thumbnail.

It is also silent. There is no error, no notice, no retry — three grey boxes that
look like a slow network.

## Where it lives

NOT the upload, and not the storage. The file is there and serves correctly:

```
GET /v1/public/media/file/<tenant>/originals/<id>/ash-overshirt-clay.jpg
→ 200  image/jpeg  31898
```

The console renders it through `next/image`, whose optimizer returns:

```
GET /_next/image?url=<that url>&w=640&q=75
→ 400  "url" parameter is not allowed
```

**That message has two causes, and this was the second one.** Next 16 refuses any
upstream image whose host resolves to a private or loopback address — an SSRF
guard — and it reports the refusal with the same sentence the allow-list uses. The
server log is the only place the two are told apart:

```
⨯ "upstream image" "http://localhost:3100/v1/public/media/file/…/ash-overshirt-clay.jpg"
  "resolved to private ip" "[\"::1\",\"127.0.0.1\"]"
```

In development the media host IS localhost, so the guard blocks every photograph
in the console, always. In production it is `media.sparx.works`, a public host,
and the guard never fires — which is why this never reached a deployed console and
why nobody hit it until someone uploaded a photo locally.

## The fix

`images.dangerouslyAllowLocalIP` in
[next.config.mjs](../../../apps/workbench/next.config.mjs), gated on
`NODE_ENV !== 'production'`. The flag exists for exactly this case, and the gate
is what makes it safe: `next build` sets `NODE_ENV=production`, so a deployed
console keeps the guard.

## The wrong diagnosis this issue carried first, and how it was caught

This file originally blamed the allow-list — `devMediaPatterns()` returning an
empty array through one of two silent paths — and that was **wrong**. The
committed function built the right pattern all along:

```
NEXT_PUBLIC_API_URL="http://localhost:3100"    (set, and it parses)
NODE_ENV=development                            (so the early return never fired)
→ { protocol: 'http', hostname: 'localhost', port: '3100',
    pathname: '/v1/public/media/**' }
→ matchRemotePattern(…, <the real URL>) === true
```

The evidence I had could not tell the two causes apart, because **they print the
same sentence**. I read a 400 saying "not allowed", found a function that could
plausibly produce one, and stopped — instead of reading the server's own log,
which names the cause outright. One outcome, two causes: the same shape as
[022](022-told-her-she-had-no-internet-when-the-server-was-down.md), met from the debugging side
rather than the user's.

## The hardening that was kept anyway

The allow-list rewrite stays, because the fault it removes is real even though it
was not firing here. `devMediaPatterns()` had two ways to return NOTHING in
silence — a `catch` reached by any unparseable value, and `??` defaulting only on
null and undefined so a **blank** `NEXT_PUBLIC_API_URL` went straight into it.
Now:

- the **loopback defaults are always present** (`localhost:3100` and
  `127.0.0.1:3100`), so a blank, missing or unparseable value costs nothing;
- a configured origin is **added**, never substituted;
- a scheme-less value is rejected explicitly, because `new URL('localhost:3100')`
  succeeds, as protocol `localhost:` with no host at all.

Checked across ten permutations of `NODE_ENV` × the env var: every one yields the
loopback patterns, and none yields an entry with an empty hostname.

## What it looked like once fixed

Sell › The Ash Overshirt › Media, on screen: three photographs, Clay in
terracotta, Slate in blue-grey, Bone in off-white, each under its colorway name.
Next restarted itself on the config change; no manual restart was needed.

## The storefront was never affected

Worth saying plainly, because it bounds the damage: `apps/site` drives
`next/image` through a CUSTOM LOADER (`lib/image-loader.ts`), so it never reaches
the optimizer and has no allow-list or SSRF guard in the path at all. Verified on
screen — the same three photographs render correctly on Juniper Row's live
product page. This was console-only. No shopper ever saw it.

## How to reproduce

Before the fix, every time, on any machine running the console locally.

1. Sell › Products › any product › **Media**.
2. Drop a JPEG on the box. It uploads.
3. The card shows a broken-image glyph.
4. The card's own `src` returns 400, `"url" parameter is not allowed`.
5. The dev server log says `resolved to private ip`.

## Rating effect

`Sell › Product › Media` is scored in [rating.md](../rating.md).
