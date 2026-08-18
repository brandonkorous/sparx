# WizeWorks — Brand & Build Documentation

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-30

---

## What this folder is

Everything needed to design, write, and build **the WizeWorks web presence** — the company that
builds sparx, kanNINJA, and client software.

This is the _parent brand_, not a product. sparx has its own brand guide
([docs/sparx-brand-guide.md](../sparx-brand-guide.md)) and its own marketing site
([sparx/apps/web](../../apps/web)). WizeWorks sits above both.

**The WizeWorks site will be built in sparx — entirely through the sparx MCP, as a tenant.**
No `@sparx/*` or `@wizeworks/*` package edits, no app code, no `globals.css`. Anything the MCP
can't do gets logged as a platform gap and worked around with tenant-only tools
([06](06-build-plan.md)). It is a tenant on our own platform — the same
builder, themes, CMS, and forms any customer gets. That is the point: the company that sells a
business platform runs its own business on it. Every constraint that makes this site harder to
build is a bug report against sparx.

---

## Who WizeWorks is for

Every company. Big or small, tech or beauty, trades or professional services, one location or
forty. This is not a hedge — it is the defining constraint on every decision in this folder.

Practically, that means:

- **No industry may be the default lens.** If an example, screenshot, or piece of copy assumes
  auto parts, it is wrong. Vary the verticals deliberately and constantly.
- **No technical vocabulary in customer-facing copy.** The reader is a business owner, not a
  developer. Terms that cannot be avoided get defined inline.
- **"For everyone" is proven by specificity, not asserted.** A general claim earns credibility
  from a set of specific industry pages that each speak that industry's language — see
  [01-design-research-2026.md](01-design-research-2026.md) §11.

---

## Document set

Numbered documents are meant to be read in order. Status reflects what exists today.

| #   | Document                                                   | What it covers                                                                                         |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 00  | **README** (this file)                                     | Index, scope, and how the pieces fit                                                                   |
| 01  | [Design research 2026](01-design-research-2026.md)         | What business platforms look like in 2026; archetypes, anatomy, budgets, the scorecard, open decisions |
| 02  | [Positioning & audience](02-positioning-and-audience.md)   | What WizeWorks is, who it serves, what it refuses, the offer ladder, the industry set, proof strategy  |
| 03  | [Voice & tone](03-voice-and-tone.md)                       | How WizeWorks sounds — principles, register, headline patterns, the rewrite table, hard bans           |
| 04  | [Brand & visual identity](04-brand-and-visual-identity.md) | Brand architecture, mark brief, color tokens, typography, layout, imagery, motion, the sparx theme     |
| 05  | [Site architecture & page specs](05-site-architecture.md)  | Sitemap, navigation, homepage section spec, page templates, answer-engine layer, acceptance criteria   |
| 06  | [Build plan](06-build-plan.md)                             | Modules, build order, content types, forms, expected platform gaps, launch checklist                   |

## Decisions on record

Settled 2026-07-30, from [01-design-research-2026.md](01-design-research-2026.md) §15:

| Decision               | Resolution                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Brand architecture** | Distinct parent identity. Products keep their own accent and mark inside the parent's type system                                 |
| **Spine**              | Solution provider that also has products — how we solve problems leads; the portfolio is proof                                    |
| **Typography**         | Display serif (Instrument Serif) + Geist Sans + Geist Mono                                                                        |
| **Photography**        | Pexels, under the strict art direction in [04 §7](04-brand-and-visual-identity.md) — never standing in for a customer or a person |

Added 2026-07-30:

- **No social proof.** No testimonials, logos, counts, or customer stories — a position, not a
  gap. The software is the proof ([02 §8](02-positioning-and-audience.md)).
- **Legal entity is WizeWorks LLC.** `WizeWorks, Inc.` was wrong in 11 shipped places across
  `sparx/apps/web` and `sparx/apps/market`; all corrected.
- **HelpNinja is discontinued.** The portfolio is sparx and kanNINJA.

- **Palette locked: earthy, and a full palette — not primary everywhere.** Warm bone chassis,
  a house trio (pine / brass / clay), eight industry hues, and product hues. **Every page must
  carry at least three hues by function**; a pine-and-neutrals page is a defect, and "fixing" a
  color disagreement by flattening it to primary is banned outright
  ([04 §4](04-brand-and-visual-identity.md)).

Still open: the wordmark and icon still need to be designed; kanNINJA's product hue; and whether
the industry set ships at eight or fewer.

---

## Binding rules inherited from the platform

The WizeWorks site is built with the same system as everything else here, and the same rules apply
without exception. In summary — full text in [CLAUDE.md](../../CLAUDE.md):

- **silicaui first, Tailwind second.** Anything else needs explicit approval, asked for up front.
- **Color comes from tokens, never hex.** No `style={...}` props.
- **No eyebrows** — nothing sits above a heading to introduce it, including a `<Badge>`.
- **No gradients, no shadows** as visual devices.
- **No faded ink on anything meant to be read.** Body text floor is 16px.
- **Docs carry `Version` / `Author` / `Last Updated`**, absolute ISO dates, bumped when edited
  materially.
- **No competitor names in shipped artifacts.** Describe patterns in our own language.

These are not stylistic preferences that a marketing site gets to opt out of. §13 of the research
document shows why: they are, almost exactly, the inverse of the 2026 "AI slop" signature. Holding
them is the cheapest differentiation available to us.

---

## Related documents outside this folder

- [docs/sparx-brand-guide.md](../sparx-brand-guide.md) — the sparx product brand
- [docs/00-README.md](../00-README.md) — the sparx platform documentation index
- [docs/brain/README.md](../brain/README.md) — the knowledge brain; start there for any
  non-trivial platform work
- [sparx/packages/brand/](../../packages/brand/) — the live brand tokens, marks, and React components
- [sparx/packages/ui/CLAUDE.md](../../packages/ui/CLAUDE.md) — component-library mechanics
