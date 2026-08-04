# Example-business product photography

Product thumbnails for the storefront **mockups** — the order receipt on `/commerce`
and the checkout summary inside the annotated checkout frame. They fill the slot
that was a grey `bg-base-300` square, so the fake storefronts read as real shops
rather than wireframes.

One file per product in [`apps/web/lib/example-businesses.ts`](../../lib/example-businesses.ts);
the filename matches the `image` field on that product. Adding a product to a
business means adding a file here.

## Scope

These are **device fixtures**: product thumbnails that appear inside a rendered
mockup of the software, at ~32px square. That is all this directory is for.

Marketing photography — real photographs used in the page layout itself — is a
separate and equally deliberate thing, and it lives in
[`../scenes/`](../scenes/README.md) behind the shared `<PhotoBand>` section.
An earlier version of this file claimed the marketing pages carry no photography
by design. **That was wrong and has been reversed:** pages built only from type,
colour and UI mockups ask a visitor to read their way to the point, and most
won't. The rule that still stands is about the KIND of photograph — real people
doing real work, never generic business stock — not about whether to use any.

## Source & licence

All from [Pexels](https://www.pexels.com), used under the
[Pexels licence](https://www.pexels.com/license/): free for commercial use, no
attribution required, no permission needed. The licence does prohibit implying
that a depicted person or brand endorses the product — none of these depict an
identifiable person or a third-party brand mark, which is one of the reasons each
was chosen.

Fetched 2026-08-02 at 200×200 (dpr 2), `?auto=compress&cs=tinysrgb&fit=crop`.
Attribution is not required, but the source ID is recorded so any image can be
traced, re-fetched at another size, or replaced.

| File                 | Product              | Business            | Pexels ID                                          |
| -------------------- | -------------------- | ------------------- | -------------------------------------------------- |
| `linen-bedding.jpg`  | Linen Bedding Set    | Flax & Fern         | [30618181](https://www.pexels.com/photo/30618181/) |
| `down-pillow.jpg`    | Down Pillow          | Flax & Fern         | [7141039](https://www.pexels.com/photo/7141039/)   |
| `strawberries.jpg`   | Organic Strawberries | Hudson Farm Stand   | [38057544](https://www.pexels.com/photo/38057544/) |
| `raw-honey.jpg`      | Raw Honey, 16oz      | Hudson Farm Stand   | [5634212](https://www.pexels.com/photo/5634212/)   |
| `dog-collar.jpg`     | Leather Dog Collar   | Waggle Pet Co       | [17988058](https://www.pexels.com/photo/17988058/) |
| `name-tag.jpg`       | Engraved Name Tag    | Waggle Pet Co       | [6976592](https://www.pexels.com/photo/6976592/)   |
| `coffee-beans.jpg`   | Whole-Bean Sampler   | North Loop Roasters | [4177917](https://www.pexels.com/photo/4177917/)   |
| `pour-over-kit.jpg`  | Pour-Over Kit        | North Loop Roasters | [16839946](https://www.pexels.com/photo/16839946/) |
| `hydraulic-hose.jpg` | Hydraulic Hose Kit   | Atlas Supply Co     | [28101094](https://www.pexels.com/photo/28101094/) |
| `bearing-set.jpg`    | Bearing Set          | Atlas Supply Co     | [19911421](https://www.pexels.com/photo/19911421/) |

## Choosing a replacement

Every one of these renders at about 32px square. That is the whole brief, and it
rules out most otherwise-good photographs:

- **The product fills the frame.** A wide room shot becomes a grey smudge. Two
  candidates were rejected for this — a bedroom scene standing in for a pillow,
  and a honey jar lost on a large table.
- **Bright and in colour.** Two dark, low-key dog photographs and one black-and-white
  one were rejected: at thumbnail size they were featureless blobs, and the mono
  shot sat oddly among nine colour images.
- **No readable text or third-party branding.** Two pendant shots were rejected
  for carrying an engraved slogan.

Verify a replacement by opening it at actual size before committing it. Every
image here was inspected individually; four first-choice candidates did not
survive that check.
