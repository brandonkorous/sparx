# 957 — Her articles were set at 16px

**Status:** fixed (act 7)
**Severity:** design
**Found by:** P09 · The Marrow Review · act 7, reading a full piece
**Surface:** every site's article and policy bodies (`.sparx-content`)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 7, "Who pays when the malting barley fails" at 390px
**Blocked on:** —

## What happened

Her brief: "Body type 18px, not 16", and "a real reading measure". Measured on "The last
mill on the Nene": body 16px at both 390px and 1280px. At 1280px the column is 768px,
which put 87 letters on a line.

The act 6 run log said "Spectral body at 18px". That was not measured on an article
body, and it was wrong; the log is corrected.

## The fix

`apps/site/app/globals.css`: `.sparx-content { font-size: 1.125rem; }`, the house reading
size, for every rich-text body a site draws (articles, posts, policy pages). In the same
768px column that is about 77 letters a line. Headings inside are in rem and keep their
sizes.

## Proof

At 390px the new piece's body measures 18px; the page is 390px wide. Site tests 412 pass.
