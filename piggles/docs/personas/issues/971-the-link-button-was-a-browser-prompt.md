# 971 — The Link button was a browser prompt

**Status:** fixed (standing checks)
**Severity:** major
**Found by:** P09 · The Marrow Review · standing checks (linking one piece to another)
**Surface:** mypiggles › Content › any piece › the writing toolbar (both consoles, and product descriptions)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks, "The last mill on the Nene"
**Blocked on:** —

## What happened

She ended her mill piece with "A correction to this piece was published on 9 October"
and pressed **Link** to point it at the correction note. A grey browser box opened,
outside the design, saying **"Link URL"**. It could not show her own pieces, so she
had to know the note's address by heart. The other buttons were the same: "Embed URL:
a video (YouTube, Vimeo, Loom) ... Pasted as-is; the storefront re-validates before
rendering", "Code language (one of: bash, css, ...)", "Image URL" and "Alt text".

When the link was in, the full stop she typed after it became part of the link.

## Why

- `cms-editor/src/editor.tsx` asked every question with `window.prompt`.
- TipTap makes a link "inclusive" whenever autolink is on, so text typed at the end of
  any link joins it.

## The fix

- `cms-editor/src/ask-bar.tsx` (new): one box under the toolbar asks the question in
  the page, in plain words: **Link to**, **Video or audio to show here**, **Which
  language is this code in?** (a list), **Address of the picture** and **Describe the
  picture**. It says what is wrong with an answer and how to fix it. Escape backs out
  to where she was writing.
- `cms-editor/src/ask.ts` (new): what typed text means. `marrowreview.co.uk/about`
  gets `https://`, an email address becomes a mail link, an empty box takes the link
  off.
- The Link box finds her own published pages as she types a title, each with its kind
  and address (`surfaces/cms/link-suggest.ts`, both consoles, wired into the article
  form and product descriptions). With nothing selected, picking one puts its title in
  as the linked words.
- `extensions.ts`: a link ends where it ends (`inclusive: false`).

## Proof

- `ask.test.ts`: the address rules, no `window.prompt` in the editor (red on the old
  editor), and the link mark not inclusive (red without the fix). cms-editor 21 pass,
  type-check and lint clean.
- On screen: Link opened "Link to"; typing "last mill" listed her correction note and
  the mill piece with their addresses; picking the note put its title in as the link;
  a full stop typed next stayed outside it. Her live page now ends: `A correction to
this piece was published on 9 October: <a href="/articles/a-correction-to-the-last-mill-on-the-nene">A correction to "The last mill on the Nene"</a>.`
- A test script of mine (not the editor) split her last paragraph mid-word on the
  first try and saved it. Put right with her own History, **Bring back** version 8;
  the live page followed at once.
