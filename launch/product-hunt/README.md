# Sparx — Product Hunt launch kit

Everything needed to submit Sparx to Product Hunt. **Lead angle:** AI/MCP-native —
_"The first business OS your AI agent can actually operate."_

## Contents

| File                                           | What it is                                                                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`product-hunt-copy.md`](product-hunt-copy.md) | **Paste-ready form copy.** Name, tagline (+4 backups), topics, 260-char description, the maker's first comment, pricing, social posts, and a pre-submit checklist. Every section maps 1:1 to a PH form field. |
| [`gallery/out/`](gallery/out/)                 | **The 8 final gallery images**, exported at 2540×1520 (renders as 1270×760 — PH's spec, @2x for retina). Upload in numbered order; `01-hero.png` is the feed thumbnail.                                       |
| [`gallery/`](gallery/)                         | The source: branded HTML frames (`frame.css`, `frame.html`, `01-hero.html`, `08-permanence.html`) + raw screenshots in `gallery/shots/`. Edit + re-render anytime (see below).                                |

## The gallery (narrative order)

The frames tell one story: **hook → platform → proof → permanence.**

1. **01-hero** — _The business OS your AI can actually operate._ A live MCP conversation: ask for your top customers, tell it to chase overdue fleet invoices — it reads CRM/B2B and sends via Email, all audited. This is the thumbnail.
2. **02-modules** — _One platform. Eight modules. One bill._ The unified dashboard.
3. **03-ai** — _Your AI doesn't just answer. It operates._ The native MCP server (read + write, scoped, audited).
4. **04-builder** — _Build it once. Keep it forever._ The visual no-code editor.
5. **05-sites** — _Content or commerce. Or both._ A real themed site with checkout + B2B.
6. **06-stack** — _Cancel the six-tool stack._ One data layer replaces Shopify + HubSpot + Mailchimp + Zapier.
7. **07-pricing** — _Pay only for what you use._ Modular pricing from $10/mo.
8. **08-permanence** — _AI builds it. Sparx keeps it._ The closing statement.

Frames are **hybrid**: real product surfaces (live marketing pages + the design-system
mockups in `/mockups`) embedded in branded 1270×760 cards built from the real Sparx
tokens. Frames 1 and 8 are bespoke brand cards. Sources, per frame, are listed in
`gallery/frame.html` and the capture script.

## Re-rendering the gallery

The images are produced by a headless Playwright pass (no browser window, won't touch
yours). Browsers are already installed in the repo.

```powershell
# from repo root, with `pnpm dev` running (live frames 03 + 07 capture localhost:3003)
node apps/dashboard/ph-capture.mjs   # writes gallery/shots/* then gallery/out/*
```

To change a caption or accent color, edit `gallery/frame.html` (the `FRAMES` config) or
the bespoke `01-hero.html` / `08-permanence.html`, then re-run. To swap a screenshot,
drop a new PNG into `gallery/shots/` (or repoint the source in the script) and re-run —
the branded frame re-wraps it automatically.

> The capture script (`apps/dashboard/ph-capture.mjs`) lives under `apps/dashboard` only
> so it can resolve `@playwright/test`. It's a build-time tool, not app code — delete it
> if you don't plan to re-render.

## Before you submit

See the checklist at the bottom of `product-hunt-copy.md`. The big ones: confirm the
tagline/description char counts, pick the 3 topics, paste the first comment the instant
the post is live, and schedule for **12:01 AM PT**.
