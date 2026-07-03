---
title: "storefront" keeps resurfacing for the site system
node: lessons-learned
type: decision
status: active
sources:
  - docs/brain/business/terminology.md
---

**What happened:** `storefront` was renamed to **site** on 2026-06-13, yet it keeps coming back — including, tellingly, **woven through the first draft of this very brain** (README, CONTRACT, the design notes, even an `applies-to: [storefront]` value). The operator has corrected it ~20 times.

**Why it recurs — it's a *framing* bug, not vocabulary.** "storefront" is **not** the English default for a site: the plain word is **site** (long form *website*); "storefront" means a *store's* front — it is inherently commercial. So reaching for it isn't a language habit — it reveals that my accumulated context over-indexes on the **Commerce** module and quietly frames the whole platform as a store. That violates the core truth that sparx is a **site / content-and-*or*-commerce** OS where selling is *one optional module* ([[what-sparx-is]], [[industry-agnostic]]). The word is the symptom; **commerce-first framing is the disease** — the same bias that defaults examples to selling and to diesel. Fixing the vocabulary without fixing the framing just moves the leak. (A CORE memory rule didn't stop it because this isn't a term to memorize — it's a lens to correct.)

**The fix it produced:** the term list is pinned as [[terminology]] and **banner-flagged at the top of [[two-design-systems]]** — the note opened when working the site system — so the correction sits in front of you at build time, not buried in a passively-loaded memory. **Guard:** before writing "storefront" for anything other than a commerce sales-channel, it's **site**.

Related: [[terminology]], [[two-design-systems]]
