# Ad creatives

Social/marketing ad images for sparx, kept in-repo so they're version-controlled
and reproducible. All are **1:1 (1092×1092)** — the shape Facebook, Instagram and
LinkedIn all accept.

Every creative uses only the real brand tokens (`@sparx/brand`): ink navy
`#0c1433`, ember `#e04631`, paper white — plus the real wordmark and mascot
geometry from [`packages/brand/src/marks.ts`](../packages/brand/src/marks.ts). No
invented colors, no gradients, no drop-shadow-as-device.

## Creatives

| File                                 | Style                                                                                                                                                                     | Notes                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `sparx-ad-one-window-mascot-1x1.png` | **Type-led** (monday.com-style). Ink-navy field, headline with the key line in ember, real wordmark, ember "Get started" pill, **sparky mascot poking in** from the edge. | The current lead creative.                                                                                                |
| `sparx-ad-floating-panels-1x1.png`   | **Product showcase.** Light/airy field, two real product windows (calendar + Deals) floating and overlapping, annotation callout cards, ember accent blobs.               | The Deals panel is captured at the old large window size, so its text is soft — recapture at a smaller window to sharpen. |
| `sparx-ad-browser-window-1x1.png`    | **Single hero window.** The workbench in a browser frame (`app.sparx.works`), full calendar with real bookings.                                                           | The plain, legible "what it actually looks like" shot.                                                                    |

## Reproducing

`src/gen-one-window-mascot.mjs` builds the type-led creative's HTML from the brand
geometry. Regenerate a creative by running its generator, serving the resulting
`ad-1x1.html` on `localhost`, and screenshotting the 1200×1200 `.card` (headless
Chrome would not cooperate on Windows during authoring, so these were captured from
a browser at 1092px).

## Truthfulness

None of these claim a customer count or name a company. If we get a real, defensible
number (active tenants, sites published, bookings taken), the type-led creative has
the exact slot for it — swap it into the ember accent line.
