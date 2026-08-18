// Media slice — gives every sample product a hero image and every article a cover.
//
// Following the gold-standard farm-fresh blueprint pattern (photoSvg): imagery is a
// self-contained SVG data-URI (an industry-hue radial gradient + a big centered
// emoji), NOT a hot-linked stock photo. A remote photo service throttles/404s a
// chunk of any catalog; a data-URI always resolves, has no network dependency, and
// reads as a designed product panel. The tenant swaps these for real photography
// post-load. `GET /v1/public/media/:id` serves `data:` keys inline, so they render
// everywhere (cards, PDP, search, blog) with zero infra. Each fits well under the
// `media_assets.key` 1024-char cap.

import { SAMPLE_MEDIA_FILENAME_PREFIX } from '../markers';
import type { SampleArticle, SampleDataPack, SampleProduct } from '../types';
import type { ApplyCtx } from './context';

/** Industry → the brand hue baked into generated imagery (the data-URI can't read
 *  the tenant `--st-*` vars — it renders in an isolated <img> context). */
const INDUSTRY_HUE: Record<string, string> = {
  apparel: '#6366F1', // indigo
  food: '#F59E0B', // amber
  electronics: '#0EA5E9', // sky
  'auto-parts': '#F97316', // orange
  salon: '#EC4899', // pink
  fitness: '#10B981', // emerald
  professional: '#0891B2', // cyan
  wholesale: '#64748B', // slate
  generic: '#6366F1',
};

// keyword → emoji, tested against title + type + tags (lowercased). Each rule
// matches at a LEADING word boundary (`\b`) so plurals/suffixes hit ("jeans",
// "sneakers") while a keyword buried mid-word does NOT (so "overcoat" never matches
// "oat", "beanie" never matches "bean", "department" never matches "part"). Order is
// SPECIFIC → GENERIC so the right rule wins an overlap: garments before food (beanie
// before bean), webcam before the professional "web", hair before the food "olive".
const EMOJI_RULES: [RegExp, string][] = [
  // Apparel & wearables (specific garments first).
  [/\b(beanie|hat|cap)/, '🧢'],
  [/\b(sneaker|shoe|boot|footwear)/, '👟'],
  [/\b(sock)/, '🧦'],
  [/\b(overcoat|coat|jacket|hoodie|sweatshirt|outerwear)/, '🧥'],
  [/\b(jean|denim|trouser|chino|pant|legging)/, '👖'],
  [/\b(dress|skirt|gown)/, '👗'],
  [/\b(tee|t-shirt|shirt|blouse|crewneck|polo)/, '👕'],
  [/\b(bag|tote|backpack|purse|wallet)/, '👜'],
  // Personal care (before the food "olive oil" rule, so "hair oil" → bottle).
  [/\b(shampoo|conditioner|hair|serum|lotion|cream|skincare|balm|moisturiz)/, '🧴'],
  [/\b(nail|polish|manicure|pedicure)/, '💅'],
  // Electronics (webcam before the professional "web").
  [/\b(earbud|headphone|earphone|airpod|audio|speaker|sound)/, '🎧'],
  [/\b(keyboard)/, '⌨️'],
  [/\b(mouse)/, '🖱️'],
  [/\b(webcam|camera)/, '📷'],
  [/\b(ssd|drive|storage|memory|disk)/, '💾'],
  [/\b(bulb|lamp|smart|light)/, '💡'],
  [/\b(power|charger|battery|charge)/, '🔋'],
  [/\b(usb|hub|cable|adapter|dock)/, '🔌'],
  [/\b(laptop|monitor|desk|stand)/, '💻'],
  [/\b(phone|tablet|mobile)/, '📱'],
  // Food & beverage.
  [/\b(coffee|espresso|bean|roast|brew)/, '☕'],
  [/\b(tea|matcha|chai)/, '🍵'],
  [/\b(honey)/, '🍯'],
  [/\b(chocolate|cocoa|cacao|truffle)/, '🍫'],
  [/\b(granola|cereal|oat|snack|muesli)/, '🥣'],
  [/\b(olive|vinegar)/, '🫒'],
  [/\b(sauce|salsa|spice|pepper|chili|chilli)/, '🌶️'],
  [/\b(jam|preserve|marmalade)/, '🍓'],
  [/\b(mug|drinkware|cup|tumbler|glassware)/, '🍵'],
  // Fitness & wellness.
  [/\b(yoga|pilates)/, '🧘'],
  [/\b(dumbbell|weight|kettlebell|barbell)/, '🏋️'],
  [/\b(protein|supplement|vitamin|shake)/, '🥤'],
  [/\b(bottle|shaker|flask)/, '🍶'],
  [/\b(band|resistance|strap)/, '🎽'],
  [/\b(roller|recovery|massage|foam)/, '💆'],
  // Cleaning, packaging & wholesale.
  [/\b(glove)/, '🧤'],
  [/\b(towel|tissue|napkin|paper)/, '🧻'],
  [/\b(liner|trash|waste|bin)/, '🗑️'],
  [/\b(soap|cleaner|disinfectant|sanitiz|detergent|cleaning)/, '🧼'],
  [/\b(wrap|tape|carton|packag|shipping|box|pallet)/, '📦'],
  [/\b(floor|mop|broom|janitor)/, '🧹'],
  // Auto parts.
  [/\b(tire|wheel)/, '🛞'],
  [/\b(filter|brake|engine|diesel|turbo|tuner|exhaust|coolant|automotive)/, '🔧'],
  // Professional services.
  [/\b(audit|strategy|seo|consult|marketing|retainer|website|web|funnel)/, '💼'],
  [/\b(logo|brand|identity|design|creative)/, '🎨'],
  // Stationery / misc.
  [/\b(notebook|journal|stationery|pen|sticker|pin|planner)/, '📓'],
  [/\b(book|guide|manual)/, '📖'],
];

