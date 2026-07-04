---
title: Who we serve — non-technical business owners
node: business
type: reference
status: active
sources:
  - docs/01-platform-vision.md
  - docs/15-merchant-onboarding-prd.md
---

Our **primary users are non-technical business owners** — founders, operators, and entrepreneurs running their own content and/or commerce. **Not** developers, designers, or IT staff. Assume no technical vocabulary: they don't know (and shouldn't need to know) what a CNAME, a webhook, an API key, a DNS record, or a "canonical domain" is.

This is the **default persona for every user-facing surface** — labels, descriptions, empty states, errors, tooltips, onboarding steps, emails — unless a surface is explicitly for a technical audience (e.g. the MCP / developer docs).

**Copy is informative and detailed — never terse-and-cryptic.** Write for someone smart but unfamiliar: say what a thing is, why it matters, and exactly what to do, in their words rather than the system's. Name features by what people recognize (a person manages *their site's address*, not a "canonical domain override"). Spell out the steps. When a technical term is genuinely unavoidable, define it in plain language inline ("your domain provider — the company you bought the domain from, like GoDaddy or Namecheap"). A clear, slightly longer sentence beats a jargon-dense short one.

**Why:** a business owner who can't understand a label or an instruction is simply blocked — they can't turn to a developer, and vague or terse microcopy reads as "this tool isn't built for me." Clarity for the non-technical owner **is the product**, not a nicety. The domains-tab DNS rewrite is the worked example: numbered steps, plain field labels, one-click copy, "some providers call this Host." See [[terminology-drift]] for the cost of jargon leaking into shipped copy.

**How to apply:** before shipping any user-facing text, read it as a non-technical owner would. If a word assumes technical knowledge, replace or define it. If an instruction skips a step they'd need, add it. Reach for the `copywriter` agent for anything substantial. This governs the content layer of the [[design]] system and pairs with [[what-sparx-is]] ("tenant" not "merchant") and [[industry-agnostic]] (vary the vertical, keep the language plain).

Related: [[what-sparx-is]], [[industry-agnostic]], [[terminology]], [[design]]
