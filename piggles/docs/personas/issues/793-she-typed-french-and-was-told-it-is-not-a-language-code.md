# 793 — She typed "French" and was told it is not a language code

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 279
**Surface:** mypiggles + sparx workbench — `commerce.product.translations`, `cms.translation.detail`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

Devi sells into France. On the Silk twill scarf she opened **Other languages**,
which ends with a card headed "Add a language", and typed the language:

```
Add a language
Use the short code for the language: “es” for Spanish, “fr-CA” for Canadian
French, “de” for German.

Language code
French
That is not a language code. Try two letters, like “es”, optionally with a
country: “es-MX”.
```

A jewelry maker has no way to know that French is `fr`, and no way at all to
guess that Simplified Chinese is `zh-Hans`. The screen already knew: one card
above, the language she had added was named **French**, in words.

## This was fixed once, for one pane out of four

Issue 402 replaced exactly this text box with a named picker — and put the
picker in `surfaces/cms/translation-languages.ts`, where only the Content pane
could reach it. Four panes in this console ask "which language?":

```
piggles  cms.translation.detail          picker (issue 402)
piggles  commerce.product.translations   code box
sparx    cms.translation.detail          code box
sparx    commerce.product.translations   code box
```

Three of the four. The list of names existed, the naming function existed, and
`canonicalLocale` / `isValidLocale` / `localeName` were written out TWICE —
once under `surfaces/cms/` and once in `surfaces/commerce/products-data.ts` —
so the fix was built against one copy and the other went on refusing "French".
[[feedback_a_fix_leaves_its_neighbour_behind]]

`check:console-parity` does not compare `surfaces/**`, so nothing said.

## What was done

**One list, in `lib/languages.ts`, where every pane can see it.** The three tag
helpers moved there too and both old modules re-export them, so the screens that
read them keep reading them and there is only one list to add a language to.

**One control, in `components/add-language.tsx`**, used by all four panes.

```
Add a language
Pick the language you want to write this product in. Its own wording lives on
its own tab, and anything you leave empty falls back to your words.

Language   [ Choose a language        ▾ ]
Start typing to jump down the list. Not there? Choose “Another language…”.
```

The code box is still there, behind "Another language…", so the shortlist is a
shortcut rather than a ceiling (RULE #1).

## Proof

Driven as Devi on the Silk twill scarf. Opening the list gives language names in
her own language, alphabetical: Arabic, Bengali, Brazilian Portuguese, British
English, Canadian French, Czech… Typing **Span** jumps to **Spanish** and "Add
this language" enables.

The French wording she saved before the change reaches the site: the product
page at `?lang=fr` shows her French name, and a **Français** switcher appeared
on the page by itself.

## Files

- `piggles|sparx/apps/workbench/lib/languages.ts` (new)
- `piggles|sparx/apps/workbench/components/add-language.tsx` (new)
- `piggles|sparx/apps/workbench/surfaces/commerce/product-translations.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/products-data.ts`
- `piggles|sparx/apps/workbench/surfaces/cms/translations-locale.ts`
- `piggles/apps/workbench/surfaces/cms/translation-editor.tsx`
- `sparx/apps/workbench/surfaces/cms/translation-detail.tsx`
- deleted: `piggles/apps/workbench/surfaces/cms/translation-add-language.tsx`, `translation-languages.ts`