/** Per-industry fallback when no keyword rule matches. */
const INDUSTRY_FALLBACK_EMOJI: Record<string, string> = {
  apparel: '👕',
  food: '🍽️',
  electronics: '🔌',
  'auto-parts': '🔧',
  salon: '💇',
  fitness: '💪',
  professional: '💼',
  wholesale: '📦',
  generic: '📦',
};

export function industryHue(industry: string): string {
  return INDUSTRY_HUE[industry] ?? INDUSTRY_HUE.generic!;
}

function pickEmoji(haystack: string, industry: string): string {
  const h = haystack.toLowerCase();
  for (const [re, emoji] of EMOJI_RULES) if (re.test(h)) return emoji;
  return INDUSTRY_FALLBACK_EMOJI[industry] ?? '📦';
}

/** Lighten `#rrggbb` toward white by `amt` (0..1) for the gradient's top stop. */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number): number => Math.round(c + (255 - c) * amt);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** A self-contained SVG data-URI: a soft radial gradient (lighter tint easing to the
 *  industry hue) with the emoji centered — reads as a designed spotlight panel. */
function svgDataUri(emoji: string, fill: string, w: number, h: number): string {
  const tint = lighten(fill, 0.3);
  const fontSize = Math.round(Math.min(w, h) * 0.46);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<defs><radialGradient id="g" cx="0.5" cy="0.42" r="0.78">` +
    `<stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${fill}"/>` +
    `</radialGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<text x="${w / 2}" y="${Math.round(h * 0.5)}" font-size="${fontSize}" text-anchor="middle" ` +
    `dominant-baseline="central" ` +
    `font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${emoji}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function inferMime(key: string): string {
  if (key.startsWith('data:')) {
    const head = key.slice(5, Math.max(key.indexOf(','), 5));
    const mime = head.split(';')[0];
    return mime && mime.length > 0 ? mime : 'image/svg+xml';
  }
  if (/\.png(\?|$)/i.test(key)) return 'image/png';
  if (/\.(jpe?g)(\?|$)/i.test(key)) return 'image/jpeg';
  if (/\.webp(\?|$)/i.test(key)) return 'image/webp';
  return 'image/svg+xml';
}

/** The product's hero image key — the pack's explicit `image`, else a generated SVG. */
export function productImageKey(p: SampleProduct, industry: string): string {
  if (p.image) return p.image;
  const emoji =
    p.emoji ?? pickEmoji(`${p.title} ${p.productType} ${(p.tags ?? []).join(' ')}`, industry);
  return svgDataUri(emoji, industryHue(industry), 800, 800);
}

/** The article's cover image key — the pack's explicit `image`, else a generated SVG. */
export function articleImageKey(a: SampleArticle, industry: string): string {
  if (a.image) return a.image;
  const emoji = a.emoji ?? pickEmoji(a.title, industry);
  return svgDataUri(emoji, industryHue(industry), 1200, 630);
}

/** Create a sample MediaAsset (marked by its `sample-*` filename so Clear finds it)
 *  and return its id. Increments the images count. */
export async function createSampleImageAsset(
  ctx: ApplyCtx,
  args: { slug: string; key: string; alt: string; width: number; height: number }
): Promise<string> {
  const asset = await ctx.tx.mediaAsset.create({
    data: {
      tenantId: ctx.tenantId,
      key: args.key,
      originalFilename: `${SAMPLE_MEDIA_FILENAME_PREFIX}${args.slug}.svg`,
      mimeType: inferMime(args.key),
      byteSize: BigInt(args.key.length),
      width: args.width,
      height: args.height,
      altText: args.alt,
      status: 'ready',
    },
    select: { id: true },
  });
  ctx.counts.images += 1;
  return asset.id;
}

/** Give every sample product a primary hero image. Commerce-gated; run after the
 *  catalog so `productIdByKey` is populated. */
export async function applyProductImages(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('commerce')) return;
  for (const p of pack.products) {
    const productId = ctx.productIdByKey.get(p.key);
    if (!productId) continue;
    const assetId = await createSampleImageAsset(ctx, {
      slug: p.key,
      key: productImageKey(p, pack.industry),
      alt: p.title,
      width: 800,
      height: 800,
    });
    await ctx.tx.variantImage.create({
      data: {
        tenantId: ctx.tenantId,
        productId,
        mediaAssetId: assetId,
        position: 0,
        isPrimary: true,
        alt: p.title,
      },
    });
  }
}
