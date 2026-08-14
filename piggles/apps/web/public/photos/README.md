# Photography

Real photographs used in the marketing layout itself — the picture half of a
[`<PhotoBand>`](../../components/marketing/photo-band.tsx), and the grid in the
"whoever you are" section.

## Why these exist

The first version of this homepage was built entirely from type and colour. It
was, accurately, described as basic — and that is not a stylistic position, it is
a gap. A visitor scanning a page takes in the pictures long before the prose; a
page with none asks them to read their way to the point, and most will not.

sparx learned the same thing and wrote it down in
[apps/web/public/scenes/README.md](../../../../../apps/web/public/scenes/README.md).
Worth reading before adding to this folder.

## What they show

Nine different KINDS of business, deliberately. Piggles is not a commerce product
or a services product — a bakery, a barber and a potter are equally the customer,
and the photography has to carry that before the copy claims it.

**Every entry below has been opened and looked at.** The subject column describes
what is in the frame, not what the file is called. That distinction is the whole
reason this table is worth keeping — see the next section.

| File              | Subject                                              |
| ----------------- | ---------------------------------------------------- |
| `bakery.jpg`      | Loaves on a bakery counter                           |
| `coffee-shop.jpg` | Staff working behind the counter of a busy café      |
| `barber.jpg`      | A barber finishing a client's cut                    |
| `florist.jpg`     | A chalk "fresh cut flowers" sign, tulips beside it   |
| `pottery.jpg`     | Clay-covered hands shaping a pot on a wheel          |
| `garage.jpg`      | A car on a lift above a working bench of tools       |
| `carpenter.jpg`   | A joiner kneeling to mark a length of timber         |
| `market.jpg`      | Punnets of tomatoes and corn on a market stall       |
| `seamstress.jpg`  | Two people working on a garment, pins and thread out |
| `homeware.jpg`    | Decorative plates displayed on a shop wall           |

## Two that had to be replaced, and why

Worth reading before adding to this folder, because both mistakes are cheap to
repeat and neither is caught by anything automated.

**A file name is not a description.** The original `cafe.jpg` was a wall of
decorative plates — no room, no tables, nobody in it — and it shipped captioned
as a café because the alt text was written from the file name rather than the
file. It is still here as `homeware.jpg`, which is what it actually shows. Open
every image before you write a word about it.

**Never replace an image in place — give the new one a new name.** Both files
above were first fixed by writing the new photograph over the old path, and both
kept rendering the old picture: `/_next/image?url=%2Fphotos%2Fcafe.jpg&w=…` is
the same URL before and after, and Next serves optimised images with a long
`max-age`. Clearing `.next/cache/images` was not enough, because the stale copy
was in the browser too — and on a live site it would be in the CDN and in every
returning visitor's cache, with nothing to invalidate it. Hence `coffee-shop.jpg`
and `garage.jpg`: a new path is the only reliable cache bust, and it forces the
name to describe the content, which is the other lesson on this page.

**Archive material does not look like a business.** The original `workshop.jpg`
was a heritage display of antique hand planes on a barn wall, and it sat under
copy about having several jobs on the go at once. Nothing in it was in progress,
because nothing in it had been touched in fifty years. The CC0 corpus skews
heavily toward museum and archive photography, which is exactly why the search
advice below says to prefer the Unsplash donation pool.

## Licence

**All of them are CC0 1.0 (public domain dedication)** — no attribution required, no
commercial restriction, no share-alike. Sourced from Wikimedia Commons, from the
Unsplash CC0 donation, and found via the Openverse API filtered to `license=cc0`.

CC0 was the deliberate filter rather than "free stock". Unsplash's own current
licence is permissive but **not** public domain and carries conditions that can
change under them; a CC0 dedication cannot be revoked. For imagery that ships on a
commercial marketing site under two brands, that difference is the whole point.

Originals were 1–14 MB each (up to 8533px wide). Each is cropped to a uniform
**1600×1067 (3:2)** and re-encoded at quality 4 — 73 MB of source became 2.3 MB
shipped. Keep that ratio when adding: `<PhotoBand>` assumes 3:2 and a mixed set
makes the section ragged.

```
ffmpeg -i in.jpg -vf "scale=1600:1067:force_original_aspect_ratio=increase,crop=1600:1067" -q:v 4 out.jpg
```

## Adding one

Search Openverse with `license=cc0`, prefer results titled `… (Unsplash)` on
Commons — that pool is professional photography rather than the museum and
archive material the rest of the CC0 corpus skews toward. Confirm the licence on
the Commons file page itself; the API has been wrong before. Then crop to 3:2 and
record it in the table above.

Wikimedia's CDN **rejects a generic user agent** — send a descriptive one or you
will silently save a 4 KB HTML error page named `.jpg`.
