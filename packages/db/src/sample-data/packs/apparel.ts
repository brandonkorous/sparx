// Apparel sample pack — a modern clothing boutique. Data-as-code: size/color
// option products with swatch variants, a single fulfillment warehouse and one
// apparel mill supplier, verified retail reviews + Q&A, an "Everyday Outfit"
// bundle, a custom-embroidery configurator, and style-guide articles. Loading it
// tells the whole cross-module story — a garment that's stocked by size, reviewed
// (verified against a real order), bundled into an outfit, and sourced from a PO.
//
// Pairs with the `apparel` industry STARTER (Wave 3), which installs the config
// (tax/shipping/size taxonomy/markup); this pack brings the catalog + activity.

import { doc, h2, ol, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';
import { APPAREL_SCALE_COLLECTION, apparelScaleProducts } from './apparel-scale';

export const apparelPack: SampleDataPack = {
  industry: 'apparel',
  label: 'Apparel & fashion',
  summary:
    'A modern clothing boutique: a size- and color-stocked catalog, retail shoppers, orders + returns, verified reviews, an everyday-outfit bundle, custom embroidery, and a fabric-care style journal.',

  warehouses: [
    {
      key: 'FULFILL',
      code: 'FC-1',
      name: 'Fulfillment Center',
      type: 'owned',
      city: 'Columbus',
      region: 'OH',
    },
  ],

  suppliers: [
    {
      code: 'NORTHLOOM',
      name: 'Northloom Mills',
      paymentTerms: 'net30',
      leadTimeDays: 21,
      city: 'Greensboro',
      region: 'NC',
      variantKeys: [
        'TEE-CRW-S-BLK',
        'TEE-CRW-M-BLK',
        'TEE-CRW-M-SND',
        'HOOD-HVY-M-CHR',
        'HOOD-HVY-L-CHR',
        'SOCK-CRW-3PK-WHT',
      ],
    },
  ],

  categories: [
    { key: 'tops', name: 'Tops', handle: 'tops' },
    { key: 'bottoms', name: 'Bottoms', handle: 'bottoms' },
    { key: 'outerwear', name: 'Outerwear', handle: 'outerwear' },
    { key: 'footwear', name: 'Footwear', handle: 'footwear' },
    { key: 'accessories', name: 'Accessories', handle: 'accessories' },
  ],

  collections: [
    { key: 'new-arrivals', name: 'New Arrivals', handle: 'new-arrivals', featured: true },
    { key: 'sale', name: 'Sale', handle: 'sale' },
    { key: 'summer-edit', name: 'Summer Edit', handle: 'summer-edit' },
    // The broad, multi-page line (see ./apparel-scale) — the products below spread in
    // its ~90 members so a collection detail page spans real pagination.
    APPAREL_SCALE_COLLECTION,
  ],

  personas: [
    {
      key: 'avery',
      name: 'Avery Quinn',
      email: 'avery.quinn',
      phone: '+1-503-555-0148',
      line1: '1422 SE Hawthorne Blvd',
      city: 'Portland',
      region: 'OR',
      postalCode: '97214',
    },
    {
      key: 'sloane',
      name: 'Sloane Carter',
      email: 'sloane.carter',
      phone: '+1-312-555-0192',
      line1: '88 N Wabash Ave',
      city: 'Chicago',
      region: 'IL',
      postalCode: '60602',
    },
    {
      key: 'mateo',
      name: 'Mateo Reyes',
      email: 'mateo.reyes',
      phone: '+1-305-555-0137',
      line1: '740 Lincoln Rd',
      city: 'Miami',
      region: 'FL',
      postalCode: '33139',
    },
    {
      key: 'noor',
      name: 'Noor Hassan',
      email: 'noor.hassan',
      phone: '+1-617-555-0165',
      line1: '215 Newbury St',
      city: 'Boston',
      region: 'MA',
      postalCode: '02116',
    },
    {
      key: 'declan',
      name: 'Declan Pierce',
      email: 'declan.pierce',
      phone: '+1-720-555-0174',
      line1: '3300 Larimer St',
      city: 'Denver',
      region: 'CO',
      postalCode: '80205',
    },
    {
      key: 'harper',
      name: 'Harper Yoon',
      email: 'harper.yoon',
      phone: '+1-206-555-0129',
      line1: '1901 Pike Pl',
      city: 'Seattle',
      region: 'WA',
      postalCode: '98101',
    },
  ],

  products: [
    {
      key: 'crewneck-tee',
      title: 'Heritage Crewneck Tee',
      handle: 'heritage-crewneck-tee',
      description:
        '<p>A everyday crewneck cut from 6.5oz combed ring-spun cotton with a clean, structured shoulder and a ribbed collar that holds its shape wash after wash. Pre-shrunk and garment-washed so the fit you buy is the fit you keep.</p><p>Mid-weight enough to wear on its own and trim enough to layer under a jacket. We cut it slightly longer in the body so it stays tucked or wears untucked without riding up.</p>',
      productType: 'T-Shirts',
      vendor: 'Northloom',
      tags: ['tee', 'crewneck', 'cotton', 'everyday'],
      seoTitle: 'Heritage Crewneck Tee — Combed Ring-Spun Cotton',
      seoDescription:
        'A mid-weight 6.5oz crewneck tee in combed ring-spun cotton. Pre-shrunk, structured collar, sits clean tucked or untucked.',
      categoryKeys: ['tops'],
      collectionKeys: ['new-arrivals', 'summer-edit'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }],
        },
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Black', swatchHex: '#111111' },
            { value: 'Sand', swatchHex: '#d8c3a5' },
          ],
        },
      ],
      variants: [
        {
          key: 'tee-s-blk',
          sku: 'TEE-CRW-S-BLK',
          title: 'S / Black',
          priceCents: 2800,
          costCents: 950,
          optionValues: ['S', 'Black'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 24,
              reorderQuantity: 96,
              leadTimeDays: 21,
              movements: [
                { delta: 90, reason: 'receive', daysAgo: 26 },
                { delta: -14, reason: 'sale', daysAgo: 11 },
                { delta: -9, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          key: 'tee-m-blk',
          sku: 'TEE-CRW-M-BLK',
          title: 'M / Black',
          priceCents: 2800,
          costCents: 950,
          optionValues: ['M', 'Black'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 21,
              movements: [
                { delta: 140, reason: 'receive', daysAgo: 26 },
                { delta: -31, reason: 'sale', daysAgo: 12 },
                { delta: -18, reason: 'sale', daysAgo: 4 },
                { delta: -2, reason: 'recount', daysAgo: 1 },
              ],
            },
          ],
        },
        {
          key: 'tee-m-snd',
          sku: 'TEE-CRW-M-SND',
          title: 'M / Sand',
          priceCents: 2800,
          costCents: 950,
          optionValues: ['M', 'Sand'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 24,
              reorderQuantity: 96,
              leadTimeDays: 21,
              movements: [
                { delta: 80, reason: 'receive', daysAgo: 24 },
                { delta: -22, reason: 'sale', daysAgo: 9 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'My new default tee',
          body: 'Bought one in black, came back for sand the same week. The collar actually keeps its shape and it has not shrunk after a dozen washes.',
          authorPersona: 'avery',
          response: 'So glad it earned a spot in the rotation, Avery — thanks for coming back!',
          helpfulCount: 12,
          daysAgo: 18,
        },
        {
          rating: 4,
          title: 'Great weight, runs a touch long',
          body: 'Love the heavier feel versus a fast-fashion tee. Body is a little long for me at 5’8” but it tucks well.',
          authorPersona: 'mateo',
          helpfulCount: 5,
          daysAgo: 10,
        },
        {
          rating: 5,
          title: 'Holds up',
          body: 'No pilling, no fading on the black. Exactly what I want in a basic.',
          displayName: 'weekendlayers',
          helpfulCount: 3,
          daysAgo: 6,
        },
        {
          rating: 3,
          title: 'Sizing question',
          body: 'Nice fabric but I was between sizes and the M felt boxy on me. Might try the S.',
          displayName: 'cityrunner',
          status: 'pending',
          helpfulCount: 1,
          daysAgo: 2,
        },
      ],
      questions: [
        {
          body: 'Is the fit slim or relaxed? Trying to decide between S and M.',
          authorPersona: 'noor',
          answer:
            'It is a classic straight cut — not slim, not oversized. If you like a trim fit, size down; for a relaxed drape, take your normal size.',
          daysAgo: 14,
        },
        {
          body: 'Does the sand color show sweat?',
          displayName: 'summerbound',
          status: 'pending',
          daysAgo: 3,
        },
      ],
    },
    {
      key: 'heavyweight-hoodie',
      title: 'Heavyweight Fleece Hoodie',
      handle: 'heavyweight-fleece-hoodie',
      description:
        '<p>A 14oz brushed-back fleece hoodie with a dense, structured hood, a kangaroo pocket deep enough to actually use, and ribbed cuffs that stay put. The kind of weight that feels like a layer, not a t-shirt with a hood.</p><p>Pre-washed for minimal shrinkage and finished with a flat-locked seam at the shoulder so it lies clean under a jacket. Drawcord is a chunky flat lace, not the thin round string that frays.</p>',
      productType: 'Hoodies',
      vendor: 'Northloom',
      tags: ['hoodie', 'fleece', 'heavyweight', 'layering'],
      seoTitle: 'Heavyweight Fleece Hoodie — 14oz Brushed-Back',
      seoDescription:
        'A 14oz brushed-back fleece hoodie with a structured hood, deep kangaroo pocket, and ribbed cuffs. Pre-washed, built to layer.',
      categoryKeys: ['tops', 'outerwear'],
      collectionKeys: ['new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }],
        },
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Charcoal', swatchHex: '#3a3a3c' },
            { value: 'Heather Grey', swatchHex: '#b7b7b7' },
          ],
        },
      ],
      variants: [
        {
          key: 'hood-m-chr',
          sku: 'HOOD-HVY-M-CHR',
          title: 'M / Charcoal',
          priceCents: 6800,
          costCents: 2600,
          optionValues: ['M', 'Charcoal'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 16,
              reorderQuantity: 60,
              leadTimeDays: 21,
              movements: [
                { delta: 70, reason: 'receive', daysAgo: 30 },
                { delta: -19, reason: 'sale', daysAgo: 13 },
                { delta: -11, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
        {
          key: 'hood-l-chr',
          sku: 'HOOD-HVY-L-CHR',
          title: 'L / Charcoal',
          priceCents: 6800,
          costCents: 2600,
          optionValues: ['L', 'Charcoal'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 16,
              reorderQuantity: 60,
              leadTimeDays: 21,
              movements: [
                { delta: 60, reason: 'receive', daysAgo: 30 },
                { delta: -24, reason: 'sale', daysAgo: 8 },
              ],
            },
          ],
        },
        {
          key: 'hood-m-hgr',
          sku: 'HOOD-HVY-M-HGR',
          title: 'M / Heather Grey',
          priceCents: 6800,
          costCents: 2600,
          optionValues: ['M', 'Heather Grey'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 12,
              reorderQuantity: 48,
              leadTimeDays: 21,
              movements: [
                { delta: 48, reason: 'receive', daysAgo: 27 },
                { delta: -13, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Heavy in the best way',
          body: 'This is the weight every hoodie should be. The hood actually stands up and the pocket fits both hands plus a phone. Worth the price.',
          authorPersona: 'declan',
          response: 'The 14oz fleece is our favorite thing we make — enjoy it, Declan!',
          helpfulCount: 14,
          daysAgo: 21,
        },
        {
          rating: 5,
          title: 'Replaced my old beat-up one',
          body: 'Charcoal looks more refined than a black hoodie but goes with everything. No shrinkage after washing cold.',
          authorPersona: 'harper',
          helpfulCount: 6,
          daysAgo: 12,
        },
        {
          rating: 4,
          title: 'Warm, slightly snug',
          body: 'Sizing is true but the fleece is so dense it feels closer at first. Loosens up after a wear or two.',
          displayName: 'trailcoffee',
          helpfulCount: 2,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Is this fleece brushed on the inside? Looking for something soft against the skin.',
          authorPersona: 'sloane',
          answer:
            'Yes — it is brushed-back fleece, so the interior is soft and napped while the face stays smooth.',
          daysAgo: 16,
        },
      ],
    },
    {
      key: 'slim-jeans',
      title: 'Tapered Selvedge Jeans',
      handle: 'tapered-selvedge-jeans',
      description:
        '<p>A 13.5oz raw selvedge denim cut with a mid-rise, a clean seat, and a gentle taper from the knee down. Woven on a vintage shuttle loom, so you get the tight, self-finished edge and the slow, personal fade that only raw denim gives you.</p><p>Sold rigid and unwashed — they will mold to you over the first few weeks. Cotton button fly, copper rivets, and a leather patch that breaks in with the rest of the jean.</p>',
      productType: 'Jeans',
      vendor: 'Forge & Field',
      tags: ['jeans', 'denim', 'selvedge', 'raw', 'tapered'],
      seoTitle: 'Tapered Selvedge Jeans — 13.5oz Raw Denim',
      seoDescription:
        'Mid-rise tapered jeans in 13.5oz raw selvedge denim woven on a shuttle loom. Button fly, copper rivets, made to fade.',
      categoryKeys: ['bottoms'],
      collectionKeys: ['new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: '30' }, { value: '32' }, { value: '34' }, { value: '36' }],
        },
        {
          name: 'Color',
          displayType: 'swatch',
          values: [{ value: 'Indigo', swatchHex: '#2a3b55' }],
        },
      ],
      variants: [
        {
          key: 'jean-32-ind',
          sku: 'JEAN-SLV-32-IND',
          title: '32 / Indigo',
          priceCents: 14800,
          costCents: 6200,
          optionValues: ['32', 'Indigo'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 10,
              reorderQuantity: 36,
              leadTimeDays: 28,
              movements: [
                { delta: 44, reason: 'receive', daysAgo: 34 },
                { delta: -12, reason: 'sale', daysAgo: 14 },
                { delta: -6, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
        {
          key: 'jean-34-ind',
          sku: 'JEAN-SLV-34-IND',
          title: '34 / Indigo',
          priceCents: 14800,
          costCents: 6200,
          optionValues: ['34', 'Indigo'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 10,
              reorderQuantity: 36,
              leadTimeDays: 28,
              movements: [
                { delta: 40, reason: 'receive', daysAgo: 34 },
                { delta: -15, reason: 'sale', daysAgo: 9 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Fades are starting',
          body: 'Two months in and the honeycombs behind the knees are coming in beautifully. The taper is just right — slim but I can still wear boots.',
          authorPersona: 'mateo',
          response: 'Send us a fade photo at the six-month mark — we love seeing these break in!',
          helpfulCount: 10,
          daysAgo: 24,
        },
        {
          rating: 4,
          title: 'Stiff at first, worth it',
          body: 'They are genuinely rigid for the first week. Once they relaxed the fit was perfect. Size up one if you like room.',
          authorPersona: 'declan',
          helpfulCount: 7,
          daysAgo: 15,
        },
        {
          rating: 2,
          title: 'Crocking on my couch',
          body: 'Indigo rubbed off onto a light chair before I expected. Wish the listing warned about it more clearly.',
          displayName: 'firsttimeraw',
          status: 'flagged',
          helpfulCount: 4,
          daysAgo: 8,
        },
      ],
      questions: [
        {
          body: 'Should I size up since these are raw and unsanforized?',
          authorPersona: 'avery',
          answer:
            'These are sanforized, so shrinkage is minimal — take your true waist. They will stretch about a half size with wear, then settle back after a wash.',
          daysAgo: 17,
        },
        {
          body: 'How long before my first wash?',
          displayName: 'fadehunter',
          answer:
            'There is no hard rule, but most raw-denim wearers go 3–6 months before the first wash to set sharper contrast. Spot-clean in the meantime.',
          daysAgo: 9,
        },
      ],
    },
    {
      key: 'denim-jacket',
      title: 'Trucker Denim Jacket',
      handle: 'trucker-denim-jacket',
      description:
        '<p>A classic trucker cut in 12oz washed denim, broken in at the factory so it is soft on day one. Pointed flap chest pockets, a tapered waist with side adjusters, and a shorter body that layers cleanly over a hoodie or a tee.</p><p>Antiqued copper hardware and chain-stitched hems give it the worn-in look without the wait. Roomy enough through the shoulders to actually move in.</p>',
      productType: 'Jackets',
      vendor: 'Forge & Field',
      tags: ['jacket', 'denim', 'trucker', 'outerwear'],
      seoTitle: 'Trucker Denim Jacket — 12oz Washed Denim',
      seoDescription:
        'A broken-in trucker jacket in 12oz washed denim. Pointed chest pockets, waist adjusters, antiqued copper hardware.',
      categoryKeys: ['outerwear'],
      collectionKeys: ['new-arrivals', 'summer-edit'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }],
        },
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Mid Wash', swatchHex: '#5b7392' },
            { value: 'Black', swatchHex: '#1c1c1e' },
          ],
        },
      ],
      variants: [
        {
          key: 'jkt-m-mid',
          sku: 'JKT-TRK-M-MID',
          title: 'M / Mid Wash',
          priceCents: 11800,
          costCents: 4900,
          optionValues: ['M', 'Mid Wash'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 8,
              reorderQuantity: 30,
              leadTimeDays: 28,
              movements: [
                { delta: 36, reason: 'receive', daysAgo: 40 },
                { delta: -9, reason: 'sale', daysAgo: 13 },
                { delta: -4, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
        {
          key: 'jkt-l-mid',
          sku: 'JKT-TRK-L-MID',
          title: 'L / Mid Wash',
          priceCents: 11800,
          costCents: 4900,
          optionValues: ['L', 'Mid Wash'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 8,
              reorderQuantity: 30,
              leadTimeDays: 28,
              movements: [
                { delta: 30, reason: 'receive', daysAgo: 40 },
                { delta: -11, reason: 'sale', daysAgo: 7 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Soft right away',
          body: 'No painful break-in. The mid wash is exactly the blue in the photos and the waist adjusters let me dial in the fit. Goes over everything.',
          authorPersona: 'noor',
          helpfulCount: 9,
          daysAgo: 19,
        },
        {
          rating: 4,
          title: 'Great layer',
          body: 'Runs a touch boxy in the body which I like for layering a hoodie under. Shoulders are roomy enough to actually reach.',
          authorPersona: 'harper',
          helpfulCount: 4,
          daysAgo: 11,
        },
      ],
      questions: [
        {
          body: 'Can I fit a hoodie under the M?',
          authorPersona: 'declan',
          answer:
            'Yes — the trucker is cut with a little room through the body, so a mid-weight hoodie layers comfortably under your normal size.',
          daysAgo: 13,
        },
      ],
    },
    {
      key: 'linen-shirt',
      title: 'Washed Linen Camp Shirt',
      handle: 'washed-linen-camp-shirt',
      description:
        '<p>A breezy camp-collar shirt in 100% European-flax linen, garment-washed for a soft, lived-in hand and a gentle crinkle that never looks sloppy. An open collar, a boxy cut, and a single chest pocket make it the easiest thing to throw on when it is hot.</p><p>Linen breathes and dries fast, so it is built for travel and humidity. Wears open over a tee or buttoned on its own.</p>',
      productType: 'Shirts',
      vendor: 'Atlas Standard',
      tags: ['shirt', 'linen', 'camp collar', 'summer'],
      seoTitle: 'Washed Linen Camp Shirt — 100% European Flax',
      seoDescription:
        'A garment-washed camp-collar shirt in 100% European-flax linen. Breathable, boxy, made for heat and travel.',
      categoryKeys: ['tops'],
      collectionKeys: ['summer-edit', 'sale'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }],
        },
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Ecru', swatchHex: '#ede4d3' },
            { value: 'Olive', swatchHex: '#6b6f4a' },
          ],
        },
      ],
      variants: [
        {
          key: 'lin-m-ecr',
          sku: 'LIN-CMP-M-ECR',
          title: 'M / Ecru',
          priceCents: 7200,
          compareAtPriceCents: 8800,
          costCents: 2900,
          optionValues: ['M', 'Ecru'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 12,
              reorderQuantity: 48,
              leadTimeDays: 24,
              movements: [
                { delta: 56, reason: 'receive', daysAgo: 22 },
                { delta: -17, reason: 'sale', daysAgo: 8 },
                { delta: -9, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
        {
          key: 'lin-l-olv',
          sku: 'LIN-CMP-L-OLV',
          title: 'L / Olive',
          priceCents: 7200,
          compareAtPriceCents: 8800,
          costCents: 2900,
          optionValues: ['L', 'Olive'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 10,
              reorderQuantity: 40,
              leadTimeDays: 24,
              movements: [
                { delta: 44, reason: 'receive', daysAgo: 22 },
                { delta: -12, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Perfect for Miami heat',
          body: 'Lightest shirt I own and it still looks put together. The crinkle reads intentional, not wrinkled. Bought the olive too.',
          authorPersona: 'mateo',
          response: 'Linen earns its keep in that climate — thanks Mateo!',
          helpfulCount: 8,
          daysAgo: 16,
        },
        {
          rating: 4,
          title: 'Boxy, as described',
          body: 'Love it open over a tee. If you want a fitted look this is not it — it is meant to be relaxed.',
          displayName: 'patioseason',
          helpfulCount: 3,
          daysAgo: 9,
        },
        {
          rating: 5,
          title: 'Great travel piece',
          body: 'Rolls up small, shakes out fine, dries overnight in a hotel. Exactly what I wanted.',
          authorPersona: 'sloane',
          helpfulCount: 5,
          daysAgo: 5,
        },
      ],
      questions: [
        {
          body: 'Does the linen soften more after washing?',
          authorPersona: 'noor',
          answer:
            'It does — it is already garment-washed, but a few home washes (cold, hang dry) make it even softer and bring out the crinkle.',
          daysAgo: 12,
        },
      ],
    },
    {
      key: 'knit-beanie',
      title: 'Ribbed Merino Beanie',
      handle: 'ribbed-merino-beanie',
      description:
        '<p>A fine-gauge ribbed beanie knit from 100% extra-fine merino wool — warm without the itch, with a folded cuff you can wear short or slouched. Merino regulates temperature and resists odor, so it works from a frosty commute to a cool campfire.</p><p>Holds its shape without sagging and packs flat into a jacket pocket. One size, with enough stretch to fit most comfortably.</p>',
      productType: 'Hats',
      vendor: 'Atlas Standard',
      tags: ['beanie', 'merino', 'wool', 'winter', 'accessory'],
      seoTitle: 'Ribbed Merino Beanie — Extra-Fine Wool',
      seoDescription:
        'A fine-gauge ribbed beanie in 100% extra-fine merino wool. Warm, itch-free, folded cuff, packs flat.',
      categoryKeys: ['accessories'],
      collectionKeys: [],
      options: [
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Black', swatchHex: '#141414' },
            { value: 'Oatmeal', swatchHex: '#d9cbb3' },
            { value: 'Rust', swatchHex: '#9c4a2b' },
          ],
        },
      ],
      variants: [
        {
          key: 'bnie-blk',
          sku: 'BNIE-MER-BLK',
          title: 'Black',
          priceCents: 3200,
          costCents: 1100,
          optionValues: ['Black'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 20,
              reorderQuantity: 80,
              leadTimeDays: 18,
              movements: [
                { delta: 90, reason: 'receive', daysAgo: 28 },
                { delta: -28, reason: 'sale', daysAgo: 10 },
                { delta: -15, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          key: 'bnie-oat',
          sku: 'BNIE-MER-OAT',
          title: 'Oatmeal',
          priceCents: 3200,
          costCents: 1100,
          optionValues: ['Oatmeal'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 16,
              reorderQuantity: 64,
              leadTimeDays: 18,
              movements: [
                { delta: 64, reason: 'receive', daysAgo: 28 },
                { delta: -20, reason: 'sale', daysAgo: 7 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'No itch at all',
          body: 'I cannot wear most wool hats but merino is the difference. Warm, soft, and the rust color is gorgeous in person.',
          authorPersona: 'harper',
          helpfulCount: 6,
          daysAgo: 13,
        },
        {
          rating: 4,
          title: 'Good fit',
          body: 'Stretches enough for my bigger head without being loose. Cuff stays folded.',
          displayName: 'frostyam',
          helpfulCount: 2,
          daysAgo: 6,
        },
      ],
      questions: [
        {
          body: 'Is it machine washable?',
          displayName: 'lowmaintenance',
          answer:
            'Hand-wash cold or use a wool cycle, then lay flat to dry. Avoid the dryer so the merino keeps its shape.',
          daysAgo: 8,
        },
      ],
    },
    {
      key: 'canvas-sneakers',
      title: 'Low-Top Canvas Sneakers',
      handle: 'low-top-canvas-sneakers',
      description:
        '<p>A clean low-top sneaker in heavyweight cotton canvas on a vulcanized rubber sole. Minimal branding, a cushioned cotton-twill lining, and a removable molded insole for all-day comfort without the chunky look.</p><p>The vulcanized construction bonds the upper to the sole for flexibility and a low, classic profile that goes with jeans, chinos, or shorts.</p>',
      productType: 'Sneakers',
      vendor: 'Atlas Standard',
      tags: ['sneakers', 'canvas', 'low-top', 'footwear'],
      seoTitle: 'Low-Top Canvas Sneakers — Vulcanized Sole',
      seoDescription:
        'A clean low-top canvas sneaker on a vulcanized rubber sole. Cushioned lining, removable insole, minimal branding.',
      categoryKeys: ['footwear'],
      collectionKeys: ['summer-edit'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: '9' }, { value: '10' }, { value: '11' }, { value: '12' }],
        },
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'White', swatchHex: '#f4f4f2' },
            { value: 'Navy', swatchHex: '#27304a' },
          ],
        },
      ],
      variants: [
        {
          key: 'snk-10-wht',
          sku: 'SNK-CNV-10-WHT',
          title: '10 / White',
          priceCents: 6500,
          costCents: 2700,
          optionValues: ['10', 'White'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 10,
              reorderQuantity: 40,
              leadTimeDays: 30,
              movements: [
                { delta: 40, reason: 'receive', daysAgo: 36 },
                { delta: -13, reason: 'sale', daysAgo: 12 },
                { delta: -5, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
        {
          key: 'snk-11-nvy',
          sku: 'SNK-CNV-11-NVY',
          title: '11 / Navy',
          priceCents: 6500,
          costCents: 2700,
          optionValues: ['11', 'Navy'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 8,
              reorderQuantity: 32,
              leadTimeDays: 30,
              movements: [
                { delta: 32, reason: 'receive', daysAgo: 36 },
                { delta: -10, reason: 'sale', daysAgo: 8 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 4,
          title: 'Classic and comfy',
          body: 'Wears like a broken-in sneaker out of the box. White stays white with a quick wipe. Runs true to size.',
          authorPersona: 'declan',
          helpfulCount: 5,
          daysAgo: 14,
        },
        {
          rating: 5,
          title: 'Goes with everything',
          body: 'The navy is a great alternative to plain white. Insole is genuinely comfortable for walking all day.',
          authorPersona: 'avery',
          response: 'Glad the insole holds up on long days — thanks Avery!',
          helpfulCount: 3,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Do these run large or small?',
          displayName: 'halfsizer',
          answer:
            'They run true to size. If you are a half size, we suggest sizing down for a snugger fit since the canvas gives a little.',
          daysAgo: 10,
        },
        {
          body: 'Is the insole replaceable?',
          authorPersona: 'mateo',
          status: 'pending',
          daysAgo: 2,
        },
      ],
    },
    {
      key: 'crew-socks',
      title: 'Cushioned Crew Socks (3-Pack)',
      handle: 'cushioned-crew-socks-3-pack',
      description:
        '<p>A three-pair set of mid-calf crew socks in a combed-cotton blend with a terry-cushioned footbed, arch support band, and a hand-linked toe seam that never rubs. The everyday workhorse that makes any shoe more comfortable.</p><p>Reinforced heel and toe for durability, a ribbed cuff that stays up, and a breathable mesh top to keep feet cool. Sold as a matched three-pack.</p>',
      productType: 'Socks',
      vendor: 'Northloom',
      tags: ['socks', 'crew', 'cotton', 'accessory', '3-pack'],
      seoTitle: 'Cushioned Crew Socks 3-Pack — Combed Cotton',
      seoDescription:
        'A three-pack of cushioned crew socks in a combed-cotton blend. Terry footbed, arch support, seamless toe.',
      categoryKeys: ['accessories'],
      collectionKeys: ['sale'],
      options: [
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'White', swatchHex: '#f6f6f4' },
            { value: 'Black', swatchHex: '#161616' },
          ],
        },
      ],
      variants: [
        {
          key: 'sock-wht',
          sku: 'SOCK-CRW-3PK-WHT',
          title: 'White (3-Pack)',
          priceCents: 1800,
          compareAtPriceCents: 2400,
          costCents: 600,
          optionValues: ['White'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 40,
              reorderQuantity: 160,
              leadTimeDays: 18,
              movements: [
                { delta: 200, reason: 'receive', daysAgo: 25 },
                { delta: -58, reason: 'sale', daysAgo: 10 },
                { delta: -34, reason: 'sale', daysAgo: 3 },
                { delta: -2, reason: 'recount', daysAgo: 1 },
              ],
            },
          ],
        },
        {
          key: 'sock-blk',
          sku: 'SOCK-CRW-3PK-BLK',
          title: 'Black (3-Pack)',
          priceCents: 1800,
          compareAtPriceCents: 2400,
          costCents: 600,
          optionValues: ['Black'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 40,
              reorderQuantity: 160,
              leadTimeDays: 18,
              movements: [
                { delta: 180, reason: 'receive', daysAgo: 25 },
                { delta: -47, reason: 'sale', daysAgo: 7 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Cushion is real',
          body: 'The terry footbed makes a noticeable difference standing all day. Cuffs actually stay up. Bought another pack.',
          authorPersona: 'noor',
          helpfulCount: 4,
          daysAgo: 12,
        },
        {
          rating: 4,
          title: 'Solid basics',
          body: 'Good thickness, no slipping. Three pairs at this price on sale is a steal.',
          displayName: 'sockdrawer',
          helpfulCount: 1,
          daysAgo: 5,
        },
      ],
      questions: [],
    },
    {
      key: 'wool-overcoat',
      title: 'Tailored Wool Overcoat',
      handle: 'tailored-wool-overcoat',
      description:
        '<p>A single-breasted topcoat in a midweight Italian wool-blend melton, cut just below the knee with a clean notch lapel and a half-canvas front for structure that holds without feeling stiff. The grown-up layer that finishes any outfit.</p><p>Fully lined with a center back vent for movement, interior pockets, and horn-look buttons. Tailored through the waist with enough room to layer a blazer underneath.</p>',
      productType: 'Coats',
      vendor: 'Forge & Field',
      tags: ['overcoat', 'wool', 'topcoat', 'outerwear', 'tailored'],
      seoTitle: 'Tailored Wool Overcoat — Italian Melton',
      seoDescription:
        'A single-breasted wool-blend melton overcoat cut below the knee. Half-canvas front, notch lapel, fully lined.',
      categoryKeys: ['outerwear'],
      collectionKeys: ['new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' }],
        },
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Camel', swatchHex: '#b08d57' },
            { value: 'Charcoal', swatchHex: '#363639' },
          ],
        },
      ],
      variants: [
        {
          key: 'coat-m-cml',
          sku: 'COAT-WOL-M-CML',
          title: 'M / Camel',
          priceCents: 28900,
          costCents: 13500,
          optionValues: ['M', 'Camel'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 4,
              reorderQuantity: 12,
              leadTimeDays: 35,
              movements: [
                { delta: 14, reason: 'receive', daysAgo: 45 },
                { delta: -3, reason: 'sale', daysAgo: 16 },
                { delta: -2, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
        {
          key: 'coat-l-chr',
          sku: 'COAT-WOL-L-CHR',
          title: 'L / Charcoal',
          priceCents: 28900,
          costCents: 13500,
          optionValues: ['L', 'Charcoal'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 4,
              reorderQuantity: 12,
              leadTimeDays: 35,
              movements: [
                { delta: 12, reason: 'receive', daysAgo: 45 },
                { delta: -4, reason: 'sale', daysAgo: 9 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Looks far more expensive',
          body: 'The camel is rich and the half-canvas front gives it real shape. Layers over a blazer with no pulling. Genuinely impressed for the price.',
          authorPersona: 'sloane',
          response:
            'The half-canvas is the detail people feel before they see it — enjoy it, Sloane!',
          helpfulCount: 9,
          daysAgo: 20,
        },
        {
          rating: 4,
          title: 'Warm and well cut',
          body: 'Tailored without being tight. I sized up to fit a sport coat under and it works. Wish it came in navy.',
          authorPersona: 'declan',
          helpfulCount: 3,
          daysAgo: 11,
        },
      ],
      questions: [
        {
          body: 'How warm is this for a real winter?',
          authorPersona: 'harper',
          answer:
            'The melton is midweight — great for fall and mild winters, or over a sweater down to freezing. For deep cold, layer a quilted liner underneath.',
          daysAgo: 15,
        },
      ],
    },
    {
      key: 'summer-dress',
      title: 'Tiered Poplin Midi Dress',
      handle: 'tiered-poplin-midi-dress',
      description:
        '<p>A breezy midi in crisp cotton poplin with a smocked back for an adjustable fit, adjustable tie straps, and a three-tiered skirt that moves. Light, structured, and easy — the throw-on-and-go dress for warm days.</p><p>Side seam pockets, a fully lined bodice, and a hidden length that hits mid-calf on most. Machine washable and built to layer with a denim jacket when it cools off.</p>',
      productType: 'Dresses',
      vendor: 'Atlas Standard',
      tags: ['dress', 'midi', 'poplin', 'summer', 'cotton'],
      seoTitle: 'Tiered Poplin Midi Dress — Cotton',
      seoDescription:
        'A tiered cotton-poplin midi with smocked back, tie straps, and side pockets. Light, structured, machine washable.',
      categoryKeys: ['tops'],
      collectionKeys: ['summer-edit', 'new-arrivals'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'XS' }, { value: 'S' }, { value: 'M' }, { value: 'L' }],
        },
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'Sky Blue', swatchHex: '#9cc4d8' },
            { value: 'Black', swatchHex: '#191919' },
          ],
        },
      ],
      variants: [
        {
          key: 'drs-s-sky',
          sku: 'DRS-PPL-S-SKY',
          title: 'S / Sky Blue',
          priceCents: 9800,
          costCents: 3900,
          optionValues: ['S', 'Sky Blue'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 10,
              reorderQuantity: 40,
              leadTimeDays: 26,
              movements: [
                { delta: 48, reason: 'receive', daysAgo: 23 },
                { delta: -15, reason: 'sale', daysAgo: 9 },
                { delta: -7, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          key: 'drs-m-blk',
          sku: 'DRS-PPL-M-BLK',
          title: 'M / Black',
          priceCents: 9800,
          costCents: 3900,
          optionValues: ['M', 'Black'],
          stock: [
            {
              warehouseKey: 'FULFILL',
              reorderPoint: 10,
              reorderQuantity: 40,
              leadTimeDays: 26,
              movements: [
                { delta: 44, reason: 'receive', daysAgo: 23 },
                { delta: -13, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Pockets!',
          body: 'A dress with real pockets, an adjustable back, and a flattering tier. The poplin holds its shape and does not cling. Lived in it all summer.',
          authorPersona: 'avery',
          helpfulCount: 11,
          daysAgo: 17,
        },
        {
          rating: 4,
          title: 'Lovely, runs slightly long',
          body: 'The sky blue is so pretty. I am 5’3” and it hit lower than midi, but a quick hem fixed it. Smocked back is forgiving.',
          authorPersona: 'noor',
          response: 'Thanks for the height note — we are adding a length guide to the listing!',
          helpfulCount: 6,
          daysAgo: 8,
        },
        {
          rating: 3,
          title: 'Wrinkles easily',
          body: 'Gorgeous on but the poplin creases if you sit a while. Steams out fast at least.',
          displayName: 'travelcapsule',
          status: 'pending',
          helpfulCount: 2,
          daysAgo: 2,
        },
      ],
      questions: [
        {
          body: 'Is the bodice lined? Wondering if I need a slip.',
          authorPersona: 'sloane',
          answer:
            'The bodice is fully lined and the skirt is opaque, so no slip needed for the black; the sky blue is also fully opaque.',
          daysAgo: 13,
        },
      ],
    },
    {
      key: 'outfit-bundle',
      title: 'Everyday Outfit Set',
      handle: 'everyday-outfit-set',
      description:
        '<p>Our most-worn pieces in one go: the Heritage Crewneck Tee, the Tapered Selvedge Jeans, and the Trucker Denim Jacket — a complete, build-anywhere outfit at a set price. Pick your sizes and colors at checkout.</p><p>Buy the set and save versus picking the pieces individually. The easiest way to start a wardrobe that just works together.</p>',
      productType: 'Sets',
      vendor: 'Boutique Set',
      tags: ['set', 'bundle', 'outfit', 'capsule'],
      seoTitle: 'Everyday Outfit Set — Tee, Jeans & Jacket',
      seoDescription:
        'A build-anywhere outfit: the Heritage tee, tapered selvedge jeans, and trucker denim jacket at a set price.',
      categoryKeys: ['tops'],
      collectionKeys: ['new-arrivals'],
      variants: [{ sku: 'SET-EVERYDAY', title: null, priceCents: 27800, costCents: 12050 }],
      reviews: [
        {
          rating: 5,
          title: 'Instant wardrobe',
          body: 'Ordered the set, three staples showed up that all go together. Saved money versus buying separately and saved me the decision fatigue.',
          authorPersona: 'mateo',
          helpfulCount: 7,
          daysAgo: 13,
        },
      ],
      questions: [
        {
          body: 'Can I pick different sizes for each piece?',
          displayName: 'mixandmatch',
          answer:
            'Yes — you choose the size and color for the tee, jeans, and jacket independently when you add the set to your cart.',
          daysAgo: 9,
        },
      ],
    },
    // Breadth for catalog-scale surfaces (pagination/deep-offset — docs/127 §8): ~90
    // lean single-variant products in the "Full Line" collection. Generated, so they
    // stay prose-free here; the authored products above carry the reviews/bundle story.
    ...apparelScaleProducts(),
  ],

  bundles: [
    {
      wrapperProductKey: 'outfit-bundle',
      pricing: { mode: 'percent', percentOff: 15 },
      inventoryMode: 'components',
      components: [
        { productKey: 'crewneck-tee', quantity: 1, required: true },
        { productKey: 'slim-jeans', quantity: 1, required: true },
        { productKey: 'denim-jacket', quantity: 1, required: true, swappable: true },
      ],
    },
  ],

  configurator: {
    productKey: 'crewneck-tee',
    name: 'Custom embroidered tee',
    options: [
      {
        key: 'color',
        label: 'Tee color',
        inputType: 'swatch',
        choices: [
          { value: 'black', label: 'Black', swatchHex: '#111111', isDefault: true },
          { value: 'sand', label: 'Sand', swatchHex: '#d8c3a5' },
        ],
      },
      {
        key: 'size',
        label: 'Size',
        inputType: 'single',
        choices: [
          { value: 's', label: 'S' },
          { value: 'm', label: 'M', isDefault: true },
          { value: 'l', label: 'L' },
          { value: 'xl', label: 'XL' },
        ],
      },
      {
        key: 'placement',
        label: 'Embroidery placement',
        inputType: 'single',
        choices: [
          { value: 'left-chest', label: 'Left chest', priceDeltaCents: 600, isDefault: true },
          { value: 'center', label: 'Center front', priceDeltaCents: 900 },
          { value: 'back', label: 'Full back', priceDeltaCents: 1500 },
        ],
      },
    ],
    addOns: [{ variantKey: 'SOCK-CRW-3PK-BLK', defaultIncluded: false, priceOverrideCents: 1500 }],
  },

  articles: [
    {
      slug: 'how-to-build-a-capsule-wardrobe',
      title: 'How to build a capsule wardrobe',
      excerpt:
        'A small set of pieces that all work together beats a closet full of clothes you never wear. Here is how to build one.',
      daysAgo: 6,
      body: doc(
        p(
          'A capsule wardrobe is a tight edit of clothes that mix and match into far more outfits than the number of pieces suggests. The goal is not minimalism for its own sake — it is getting dressed in thirty seconds and always looking put together.'
        ),
        h2('Start with a neutral foundation'),
        p(
          'Build around a small palette — say, black, navy, ecru, and one denim. When every top works with every bottom, a dozen pieces quietly become dozens of outfits. Save the loud colors for one or two accents.'
        ),
        h2('The core ten'),
        ul(
          'Two well-fitting tees (one black, one neutral)',
          'A heavyweight hoodie or crewneck sweater',
          'One pair of dark, tapered jeans',
          'A versatile jacket — a denim trucker or an overcoat',
          'A pair of clean low-top sneakers',
          'A few pairs of cushioned socks that all match'
        ),
        h2('Buy fewer, better things'),
        p(
          'A 14oz hoodie or a half-canvas coat costs more up front and outlasts three cheap ones. Spend where it shows and wears — outerwear, denim, shoes — and keep the basics simple. Then stop. The hardest part of a capsule is not adding to it.'
        )
      ),
    },
    {
      slug: 'caring-for-raw-denim',
      title: 'Caring for raw denim',
      excerpt:
        'Raw denim rewards patience with fades nobody else can copy. Here is how to break it in without ruining it.',
      daysAgo: 14,
      body: doc(
        p(
          'Raw, or unwashed, denim starts rigid and dark and slowly molds to how you actually move — fading at the creases behind your knees, along your thighs, and where your wallet sits. Treated right, a pair becomes uniquely yours.'
        ),
        h2('The first few weeks'),
        p(
          'Wear them. The fades you want come from movement and time, so resist the urge to wash early. A common path: wear consistently for three to six months before the first wash to set sharper contrast between the dark and the worn areas.'
        ),
        h2('Mind the crocking'),
        p(
          'Dark indigo will rub off — onto light couches, sneakers, and car seats — until it settles. Be careful around pale furniture for the first couple of weeks, and do not be alarmed by blue on your hands.'
        ),
        h2('When you finally wash'),
        ol(
          'Turn them inside out to protect the surface fades',
          'Wash cold, alone, on a gentle cycle with a little mild detergent',
          'Skip the dryer — hang dry to limit shrinkage and preserve the fades',
          'Spot-clean small spills between washes instead of a full cycle'
        ),
        p(
          'Done this way, a single pair can last years and tell the story of everywhere you wore it.'
        )
      ),
    },
    {
      slug: 'layering-for-fall',
      title: 'Layering for fall',
      excerpt:
        'The trick to dressing for a forty-degree morning and a seventy-degree afternoon is layers you can add and shed.',
      daysAgo: 21,
      body: doc(
        p(
          'Fall weather refuses to commit. The answer is not one heavy coat but a few light layers you can build up and peel back as the day swings — so you are comfortable at the bus stop and at lunch on a sunny patio.'
        ),
        h2('Think in three layers'),
        ul(
          'Base: a breathable tee or fine-knit that sits next to the skin',
          'Mid: a heavyweight hoodie or crewneck for warmth you can remove',
          'Shell: a denim trucker or a wool overcoat to block wind and dress it up'
        ),
        h2('Let textures do the work'),
        p(
          'When colors stay in a tight neutral range, texture carries the outfit — smooth poplin under brushed fleece under structured wool reads richer than three flat cottons. A merino beanie is the cheapest layer that adds the most warmth.'
        ),
        h2('Keep it easy to shed'),
        p(
          'Layers only work if removing one still looks intentional. A trucker over a hoodie over a tee gives you three good-looking stopping points as the temperature climbs — no awkward in-between.'
        )
      ),
    },
  ],
};
