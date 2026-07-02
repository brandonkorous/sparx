// Fitness sample pack — a boutique studio/gym where SCHEDULING is the star: group
// classes (yoga/spin/HIIT/Pilates) plus 1-on-1 training and an intro consult, run
// by instructors across two studio rooms. Data-as-code: bookable services matched
// to staff + space resources (the engine generates the booking instances), a small
// branded retail catalog with stock + reviews + Q&A, members, training articles,
// and a New Member Starter Kit bundle. Loading it makes a wellness tenant feel real.

import { doc, h2, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const fitnessPack: SampleDataPack = {
  industry: 'fitness',
  label: 'Fitness & wellness',
  summary:
    'A boutique fitness studio: group classes and 1-on-1 training booked against instructors and studio rooms, plus a branded retail shop with apparel, supplements, and gear, member reviews, training articles, and a new-member starter kit.',

  warehouses: [
    {
      key: 'STUDIO',
      code: 'STUDIO',
      name: 'Front Desk Retail',
      type: 'owned',
      city: 'Boulder',
      region: 'CO',
    },
  ],

  categories: [
    { key: 'apparel', name: 'Apparel', handle: 'apparel' },
    { key: 'supplements', name: 'Supplements', handle: 'supplements' },
    { key: 'gear', name: 'Gear', handle: 'gear' },
  ],

  collections: [
    {
      key: 'member-favorites',
      name: 'Member Favorites',
      handle: 'member-favorites',
      featured: true,
    },
    { key: 'new', name: 'New', handle: 'new' },
  ],

  personas: [
    {
      key: 'alex',
      name: 'Alex Rivera',
      email: 'alex.rivera',
      phone: '+1-303-555-0117',
      line1: '412 Pearl St',
      city: 'Boulder',
      region: 'CO',
      postalCode: '80302',
    },
    {
      key: 'jordan',
      name: 'Jordan Lee',
      email: 'jordan.lee',
      phone: '+1-720-555-0148',
      line1: '88 Spruce Mountain Ave',
      city: 'Denver',
      region: 'CO',
      postalCode: '80211',
    },
    {
      key: 'maya',
      name: 'Maya Chen',
      email: 'maya.chen',
      phone: '+1-303-555-0162',
      line1: '1530 Folsom St',
      city: 'Boulder',
      region: 'CO',
      postalCode: '80302',
    },
    {
      key: 'devon',
      name: 'Devon Brooks',
      email: 'devon.brooks',
      phone: '+1-970-555-0193',
      line1: '275 Linden Ave',
      city: 'Fort Collins',
      region: 'CO',
      postalCode: '80524',
    },
    {
      key: 'sofia',
      name: 'Sofia Alvarez',
      email: 'sofia.alvarez',
      phone: '+1-720-555-0136',
      line1: '64 Cherry Creek Dr',
      city: 'Denver',
      region: 'CO',
      postalCode: '80206',
    },
    {
      key: 'noah',
      name: 'Noah Whitman',
      email: 'noah.whitman',
      phone: '+1-303-555-0179',
      line1: '903 Walnut St',
      city: 'Louisville',
      region: 'CO',
      postalCode: '80027',
    },
  ],

  products: [
    {
      key: 'studio-tee',
      title: 'Studio Performance Tee',
      handle: 'studio-performance-tee',
      description:
        '<p>Our house performance tee in a lightweight, sweat-wicking blend that moves with you through every flow and sprint. Cut for an athletic-but-relaxed fit — long enough to stay put through forward folds, loose enough to breathe on the bike.</p><p>Flatlock seams to kill chafe, a tag-free neck, and a quick-dry finish that comes out of the wash ready for the next class. Screened with the studio mark on the left chest.</p>',
      productType: 'Apparel',
      vendor: 'House Label',
      tags: ['tee', 'apparel', 'performance', 'unisex'],
      seoTitle: 'Studio Performance Tee — Sweat-Wicking Workout Shirt',
      seoDescription:
        'Lightweight, quick-dry performance tee built for class. Flatlock seams, tag-free neck, athletic fit.',
      categoryKeys: ['apparel'],
      collectionKeys: ['member-favorites'],
      options: [
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Slate', swatchHex: '#475569' },
            { value: 'Sand', swatchHex: '#D6CCB8' },
          ],
        },
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }],
        },
      ],
      variants: [
        {
          key: 'tee-slate-s',
          sku: 'TEE-SLATE-S',
          title: 'Slate / S',
          priceCents: 3200,
          costCents: 1100,
          optionValues: ['Slate', 'S'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 8,
              reorderQuantity: 40,
              leadTimeDays: 14,
              movements: [
                { delta: 40, reason: 'receive', daysAgo: 26 },
                { delta: -6, reason: 'sale', daysAgo: 11 },
                { delta: -4, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          key: 'tee-slate-m',
          sku: 'TEE-SLATE-M',
          title: 'Slate / M',
          priceCents: 3200,
          costCents: 1100,
          optionValues: ['Slate', 'M'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 10,
              reorderQuantity: 48,
              leadTimeDays: 14,
              movements: [
                { delta: 48, reason: 'receive', daysAgo: 26 },
                { delta: -12, reason: 'sale', daysAgo: 9 },
                { delta: -7, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
        {
          key: 'tee-sand-m',
          sku: 'TEE-SAND-M',
          title: 'Sand / M',
          priceCents: 3200,
          costCents: 1100,
          optionValues: ['Sand', 'M'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 10,
              reorderQuantity: 48,
              leadTimeDays: 14,
              movements: [
                { delta: 48, reason: 'receive', daysAgo: 26 },
                { delta: -9, reason: 'sale', daysAgo: 8 },
                { delta: -1, reason: 'recount', daysAgo: 1 },
              ],
            },
          ],
        },
        {
          key: 'tee-sand-l',
          sku: 'TEE-SAND-L',
          title: 'Sand / L',
          priceCents: 3200,
          costCents: 1100,
          optionValues: ['Sand', 'L'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 8,
              reorderQuantity: 40,
              leadTimeDays: 14,
              movements: [
                { delta: 40, reason: 'receive', daysAgo: 26 },
                { delta: -5, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'My go-to class shirt',
          body: 'Stays put through every flow and never gets that swampy feel. Bought a second in Sand.',
          authorPersona: 'maya',
          response: 'Love hearing it, Maya — see you in Vinyasa!',
          helpfulCount: 7,
          daysAgo: 14,
        },
        {
          rating: 4,
          title: 'Great fit, runs slightly long',
          body: 'Quality is excellent. The M is a touch long on me but tucks fine. Would buy again.',
          authorPersona: 'devon',
          helpfulCount: 3,
          daysAgo: 8,
        },
      ],
      questions: [
        {
          body: 'Is this true to size or should I size up for a looser fit?',
          authorPersona: 'jordan',
          answer:
            'It is true to size with an athletic cut. If you want it loose, size up one — the fabric has a little give either way.',
          daysAgo: 10,
        },
      ],
    },
    {
      key: 'studio-leggings',
      title: 'High-Rise Studio Leggings',
      handle: 'high-rise-studio-leggings',
      description:
        '<p>Buttery-soft high-rise leggings with a wide, no-dig waistband that holds through every squat, lunge, and inversion. Four-way stretch and a brushed interior keep them opaque and comfortable from warm-up to cooldown.</p><p>A hidden waistband pocket fits a key or a gel, and the squat-proof knit means you can move without a second thought. Sold in a single inseam that hits at the ankle on most.</p>',
      productType: 'Apparel',
      vendor: 'House Label',
      tags: ['leggings', 'apparel', 'high-rise', 'squat-proof'],
      seoTitle: 'High-Rise Studio Leggings — Squat-Proof & Buttery Soft',
      seoDescription:
        'High-rise, four-way-stretch leggings with a no-dig waistband and hidden pocket. Squat-proof and opaque.',
      categoryKeys: ['apparel'],
      collectionKeys: ['member-favorites', 'new'],
      options: [
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Black', swatchHex: '#111827' },
            { value: 'Olive', swatchHex: '#556B2F' },
          ],
        },
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'XS' }, { value: 'S' }, { value: 'M' }, { value: 'L' }],
        },
      ],
      variants: [
        {
          key: 'leg-black-s',
          sku: 'LEG-BLACK-S',
          title: 'Black / S',
          priceCents: 6800,
          compareAtPriceCents: 7800,
          costCents: 2600,
          optionValues: ['Black', 'S'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 6,
              reorderQuantity: 30,
              leadTimeDays: 21,
              movements: [
                { delta: 30, reason: 'receive', daysAgo: 22 },
                { delta: -8, reason: 'sale', daysAgo: 10 },
                { delta: -5, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
        {
          key: 'leg-black-m',
          sku: 'LEG-BLACK-M',
          title: 'Black / M',
          priceCents: 6800,
          compareAtPriceCents: 7800,
          costCents: 2600,
          optionValues: ['Black', 'M'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 8,
              reorderQuantity: 36,
              leadTimeDays: 21,
              movements: [
                { delta: 36, reason: 'receive', daysAgo: 22 },
                { delta: -14, reason: 'sale', daysAgo: 7 },
                { delta: -3, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
        {
          key: 'leg-olive-m',
          sku: 'LEG-OLIVE-M',
          title: 'Olive / M',
          priceCents: 6800,
          costCents: 2600,
          optionValues: ['Olive', 'M'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 6,
              reorderQuantity: 30,
              leadTimeDays: 21,
              movements: [
                { delta: 30, reason: 'receive', daysAgo: 18 },
                { delta: -7, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Actually squat-proof',
          body: 'Tested in the mirror at the squat rack — fully opaque. The waistband never rolls down during burpees.',
          authorPersona: 'sofia',
          helpfulCount: 12,
          daysAgo: 16,
        },
        {
          rating: 5,
          title: 'Worth it',
          body: 'Pricey but I reach for these over everything else in the drawer. The pocket is clutch for my locker key.',
          authorPersona: 'alex',
          response: 'So glad they earned a spot in the rotation!',
          helpfulCount: 6,
          daysAgo: 9,
        },
      ],
      questions: [
        {
          body: 'How high does the waistband sit? I do a lot of inversions in yoga.',
          authorPersona: 'maya',
          answer:
            'True high-rise — it lands above the navel and stays there in headstands and forward folds. No rolling.',
          daysAgo: 12,
        },
      ],
    },
    {
      key: 'shaker-bottle',
      title: 'Insulated Shaker Bottle (24 oz)',
      handle: 'insulated-shaker-bottle-24oz',
      description:
        '<p>A 24 oz double-wall stainless shaker that keeps water cold for hours and mixes a clump-free shake in seconds. The stainless agitator ball does the work; the leak-proof flip lid means it can ride in your bag next to your phone without a soggy surprise.</p><p>Fits a standard cup holder, the wide mouth takes ice cubes, and the powder-coated finish shrugs off gym-bag scuffs. Carries the studio mark.</p>',
      productType: 'Gear',
      vendor: 'House Label',
      tags: ['bottle', 'shaker', 'gear', 'hydration'],
      seoTitle: 'Insulated Shaker Bottle 24 oz — Leak-Proof Stainless',
      seoDescription:
        'Double-wall stainless shaker with agitator ball and leak-proof lid. Keeps drinks cold for hours.',
      categoryKeys: ['gear'],
      collectionKeys: ['member-favorites'],
      options: [
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Charcoal', swatchHex: '#36454F' },
            { value: 'Mint', swatchHex: '#A8D5BA' },
          ],
        },
      ],
      variants: [
        {
          key: 'shaker-charcoal',
          sku: 'SHAKER-CHARCOAL',
          title: 'Charcoal',
          priceCents: 2400,
          costCents: 850,
          optionValues: ['Charcoal'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 12,
              reorderQuantity: 60,
              leadTimeDays: 10,
              movements: [
                { delta: 60, reason: 'receive', daysAgo: 24 },
                { delta: -18, reason: 'sale', daysAgo: 9 },
                { delta: -11, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          key: 'shaker-mint',
          sku: 'SHAKER-MINT',
          title: 'Mint',
          priceCents: 2400,
          costCents: 850,
          optionValues: ['Mint'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 12,
              reorderQuantity: 60,
              leadTimeDays: 10,
              movements: [
                { delta: 60, reason: 'receive', daysAgo: 24 },
                { delta: -22, reason: 'sale', daysAgo: 8 },
                { delta: -5, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'No more clumps',
          body: 'The metal ball actually works — my protein mixes smooth and the lid has never leaked in my bag.',
          authorPersona: 'noah',
          helpfulCount: 4,
          daysAgo: 11,
        },
      ],
      questions: [
        {
          body: 'Is it dishwasher safe?',
          displayName: 'HydrateOrDieRdt',
          answer:
            'Top-rack dishwasher safe, though we recommend hand-washing the lid to keep the seal in top shape.',
          daysAgo: 6,
        },
      ],
    },
    {
      key: 'resistance-bands',
      title: 'Resistance Band Set (3-Pack)',
      handle: 'resistance-band-set-3pack',
      description:
        '<p>A three-band set — light, medium, and heavy — that covers everything from glute activation to assisted pull-ups. Made from natural latex with a fabric-free finish that grips without rolling or snapping on the skin.</p><p>Color-coded by resistance and small enough to live in your bag, these are the most-used tool in the studio for warm-ups and at-home days. Comes with a mesh carry pouch.</p>',
      productType: 'Gear',
      vendor: 'House Label',
      tags: ['resistance bands', 'gear', 'mobility', 'strength'],
      seoTitle: 'Resistance Band Set (3-Pack) — Light, Medium, Heavy',
      seoDescription:
        'Three color-coded latex resistance bands for activation, strength, and mobility. Includes carry pouch.',
      categoryKeys: ['gear'],
      collectionKeys: ['member-favorites', 'new'],
      variants: [
        {
          key: 'bands-set',
          sku: 'BANDS-SET3',
          title: null,
          priceCents: 1900,
          costCents: 650,
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 15,
              reorderQuantity: 75,
              leadTimeDays: 12,
              movements: [
                { delta: 75, reason: 'receive', daysAgo: 27 },
                { delta: -20, reason: 'sale', daysAgo: 12 },
                { delta: -14, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Use them every single day',
          body: 'Glute activation before squats, banded pull-aparts at my desk — these live in my bag now.',
          authorPersona: 'devon',
          helpfulCount: 9,
          daysAgo: 13,
        },
        {
          rating: 4,
          title: 'Heavy band is no joke',
          body: 'The heavy band is genuinely tough. Light and medium are perfect for warm-ups.',
          displayName: 'BandedBeth',
          helpfulCount: 2,
          daysAgo: 5,
        },
      ],
      questions: [],
    },
    {
      key: 'protein-powder',
      title: 'Whey Protein Powder (2 lb)',
      handle: 'whey-protein-powder-2lb',
      description:
        '<p>A clean 24g-per-scoop whey isolate blend that mixes smooth and actually tastes good. No artificial dyes, no gritty aftertaste — just a recovery shake you will look forward to after class.</p><p>Roughly 28 servings per tub. Mix one scoop with 8–10 oz of water or milk; pairs perfectly with the studio shaker bottle. Choose your flavor below.</p>',
      productType: 'Supplements',
      vendor: 'House Label',
      tags: ['protein', 'supplements', 'whey', 'recovery'],
      seoTitle: 'Whey Protein Powder (2 lb) — 24g Clean Whey Isolate',
      seoDescription:
        '24g-per-scoop whey isolate that mixes smooth and tastes great. No artificial dyes. ~28 servings.',
      categoryKeys: ['supplements'],
      collectionKeys: ['member-favorites'],
      options: [
        {
          name: 'Flavor',
          displayType: 'radio',
          values: [{ value: 'Vanilla' }, { value: 'Chocolate' }, { value: 'Cookies & Cream' }],
        },
      ],
      variants: [
        {
          key: 'protein-vanilla',
          sku: 'PROTEIN-VANILLA',
          title: 'Vanilla',
          priceCents: 4500,
          costCents: 2100,
          optionValues: ['Vanilla'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 10,
              reorderQuantity: 48,
              leadTimeDays: 18,
              movements: [
                { delta: 48, reason: 'receive', daysAgo: 25 },
                { delta: -13, reason: 'sale', daysAgo: 10 },
                { delta: -9, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          key: 'protein-chocolate',
          sku: 'PROTEIN-CHOCOLATE',
          title: 'Chocolate',
          priceCents: 4500,
          costCents: 2100,
          optionValues: ['Chocolate'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 10,
              reorderQuantity: 48,
              leadTimeDays: 18,
              movements: [
                { delta: 48, reason: 'receive', daysAgo: 25 },
                { delta: -19, reason: 'sale', daysAgo: 8 },
                { delta: -6, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
        {
          key: 'protein-cookies',
          sku: 'PROTEIN-COOKIES',
          title: 'Cookies & Cream',
          priceCents: 4500,
          costCents: 2100,
          optionValues: ['Cookies & Cream'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 8,
              reorderQuantity: 36,
              leadTimeDays: 18,
              movements: [
                { delta: 36, reason: 'receive', daysAgo: 20 },
                { delta: -10, reason: 'sale', daysAgo: 6 },
                { delta: -2, reason: 'recount', daysAgo: 1 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Cookies & Cream is dangerous',
          body: 'Mixes clean in the shaker with just water and tastes like a milkshake. No bloat, which is rare for me.',
          authorPersona: 'jordan',
          response: 'Cookies & Cream is the front-desk favorite too — thanks Jordan!',
          helpfulCount: 8,
          daysAgo: 12,
        },
        {
          rating: 4,
          title: 'Solid whey',
          body: 'Vanilla is a clean base — I add it to oats and coffee. Wish the tub were a little bigger.',
          authorPersona: 'sofia',
          helpfulCount: 3,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Is this isolate or concentrate? Trying to keep lactose low.',
          authorPersona: 'noah',
          answer:
            'It is a whey isolate blend, so lactose is low. Most lactose-sensitive members tolerate it well, but check with your doctor if you are highly sensitive.',
          daysAgo: 9,
        },
      ],
    },
    {
      key: 'foam-roller',
      title: 'High-Density Foam Roller',
      handle: 'high-density-foam-roller',
      description:
        '<p>A 24-inch high-density foam roller that holds its shape under real bodyweight pressure — no mushy collapse after a month. The molded ridges target knots and trigger points along the IT band, calves, and upper back without being punishing.</p><p>Light enough to carry to class, firm enough to make a difference. The single best tool for the recovery day you keep skipping.</p>',
      productType: 'Gear',
      vendor: 'House Label',
      tags: ['foam roller', 'gear', 'recovery', 'mobility'],
      seoTitle: 'High-Density Foam Roller (24") — Recovery & Mobility',
      seoDescription:
        '24-inch high-density foam roller with molded ridges for trigger-point release. Holds its shape under load.',
      categoryKeys: ['gear'],
      collectionKeys: ['new'],
      variants: [
        {
          key: 'roller-std',
          sku: 'ROLLER-24',
          title: null,
          priceCents: 2900,
          costCents: 1050,
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 8,
              reorderQuantity: 32,
              leadTimeDays: 15,
              movements: [
                { delta: 32, reason: 'receive', daysAgo: 19 },
                { delta: -7, reason: 'sale', daysAgo: 8 },
                { delta: -4, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'My calves thank me',
          body: 'Firm without being torture. Five minutes after a run and the next-day soreness is noticeably better.',
          authorPersona: 'alex',
          helpfulCount: 5,
          daysAgo: 10,
        },
      ],
      questions: [],
    },
    {
      key: 'starter-kit',
      title: 'New Member Starter Kit',
      handle: 'new-member-starter-kit',
      description:
        '<p>Everything a new member needs to walk in ready on day one: our Studio Performance Tee, a 3-pack of resistance bands for warm-ups, and an insulated shaker bottle to keep you hydrated. Buy the kit and save versus picking the pieces individually.</p><p>A standing welcome gift at the front desk — and the easiest "where do I start?" answer we have.</p>',
      productType: 'Kits',
      vendor: 'House Label',
      tags: ['starter kit', 'bundle', 'new member', 'welcome'],
      categoryKeys: ['gear'],
      collectionKeys: ['new', 'member-favorites'],
      variants: [
        {
          key: 'starter-kit-v',
          sku: 'KIT-STARTER',
          title: null,
          priceCents: 6900,
          costCents: 2600,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Perfect welcome bundle',
          body: 'Signed up and grabbed the kit the same day. Had everything I needed for my first week of classes.',
          authorPersona: 'maya',
          helpfulCount: 6,
          daysAgo: 8,
        },
      ],
      questions: [],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'starter-kit',
      pricing: { mode: 'percent', percentOff: 15 },
      inventoryMode: 'components',
      components: [
        { productKey: 'studio-tee', quantity: 1, required: true },
        { productKey: 'resistance-bands', quantity: 1, required: true },
        { productKey: 'shaker-bottle', quantity: 1, required: true },
      ],
    },
  ],

  scheduling: {
    resources: [
      {
        key: 'inst-yoga',
        name: 'Priya (Yoga)',
        kind: 'staff',
        skills: ['yoga'],
        windows: [
          { day: 1, startMin: 360, endMin: 1200 },
          { day: 2, startMin: 360, endMin: 1200 },
          { day: 3, startMin: 360, endMin: 1200 },
          { day: 4, startMin: 360, endMin: 1200 },
          { day: 5, startMin: 360, endMin: 1140 },
          { day: 6, startMin: 480, endMin: 840 },
        ],
      },
      {
        key: 'inst-spin',
        name: 'Marcus (Spin & HIIT)',
        kind: 'staff',
        skills: ['spin', 'hiit'],
        windows: [
          { day: 1, startMin: 330, endMin: 1140 },
          { day: 2, startMin: 330, endMin: 1140 },
          { day: 3, startMin: 330, endMin: 1140 },
          { day: 4, startMin: 330, endMin: 1140 },
          { day: 5, startMin: 330, endMin: 1080 },
          { day: 6, startMin: 480, endMin: 780 },
        ],
      },
      {
        key: 'inst-pilates',
        name: 'Elena (Pilates)',
        kind: 'staff',
        skills: ['pilates'],
        windows: [
          { day: 1, startMin: 420, endMin: 1140 },
          { day: 2, startMin: 420, endMin: 1140 },
          { day: 3, startMin: 420, endMin: 1140 },
          { day: 4, startMin: 420, endMin: 1140 },
          { day: 5, startMin: 420, endMin: 1020 },
          { day: 6, startMin: 480, endMin: 780 },
        ],
      },
      {
        key: 'trainer-sam',
        name: 'Sam (Personal Trainer)',
        kind: 'staff',
        skills: ['training'],
        windows: [
          { day: 1, startMin: 360, endMin: 1200 },
          { day: 2, startMin: 360, endMin: 1200 },
          { day: 3, startMin: 360, endMin: 1200 },
          { day: 4, startMin: 360, endMin: 1200 },
          { day: 5, startMin: 360, endMin: 1080 },
          { day: 6, startMin: 480, endMin: 840 },
        ],
      },
      {
        key: 'trainer-nadia',
        name: 'Nadia (Personal Trainer)',
        kind: 'staff',
        skills: ['training'],
        windows: [
          { day: 1, startMin: 600, endMin: 1260 },
          { day: 2, startMin: 600, endMin: 1260 },
          { day: 4, startMin: 600, endMin: 1260 },
          { day: 5, startMin: 600, endMin: 1200 },
          { day: 6, startMin: 480, endMin: 900 },
        ],
      },
      {
        key: 'studio-a',
        name: 'Studio A',
        kind: 'space',
        windows: [
          { day: 1, startMin: 330, endMin: 1260 },
          { day: 2, startMin: 330, endMin: 1260 },
          { day: 3, startMin: 330, endMin: 1260 },
          { day: 4, startMin: 330, endMin: 1260 },
          { day: 5, startMin: 330, endMin: 1200 },
          { day: 6, startMin: 480, endMin: 900 },
        ],
      },
      {
        key: 'studio-b',
        name: 'Studio B',
        kind: 'space',
        windows: [
          { day: 1, startMin: 330, endMin: 1260 },
          { day: 2, startMin: 330, endMin: 1260 },
          { day: 3, startMin: 330, endMin: 1260 },
          { day: 4, startMin: 330, endMin: 1260 },
          { day: 5, startMin: 330, endMin: 1200 },
          { day: 6, startMin: 480, endMin: 900 },
        ],
      },
    ],
    // Group classes stay `any_available` — you book a spot in the class and the
    // instructor is whoever teaches it, not a choice. The 1-on-1 services are
    // `customer_choice`: personal training lets you pick your trainer (Sam or Nadia),
    // and the free intro consult is left `any_available` (whoever can take it first).
    services: [
      {
        key: 'vinyasa-yoga',
        name: 'Vinyasa Yoga',
        description:
          'A breath-linked flow that builds heat and mobility — all levels welcome. Bring a mat or borrow one at the desk.',
        durationMinutes: 60,
        priceCents: 2200,
        capacity: 18,
        bookingType: 'class',
        slotIntervalMin: 60,
        resourceRoles: [
          { role: 'instructor', kind: 'staff', skill: 'yoga' },
          { role: 'studio', kind: 'space' },
        ],
      },
      {
        key: 'spin',
        name: 'Spin',
        description:
          'A 45-minute rhythm ride with climbs, sprints, and a playlist that does half the work. Clip-in or cage pedals available.',
        durationMinutes: 45,
        priceCents: 2400,
        capacity: 20,
        bookingType: 'class',
        slotIntervalMin: 60,
        resourceRoles: [
          { role: 'instructor', kind: 'staff', skill: 'spin' },
          { role: 'studio', kind: 'space' },
        ],
      },
      {
        key: 'hiit',
        name: 'HIIT Circuit',
        description:
          'High-intensity intervals across stations — strength and conditioning in 45 minutes. Modifications offered for every move.',
        durationMinutes: 45,
        priceCents: 2400,
        capacity: 16,
        bookingType: 'class',
        slotIntervalMin: 60,
        resourceRoles: [
          { role: 'instructor', kind: 'staff', skill: 'hiit' },
          { role: 'studio', kind: 'space' },
        ],
      },
      {
        key: 'pilates-mat',
        name: 'Pilates Mat',
        description:
          'A controlled, core-focused mat class that builds deep stability and posture. A favorite for cross-training and recovery days.',
        durationMinutes: 50,
        priceCents: 2200,
        capacity: 12,
        bookingType: 'class',
        slotIntervalMin: 60,
        resourceRoles: [
          { role: 'instructor', kind: 'staff', skill: 'pilates' },
          { role: 'studio', kind: 'space' },
        ],
      },
      {
        key: 'personal-training',
        name: 'Personal Training (1-on-1)',
        description:
          'A private 60-minute session built around your goals — strength, mobility, or sport-specific work with a dedicated trainer.',
        durationMinutes: 60,
        priceCents: 8500,
        capacity: 1,
        bookingType: 'appointment',
        bufferAfterMin: 15,
        assignmentStrategy: 'customer_choice',
        resourceRoles: [
          { role: 'trainer', kind: 'staff', skill: 'training' },
          { role: 'studio', kind: 'space' },
        ],
      },
      {
        key: 'intro-consult',
        name: 'Intro Consultation',
        description:
          'A free 30-minute sit-down to talk goals, assess movement, and map a starting plan. We confirm scheduling before booking.',
        durationMinutes: 30,
        priceCents: 0,
        capacity: 1,
        bookingType: 'appointment',
        requiresApproval: true,
        resourceRoles: [{ role: 'trainer', kind: 'staff', skill: 'training' }],
      },
    ],
  },

  articles: [
    {
      slug: 'beginners-guide-to-strength-training',
      title: "A beginner's guide to strength training",
      excerpt:
        'You do not need a perfect program to start — you need to show up, move well, and add a little each week.',
      daysAgo: 6,
      body: doc(
        p(
          'Strength training is the single highest-return habit you can build for long-term health: it protects your bones, defends your metabolism, and makes everyday life — carrying groceries, getting off the floor, hauling a kid — easier for decades. The hard part is not the science. It is starting without overthinking it.'
        ),
        h2('Start with the big movements'),
        p(
          'Almost everything you need is covered by a handful of fundamental patterns. Master these with bodyweight or light load before chasing numbers.'
        ),
        ul(
          'A squat (sit down and stand up)',
          'A hinge (deadlift pattern — hips back, flat back)',
          'A push (push-up or overhead press)',
          'A pull (row or assisted pull-up — our resistance bands are perfect here)',
          'A carry (just walk while holding something heavy)'
        ),
        h2('How much, how often'),
        p(
          'Two to three sessions a week is plenty to start. Pick a weight you can move with good form for 8–12 reps, leaving a rep or two in the tank. When that gets easy, add a little — a rep, a set, or a small jump in load. That slow, boring progression is the whole secret.'
        ),
        h2('Form first, ego last'),
        p(
          'A clean rep at a lighter weight beats a sloppy rep at a heavy one every time. If you are unsure what good form feels like, book an intro consultation or a 1-on-1 — twenty minutes with a trainer will save you months of guessing and a few avoidable tweaks.'
        )
      ),
    },
    {
      slug: 'why-recovery-matters',
      title: 'Why recovery matters as much as the workout',
      excerpt:
        'You do not get stronger in the gym — you get stronger recovering from it. Here is how to actually do it.',
      daysAgo: 13,
      body: doc(
        p(
          'It is tempting to think progress comes from grinding harder every single day. In reality, training is the stimulus; recovery is when your body actually adapts and rebuilds. Skip the recovery and you are just accumulating fatigue with nothing to show for it.'
        ),
        h2('Sleep is the real performance enhancer'),
        p(
          'Nothing on the supplement shelf comes close to a consistent seven to nine hours. Sleep is when muscle repairs, hormones reset, and your nervous system recovers. If you fix one thing this month, fix your sleep.'
        ),
        h2('Move on your rest days'),
        p(
          'Rest does not mean lying still. Gentle movement — a walk, an easy Pilates mat class, five minutes on the foam roller — pushes blood to sore muscles and speeds the process. We call it active recovery, and it is why our mobility tools are the most-borrowed gear at the desk.'
        ),
        ul(
          'Foam-roll the areas that are tight, not the ones that hurt sharply',
          'Hydrate — recovery stalls when you are even mildly dry',
          'Eat enough protein to give your body something to rebuild with',
          'Take at least one genuinely easy day a week'
        ),
        h2('Listen to the signals'),
        p(
          'Persistent soreness, a stalled lift, a short fuse, or trouble sleeping are all signs you are under-recovered, not under-trained. Backing off for a few days almost always brings you back stronger than pushing through would have.'
        )
      ),
    },
    {
      slug: 'how-to-pick-your-first-class',
      title: 'How to pick your first class',
      excerpt:
        'Yoga, spin, HIIT, or Pilates? A quick guide to matching your first class to what you actually want.',
      daysAgo: 21,
      body: doc(
        p(
          'Walking into a studio for the first time is the hardest rep of all. The good news: there is no wrong first class, and every instructor expects beginners. Here is a simple way to choose based on what you are after.'
        ),
        h2('If you want to build calm and mobility'),
        p(
          'Start with Vinyasa Yoga. It links breath to movement, builds flexibility and balance, and scales to any level — you can hold back or push as far as you like. A great choice if you sit at a desk all day.'
        ),
        h2('If you want cardio without the pounding'),
        p(
          'Try Spin. It is a joint-friendly, high-energy ride driven by the music, and the resistance is entirely in your hands — you control how hard the climb gets.'
        ),
        h2('If you want maximum work in minimum time'),
        p(
          'HIIT Circuit packs strength and conditioning into 45 focused minutes. Every movement has a modification, so you set the intensity. Expect to sweat and to leave feeling accomplished.'
        ),
        h2('If you want core strength and control'),
        p(
          'Pilates Mat builds the deep stabilizers that everything else relies on. It is low-impact, posture-changing, and a perfect complement to heavier training or running.'
        ),
        h2('Still not sure?'),
        p(
          'Book a free intro consultation. We will talk through your goals, watch how you move, and point you to the class that fits — then see you on the floor.'
        )
      ),
    },
  ],
};
