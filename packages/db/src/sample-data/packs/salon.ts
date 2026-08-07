// Salon & spa sample pack — a full-service hair and beauty studio. Data-as-code
// built around the SCHEDULING star: stylists/therapists with skills + weekly
// availability windows, treatment rooms and nail stations, and a service menu
// (cuts, color, balayage, massage, facial, nails) whose resource roles the engine
// matches by skill then kind to GENERATE the appointment book. Around it sits a
// small retail shelf — shampoo, conditioner, styling cream, hair oil, nail polish —
// with stock, reviews, Q&A, a hair-care duo bundle, real salon clients, and
// between-visit care articles.

import { doc, h2, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const salonPack: SampleDataPack = {
  industry: 'salon',
  label: 'Beauty & salon',
  summary:
    'A full-service hair and beauty studio: a bookable service menu with stylists, therapists, treatment rooms and nail stations, plus a retail care shelf with stock, verified reviews, a hair-care duo bundle, and between-visit guides.',

  warehouses: [
    {
      key: 'STUDIO',
      code: 'STUDIO',
      name: 'Studio Stockroom',
      type: 'owned',
      city: 'Portland',
      region: 'OR',
    },
  ],

  categories: [
    { key: 'hair-care', name: 'Hair Care', handle: 'hair-care' },
    { key: 'styling', name: 'Styling', handle: 'styling' },
    { key: 'nails', name: 'Nails', handle: 'nails' },
    { key: 'treatments', name: 'Treatments', handle: 'treatments' },
  ],

  collections: [
    { key: 'salon-favorites', name: 'Salon Favorites', handle: 'salon-favorites', featured: true },
    { key: 'new', name: 'New', handle: 'new' },
  ],

  // What a stylist writes on the back of a client card (docs/144 §3). This is
  // the most literal case for the whole feature: every salon already keeps
  // exactly these, on paper, and loses them when the stylist leaves.
  recordTypes: [
    {
      objectKey: 'contact',
      properties: [
        {
          key: 'formula',
          label: 'Their formula',
          type: 'long_text',
          helpText: 'Colour, developer, timing. Written so a covering stylist can follow it.',
        },
        {
          key: 'allergies',
          label: 'Allergies and sensitivities',
          type: 'long_text',
          helpText: 'Patch-test results and anything that has reacted before.',
        },
        {
          key: 'usualStylist',
          label: 'Who they usually see',
          type: 'text',
        },
        {
          key: 'visitEvery',
          label: 'How often they come in',
          type: 'enum',
          helpText: 'Drives when a rebooking reminder should go out.',
          options: [
            { value: '4w', label: 'Every 4 weeks' },
            { value: '6w', label: 'Every 6 weeks' },
            { value: '8w', label: 'Every 8 weeks' },
            { value: '12w', label: 'Every 12 weeks' },
            { value: 'occasional', label: 'Now and then' },
          ],
        },
      ],
    },
  ],

  personas: [
    {
      key: 'amara',
      name: 'Amara Lindqvist',
      email: 'amara.lindqvist',
      phone: '+1-503-555-0142',
      line1: '1428 NE Alberta St',
      city: 'Portland',
      region: 'OR',
      postalCode: '97211',
      properties: {
        formula: '7N + 8G, 20 vol, 35 min at the root. Gloss 9V for 10 at the basin.',
        usualStylist: 'Rina',
        visitEvery: '6w',
      },
    },
    {
      key: 'jordan',
      name: 'Jordan Pike',
      email: 'jordan.pike',
      phone: '+1-503-555-0188',
      line1: '90 SW Bancroft St',
      city: 'Portland',
      region: 'OR',
      postalCode: '97239',
      properties: {
        formula: 'Balayage, lightener to level 8, toner 9A for 8 minutes.',
        allergies: 'Reacts to PPD — ammonia-free line only, patch tested 2026-02-11.',
        usualStylist: 'Kai',
        visitEvery: '12w',
      },
    },
    {
      key: 'noor',
      name: 'Noor Haddad',
      email: 'noor.haddad',
      phone: '+1-360-555-0119',
      line1: '755 Officers Row',
      city: 'Vancouver',
      region: 'WA',
      postalCode: '98661',
      properties: {
        formula: '4NN full coverage, 10 vol, 30 min. Grey at the temples needs the extra time.',
        usualStylist: 'Rina',
        visitEvery: '4w',
      },
    },
    {
      key: 'celia',
      name: 'Celia Marchetti',
      email: 'celia.marchetti',
      phone: '+1-503-555-0173',
      line1: '3310 SE Belmont St',
      city: 'Portland',
      region: 'OR',
      postalCode: '97214',
      properties: {
        formula: 'Cut and blow-dry only. No colour.',
        usualStylist: 'Marisol',
        visitEvery: '8w',
      },
    },
    {
      key: 'devon',
      name: 'Devon Walsh',
      email: 'devon.walsh',
      phone: '+1-971-555-0156',
      line1: '208 N Killingsworth St',
      city: 'Portland',
      region: 'OR',
      postalCode: '97217',
      properties: {
        formula: 'Clipper 2 back and sides, scissor on top. Beard tidy.',
        usualStylist: 'Kai',
        visitEvery: '4w',
      },
    },
    {
      key: 'priya',
      name: 'Priya Sundaram',
      email: 'priya.sundaram',
      phone: '+1-503-555-0124',
      line1: '4521 N Mississippi Ave',
      city: 'Portland',
      region: 'OR',
      postalCode: '97217',
      properties: {
        formula: 'Keratin smoothing, half head. Sulphate-free aftercare only.',
        allergies: 'Scalp is sensitive to heat — keep the dryer moving.',
        usualStylist: 'Marisol',
        visitEvery: 'occasional',
      },
    },
  ],

  products: [
    {
      key: 'repair-shampoo',
      title: 'Bond Repair Shampoo (250 ml)',
      handle: 'bond-repair-shampoo',
      description:
        '<p>A sulfate-free repair shampoo built for color-treated and chemically processed hair. It cleanses gently while a bond-building complex works to relink the broken disulfide bonds that leave hair brittle after lightening or heat styling. The lather is low and rinses clean — no squeaky stripped feeling, no fading your color faster than it should.</p><p>Use two to three times a week, alternating with your daily wash. Massage into wet hair, leave for sixty seconds so the actives can work, then rinse and follow with the matching conditioner.</p>',
      productType: 'Hair Care',
      productTypeKey: 'cosmetics',
      attributes: {
        keyIngredients:
          'A bond-building complex (bis-aminopropyl diglycol dimaleate) relinks the broken disulfide bonds left by lightening and heat styling. Gentle glucoside surfactants cleanse without stripping, while panthenol (pro-vitamin B5) and glycerin add slip and hydration. Sulfate- and salt-free, so it will not fade color or strip a keratin treatment.',
        howToUse:
          'Use two to three times a week, alternating with your daily wash. Massage into wet hair, leave for sixty seconds so the actives can work, then rinse and follow with the Bond Repair Conditioner.',
        skinType: ['dry', 'sensitive'],
        volume: '250 ml / 8.5 fl oz',
        fullIngredients:
          'Aqua/Water, Coco-Glucoside, Lauryl Glucoside, Sodium Cocoyl Isethionate, Glycerin, Bis-Aminopropyl Diglycol Dimaleate, Panthenol, Guar Hydroxypropyltrimonium Chloride, Citric Acid, Sodium Benzoate, Potassium Sorbate, Parfum/Fragrance.',
      },
      vendor: 'Studio Label',
      tags: ['shampoo', 'sulfate-free', 'color-safe', 'bond repair'],
      seoTitle: 'Bond Repair Shampoo for Color-Treated Hair (250 ml)',
      seoDescription:
        'Sulfate-free, color-safe repair shampoo with a bond-building complex. Gentle cleanse for processed and heat-styled hair.',
      categoryKeys: ['hair-care'],
      collectionKeys: ['salon-favorites'],
      variants: [
        {
          sku: 'repair-shampoo',
          title: null,
          priceCents: 2800,
          costCents: 1100,
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 12,
              reorderQuantity: 48,
              leadTimeDays: 10,
              movements: [
                { delta: 60, reason: 'receive', daysAgo: 26 },
                { delta: -9, reason: 'sale', daysAgo: 11 },
                { delta: -7, reason: 'sale', daysAgo: 4 },
                { delta: -1, reason: 'recount', daysAgo: 1 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Saved my over-bleached ends',
          body: 'My stylist put me on this after a big lightening session. Hair actually feels like hair again instead of straw.',
          authorPersona: 'amara',
          response: 'So glad your bond treatment is holding, Amara — see you at the next color!',
          helpfulCount: 7,
          daysAgo: 19,
        },
        {
          rating: 4,
          title: 'Gentle, color lasts longer',
          body: 'Noticed my balayage held its tone a couple weeks longer. Wish the bottle were bigger for the price.',
          authorPersona: 'celia',
          helpfulCount: 3,
          daysAgo: 9,
        },
      ],
      questions: [
        {
          body: 'Is this safe for keratin-treated hair?',
          authorPersona: 'noor',
          answer:
            'Yes — it is sulfate- and salt-free, so it will not strip a keratin treatment. It is actually a great choice for extending one.',
          daysAgo: 13,
        },
      ],
    },
    {
      key: 'repair-conditioner',
      title: 'Bond Repair Conditioner (250 ml)',
      handle: 'bond-repair-conditioner',
      description:
        '<p>The companion to our Bond Repair Shampoo. A rich, slip-heavy conditioner that detangles instantly while the same bond-building complex continues the repair the shampoo starts. Light enough for fine hair, but layer it on the mid-lengths and ends if yours runs dry or coarse.</p><p>After shampooing, work through from the ears down, leave for two to three minutes, then rinse. For a deeper treatment, leave it in under a warm towel for ten minutes once a week.</p>',
      productType: 'Hair Care',
      productTypeKey: 'cosmetics',
      attributes: {
        keyIngredients:
          'The same bond-building complex (bis-aminopropyl diglycol dimaleate) continues the repair the shampoo starts. Behentrimonium methosulfate and cetyl alcohol deliver instant slip and detangling, while shea butter and argan oil soften mid-lengths and ends without weighing hair down.',
        howToUse:
          'After shampooing, work through from the ears down, leave for two to three minutes, then rinse. For a deeper treatment, leave it in under a warm towel for ten minutes once a week.',
        skinType: ['dry', 'normal'],
        volume: '250 ml / 8.5 fl oz',
        fullIngredients:
          'Aqua/Water, Cetearyl Alcohol, Behentrimonium Methosulfate, Butyrospermum Parkii (Shea) Butter, Argania Spinosa Kernel Oil, Bis-Aminopropyl Diglycol Dimaleate, Cetyl Alcohol, Panthenol, Glycerin, Hydrolyzed Wheat Protein, Phenoxyethanol, Ethylhexylglycerin, Citric Acid, Parfum/Fragrance.',
      },
      vendor: 'Studio Label',
      tags: ['conditioner', 'color-safe', 'bond repair', 'detangle'],
      seoTitle: 'Bond Repair Conditioner for Color-Treated Hair (250 ml)',
      seoDescription:
        'Slip-rich, color-safe repair conditioner with a bond-building complex. Detangles and continues the repair your shampoo starts.',
      categoryKeys: ['hair-care'],
      collectionKeys: ['salon-favorites'],
      variants: [
        {
          sku: 'repair-conditioner',
          title: null,
          priceCents: 3000,
          costCents: 1200,
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 12,
              reorderQuantity: 48,
              leadTimeDays: 10,
              movements: [
                { delta: 60, reason: 'receive', daysAgo: 26 },
                { delta: -8, reason: 'sale', daysAgo: 12 },
                { delta: -6, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'So much slip',
          body: 'Detangles my thick curly hair in one pass. Pairs perfectly with the shampoo.',
          authorPersona: 'priya',
          helpfulCount: 5,
          daysAgo: 15,
        },
        {
          rating: 5,
          title: '',
          body: 'A little goes a long way. The bottle lasts me ages even on long hair.',
          displayName: 'curlsbycoast',
          helpfulCount: 2,
          daysAgo: 6,
        },
      ],
      questions: [
        {
          body: 'Will this weigh down fine hair?',
          displayName: 'finehairfran',
          answer:
            'Not if you keep it to the mid-lengths and ends and rinse well — it is formulated to be lightweight. Skip the roots if your hair is very fine.',
          daysAgo: 10,
        },
      ],
    },
    {
      key: 'styling-cream',
      title: 'Smoothing Styling Cream (100 ml)',
      handle: 'smoothing-styling-cream',
      description:
        '<p>A medium-hold, no-crunch styling cream that tames frizz and adds soft definition without the helmet feel. Heat-protectant up to 230°C, so it doubles as your blow-dry primer. Works on everything from a sleek blowout to air-dried waves.</p><p>Warm a dime-sized amount between your palms and rake through damp hair before styling. Add a touch more to dry hair to smooth flyaways and seal the look.</p>',
      productType: 'Styling',
      productTypeKey: 'cosmetics',
      attributes: {
        keyIngredients:
          'A film-forming polymer (VP/VA copolymer) gives flexible medium hold with no crunch. A heat-protectant blend of hydrolyzed wheat protein and quaternized conditioners shields hair up to 230°C, while marula oil and glycerin smooth frizz and add softness.',
        howToUse:
          'Warm a dime-sized amount between your palms and rake through damp hair before styling. Add a touch more to dry hair to smooth flyaways and seal the look.',
        skinType: ['all'],
        volume: '100 ml / 3.4 fl oz',
        fullIngredients:
          'Aqua/Water, Cyclopentasiloxane, VP/VA Copolymer, Cetearyl Alcohol, Glycerin, Sclerocarya Birrea Seed Oil, Behentrimonium Chloride, Hydrolyzed Wheat Protein, Panthenol, Dimethicone, Amodimethicone, Phenoxyethanol, Ethylhexylglycerin, Parfum/Fragrance.',
      },
      vendor: 'Studio Label',
      tags: ['styling cream', 'heat protectant', 'frizz', 'blowout'],
      seoTitle: 'Smoothing Styling Cream with Heat Protection (100 ml)',
      seoDescription:
        'Medium-hold, no-crunch styling cream and heat protectant to 230°C. Tames frizz and primes the blow-dry.',
      categoryKeys: ['styling'],
      collectionKeys: ['salon-favorites', 'new'],
      variants: [
        {
          sku: 'styling-cream',
          title: null,
          priceCents: 2400,
          costCents: 900,
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 10,
              reorderQuantity: 40,
              leadTimeDays: 9,
              movements: [
                { delta: 50, reason: 'receive', daysAgo: 22 },
                { delta: -11, reason: 'sale', daysAgo: 8 },
                { delta: -5, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'My blowout lasts days now',
          body: 'Use it as a primer before drying and the smoothness holds through workouts. No grease.',
          authorPersona: 'jordan',
          helpfulCount: 6,
          daysAgo: 17,
        },
        {
          rating: 4,
          title: 'Great, faint scent',
          body: 'Controls my frizz in humidity. The scent is subtle but lingers — fine by me.',
          displayName: 'pdxwaves',
          status: 'pending',
          helpfulCount: 1,
          daysAgo: 2,
        },
      ],
      questions: [
        {
          body: 'Can I use this on dry hair too or just damp?',
          authorPersona: 'devon',
          answer:
            'Both — rake it through damp hair before drying for hold, then rub a tiny bit between your palms on dry hair to smooth flyaways.',
          daysAgo: 12,
        },
      ],
    },
    {
      key: 'hair-oil',
      title: 'Nourishing Hair Oil (50 ml)',
      handle: 'nourishing-hair-oil',
      description:
        '<p>A weightless, fast-absorbing finishing oil — argan, marula, and squalane — that adds shine and tames split ends without leaving a greasy film. A single drop on the ends finishes a style; a few drops on damp hair protects against heat and tangles before you dry.</p><p>Start with one or two drops, warm between your palms, and smooth over the mid-lengths and ends. Add more only as needed — this concentrate goes a very long way.</p>',
      productType: 'Hair Care',
      productTypeKey: 'cosmetics',
      attributes: {
        keyIngredients:
          'A weightless blend of argan oil (fatty acids and vitamin E for shine), marula oil (fast-absorbing and antioxidant-rich), and plant-derived squalane to smooth the cuticle and tame split ends without a greasy film. No added fragrance — the faint scent is the natural oils themselves.',
        howToUse:
          'Start with one or two drops, warm between your palms, and smooth over the mid-lengths and ends of damp or dry hair. Add more only as needed — this concentrate goes a very long way.',
        skinType: ['dry'],
        volume: '50 ml / 1.7 fl oz',
        fullIngredients:
          'Caprylic/Capric Triglyceride, Argania Spinosa Kernel Oil, Sclerocarya Birrea Seed Oil, Squalane, Cyclopentasiloxane, Dimethicone, Simmondsia Chinensis (Jojoba) Seed Oil, Helianthus Annuus (Sunflower) Seed Oil, Tocopherol.',
      },
      vendor: 'Studio Label',
      tags: ['hair oil', 'argan', 'shine', 'finishing'],
      seoTitle: 'Nourishing Argan & Marula Hair Oil (50 ml)',
      seoDescription:
        'Weightless finishing oil with argan, marula, and squalane. Adds shine and tames split ends without a greasy film.',
      categoryKeys: ['hair-care', 'styling'],
      collectionKeys: ['new'],
      variants: [
        {
          sku: 'hair-oil',
          title: null,
          priceCents: 3600,
          costCents: 1500,
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 8,
              reorderQuantity: 30,
              leadTimeDays: 12,
              movements: [
                { delta: 36, reason: 'receive', daysAgo: 18 },
                { delta: -6, reason: 'sale', daysAgo: 7 },
                { delta: -4, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'A drop is all it takes',
          body: 'Shiny, never greasy. My ends look healthy between trims and the bottle is lasting forever.',
          authorPersona: 'noor',
          helpfulCount: 4,
          daysAgo: 14,
        },
      ],
      questions: [
        {
          body: 'Does this have a strong fragrance? I am sensitive to scents.',
          displayName: 'gentlescent',
          answer:
            'It is very lightly scented from the natural oils themselves — there is no added fragrance, so it fades almost immediately.',
          daysAgo: 8,
        },
      ],
    },
    {
      key: 'nail-polish',
      title: 'Long-Wear Nail Polish (15 ml)',
      handle: 'long-wear-nail-polish',
      description:
        '<p>A salon-grade, chip-resistant nail lacquer with a high-gloss gel-like finish — no lamp required. The 10-free formula skips the harshest ingredients and goes on smooth in two even coats. Pick your shade; each is mixed in small batches for true, saturated color.</p><p>Apply a base coat, two thin coats of color, and a top coat, letting each layer flash off for two minutes. Expect five to seven days of wear with a top coat refresh midweek.</p>',
      productType: 'Nails',
      productTypeKey: 'cosmetics',
      attributes: {
        keyIngredients:
          'A 10-free lacquer system: nitrocellulose and a bio-sourced film-former build a high-gloss, chip-resistant finish with no lamp required. Free of formaldehyde, toluene, DBP, camphor, formaldehyde resin, xylene, and other harsh ingredients. Vegan and cruelty-free.',
        howToUse:
          'Apply a base coat, then two thin coats of color, letting each layer flash off for two minutes. Seal with a top coat and refresh midweek for five to seven days of wear.',
        skinType: ['all'],
        volume: '15 ml / 0.5 fl oz',
        fullIngredients:
          'Butyl Acetate, Ethyl Acetate, Nitrocellulose, Acetyl Tributyl Citrate, Adipic Acid/Neopentyl Glycol/Trimellitic Anhydride Copolymer, Isopropyl Alcohol, Stearalkonium Bentonite, Silica, Citric Acid [+/- Mica, CI 77891 (Titanium Dioxide), CI 77491/CI 77492/CI 77499 (Iron Oxides)].',
      },
      vendor: 'Studio Label',
      tags: ['nail polish', '10-free', 'long-wear', 'gel-like'],
      seoTitle: 'Long-Wear 10-Free Nail Polish (15 ml)',
      seoDescription:
        'Chip-resistant, 10-free nail lacquer with a high-gloss gel-like finish — no lamp. True saturated color in two coats.',
      categoryKeys: ['nails'],
      collectionKeys: ['salon-favorites'],
      options: [
        {
          name: 'Shade',
          displayType: 'swatch',
          values: [
            { value: 'Ballet Slipper', swatchHex: '#F3C9C4' },
            { value: 'Terracotta', swatchHex: '#C16A4A' },
            { value: 'Midnight Plum', swatchHex: '#3B2236' },
          ],
        },
      ],
      variants: [
        {
          sku: 'nail-polish-ballet',
          title: 'Ballet Slipper',
          priceCents: 1600,
          costCents: 600,
          optionValues: ['Ballet Slipper'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 6,
              reorderQuantity: 24,
              leadTimeDays: 14,
              movements: [
                { delta: 24, reason: 'receive', daysAgo: 20 },
                { delta: -5, reason: 'sale', daysAgo: 9 },
                { delta: -3, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          sku: 'nail-polish-terracotta',
          title: 'Terracotta',
          priceCents: 1600,
          costCents: 600,
          optionValues: ['Terracotta'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 6,
              reorderQuantity: 24,
              leadTimeDays: 14,
              movements: [
                { delta: 24, reason: 'receive', daysAgo: 20 },
                { delta: -8, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
        {
          sku: 'nail-polish-plum',
          title: 'Midnight Plum',
          priceCents: 1600,
          costCents: 600,
          optionValues: ['Midnight Plum'],
          stock: [
            {
              warehouseKey: 'STUDIO',
              reorderPoint: 6,
              reorderQuantity: 24,
              leadTimeDays: 14,
              movements: [
                { delta: 24, reason: 'receive', daysAgo: 20 },
                { delta: -4, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Lasted a full week',
          body: 'Terracotta is the perfect fall shade and it did not chip until day seven. No lamp, no fuss.',
          authorPersona: 'celia',
          helpfulCount: 5,
          daysAgo: 16,
        },
        {
          rating: 4,
          title: 'Gorgeous color, two coats needed',
          body: 'Midnight Plum is deep and glossy. You do need two coats for the full payoff, but it is worth it.',
          displayName: 'mani.monday',
          helpfulCount: 2,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Is the formula vegan and cruelty-free?',
          authorPersona: 'priya',
          answer:
            'Yes — every shade is vegan, cruelty-free, and 10-free (no formaldehyde, toluene, DBP, and so on).',
          daysAgo: 11,
        },
      ],
    },
    {
      key: 'haircare-duo',
      title: 'Bond Repair Duo',
      handle: 'bond-repair-duo',
      description:
        '<p>Our two best-sellers in one set: the Bond Repair Shampoo and matching Conditioner, built to work together on color-treated and chemically processed hair. Buy them as a duo and save over picking each up on its own.</p><p>The everyday kit your stylist would send you home with after a color or lightening session — gentle cleanse, instant slip, and a bond-building complex in both bottles.</p>',
      productType: 'Hair Care',
      productTypeKey: 'cosmetics',
      attributes: {
        keyIngredients:
          'Both bottles carry the bond-building complex (bis-aminopropyl diglycol dimaleate) that relinks broken disulfide bonds. The shampoo cleanses with gentle glucoside surfactants; the conditioner softens and detangles with shea butter and argan oil. Sulfate- and salt-free, color-safe.',
        howToUse:
          'Wash two to three times a week with the shampoo, leaving it on for sixty seconds; follow every time with the conditioner from the ears down for two to three minutes, then rinse.',
        skinType: ['dry', 'sensitive'],
        volume: '2 × 250 ml / 8.5 fl oz',
        fullIngredients:
          'Shampoo: Aqua/Water, Coco-Glucoside, Lauryl Glucoside, Sodium Cocoyl Isethionate, Glycerin, Bis-Aminopropyl Diglycol Dimaleate, Panthenol, Guar Hydroxypropyltrimonium Chloride, Citric Acid, Sodium Benzoate, Parfum/Fragrance. Conditioner: Aqua/Water, Cetearyl Alcohol, Behentrimonium Methosulfate, Butyrospermum Parkii (Shea) Butter, Argania Spinosa Kernel Oil, Bis-Aminopropyl Diglycol Dimaleate, Panthenol, Hydrolyzed Wheat Protein, Phenoxyethanol, Ethylhexylglycerin, Parfum/Fragrance.',
      },
      vendor: 'Studio Label',
      tags: ['duo', 'set', 'bond repair', 'color-safe'],
      seoTitle: 'Bond Repair Duo — Shampoo & Conditioner Set',
      seoDescription:
        'The Bond Repair Shampoo and Conditioner together as a money-saving duo for color-treated and processed hair.',
      categoryKeys: ['hair-care'],
      collectionKeys: ['salon-favorites'],
      variants: [{ sku: 'haircare-duo', title: null, priceCents: 5200, costCents: 2300 }],
      reviews: [
        {
          rating: 5,
          title: 'The only thing my hair needs',
          body: 'Bought the duo on my stylist’s rec and have repurchased twice. Together they are better than apart.',
          authorPersona: 'amara',
          helpfulCount: 4,
          daysAgo: 13,
        },
      ],
      questions: [
        {
          body: 'Is the duo the full-size bottles or travel size?',
          displayName: 'planahead',
          answer:
            'Both are the full 250 ml size — the same bottles sold individually, just bundled.',
          daysAgo: 9,
        },
      ],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'haircare-duo',
      pricing: { mode: 'percent', percentOff: 10 },
      inventoryMode: 'components',
      components: [
        { productKey: 'repair-shampoo', quantity: 1, required: true },
        { productKey: 'repair-conditioner', quantity: 1, required: true },
      ],
    },
  ],

  scheduling: {
    resources: [
      {
        key: 'stylist-mira',
        name: 'Mira (Senior Stylist)',
        kind: 'staff',
        skills: ['haircut', 'color', 'balayage'],
        windows: [
          { day: 2, startMin: 540, endMin: 1020 },
          { day: 3, startMin: 540, endMin: 1020 },
          { day: 4, startMin: 600, endMin: 1140 },
          { day: 5, startMin: 540, endMin: 1020 },
          { day: 6, startMin: 540, endMin: 900 },
        ],
      },
      {
        key: 'stylist-theo',
        name: 'Theo (Stylist & Barber)',
        kind: 'staff',
        skills: ['haircut'],
        windows: [
          { day: 1, startMin: 540, endMin: 1020 },
          { day: 2, startMin: 540, endMin: 1020 },
          { day: 4, startMin: 540, endMin: 1020 },
          { day: 5, startMin: 600, endMin: 1140 },
          { day: 6, startMin: 540, endMin: 900 },
        ],
      },
      {
        key: 'therapist-ines',
        name: 'Inés (Massage & Skin)',
        kind: 'staff',
        skills: ['massage', 'facial'],
        windows: [
          { day: 2, startMin: 600, endMin: 1080 },
          { day: 3, startMin: 600, endMin: 1080 },
          { day: 4, startMin: 600, endMin: 1080 },
          { day: 5, startMin: 600, endMin: 1080 },
        ],
      },
      {
        key: 'tech-rosa',
        name: 'Rosa (Nail Technician)',
        kind: 'staff',
        skills: ['nails'],
        windows: [
          { day: 1, startMin: 600, endMin: 1080 },
          { day: 3, startMin: 600, endMin: 1080 },
          { day: 4, startMin: 600, endMin: 1080 },
          { day: 5, startMin: 600, endMin: 1080 },
          { day: 6, startMin: 540, endMin: 960 },
        ],
      },
      {
        key: 'treatment-room-1',
        name: 'Treatment Room 1',
        kind: 'space',
        windows: [
          { day: 1, startMin: 540, endMin: 1140 },
          { day: 2, startMin: 540, endMin: 1140 },
          { day: 3, startMin: 540, endMin: 1140 },
          { day: 4, startMin: 540, endMin: 1140 },
          { day: 5, startMin: 540, endMin: 1140 },
          { day: 6, startMin: 540, endMin: 960 },
        ],
      },
      {
        key: 'nail-station-1',
        name: 'Nail Station 1',
        kind: 'table',
        windows: [
          { day: 1, startMin: 540, endMin: 1140 },
          { day: 3, startMin: 540, endMin: 1140 },
          { day: 4, startMin: 540, endMin: 1140 },
          { day: 5, startMin: 540, endMin: 1140 },
          { day: 6, startMin: 540, endMin: 960 },
        ],
      },
    ],
    // A salon guest books *with a person*, so every service is `customer_choice` —
    // the storefront widget shows a "choose your stylist / therapist / technician"
    // step. Haircut services match two stylists (Mira, Theo), so that picker offers
    // a real choice; single-specialist services (color, nails, massage) still show
    // the one who does it, which is the honest model here.
    services: [
      {
        key: 'womens-cut-style',
        name: "Women's Cut & Style",
        description:
          'A consultation, precision cut, and finished blow-dry style tailored to your hair and the way you wear it.',
        durationMinutes: 60,
        priceCents: 8500,
        bookingType: 'appointment',
        bufferAfterMin: 10,
        assignmentStrategy: 'customer_choice',
        resourceRoles: [{ role: 'stylist', kind: 'staff', skill: 'haircut' }],
      },
      {
        key: 'mens-cut',
        name: "Men's Cut",
        description:
          'A clean, on-trend cut with a straight-razor neckline and a quick style to finish. In and out without the wait.',
        durationMinutes: 30,
        priceCents: 4500,
        bookingType: 'appointment',
        assignmentStrategy: 'customer_choice',
        resourceRoles: [{ role: 'stylist', kind: 'staff', skill: 'haircut' }],
      },
      {
        key: 'full-color',
        name: 'Full Color',
        description:
          'Single-process all-over color — gray coverage or a top-to-bottom shade change — with a gloss and blow-dry to finish.',
        durationMinutes: 120,
        priceCents: 13500,
        bookingType: 'appointment',
        bufferAfterMin: 15,
        assignmentStrategy: 'customer_choice',
        resourceRoles: [{ role: 'stylist', kind: 'staff', skill: 'color' }],
      },
      {
        key: 'balayage',
        name: 'Balayage',
        description:
          'Hand-painted, lived-in highlights for a soft grown-out blend. Includes a toner and a finishing style. New guests book a consult first.',
        durationMinutes: 180,
        priceCents: 22000,
        bookingType: 'appointment',
        bufferAfterMin: 15,
        requiresApproval: true,
        assignmentStrategy: 'customer_choice',
        resourceRoles: [{ role: 'stylist', kind: 'staff', skill: 'balayage' }],
      },
      {
        key: 'manicure',
        name: 'Manicure',
        description:
          'Shape, cuticle care, a relaxing hand massage, and two coats of long-wear polish in the shade of your choice.',
        durationMinutes: 45,
        priceCents: 4000,
        bookingType: 'appointment',
        bufferAfterMin: 10,
        assignmentStrategy: 'customer_choice',
        resourceRoles: [
          { role: 'tech', kind: 'staff', skill: 'nails' },
          { role: 'station', kind: 'table' },
        ],
      },
      {
        key: 'deep-tissue-massage',
        name: 'Deep-Tissue Massage',
        description:
          'A focused 60-minute deep-tissue session to work out tension in the back, neck, and shoulders.',
        durationMinutes: 60,
        priceCents: 9500,
        bookingType: 'appointment',
        bufferAfterMin: 15,
        assignmentStrategy: 'customer_choice',
        resourceRoles: [
          { role: 'therapist', kind: 'staff', skill: 'massage' },
          { role: 'room', kind: 'space' },
        ],
      },
      {
        key: 'facial',
        name: 'Signature Facial',
        description:
          'A custom cleanse, exfoliation, extractions as needed, mask, and massage tuned to your skin on the day.',
        durationMinutes: 75,
        priceCents: 11000,
        bookingType: 'appointment',
        bufferAfterMin: 15,
        assignmentStrategy: 'customer_choice',
        resourceRoles: [
          { role: 'therapist', kind: 'staff', skill: 'facial' },
          { role: 'room', kind: 'space' },
        ],
      },
    ],
  },

  articles: [
    {
      slug: 'how-often-should-you-color-your-hair',
      title: 'How often should you color your hair?',
      excerpt:
        'Roots, fade, and damage all pull on different schedules. Here is how to time your color so your hair stays healthy.',
      daysAgo: 4,
      body: doc(
        p(
          'The honest answer is: it depends on what you are coloring and why. A single-process gray cover-up, all-over fashion color, and hand-painted balayage all grow out and fade differently, so they each want a different rhythm. Coloring on the right schedule keeps the result looking intentional and keeps your hair in good shape.'
        ),
        h2('The rough schedule'),
        ul(
          'Gray coverage and root touch-ups: every four to six weeks, as the regrowth line appears',
          'All-over single-process color: every six to eight weeks',
          'Balayage and hand-painted highlights: every twelve to sixteen weeks — that is the whole point of a lived-in blend',
          'A gloss or toner refresh: every four to six weeks to revive faded tone between full color'
        ),
        h2('Let the damage, not the calendar, lead'),
        p(
          'If your ends feel dry, gummy when wet, or break easily, stretch the time between sessions and lean on a bond-repair routine at home. Over-processing is far harder to fix than a few extra days of visible roots. When in doubt, ask your stylist to plan your next two visits at the chair — it is easier to space them out than to undo damage later.'
        )
      ),
    },
    {
      slug: 'making-your-blowout-last',
      title: 'Making your blowout last',
      excerpt:
        'A salon blowout can hold for days with the right prep and a few habits between washes.',
      daysAgo: 11,
      body: doc(
        p(
          'A great blowout is half technique and half what you do after you leave the chair. With a little prep and restraint, that just-styled bounce can carry you three or four days instead of one.'
        ),
        h2('Start with the right prep'),
        p(
          'Hold is built on a clean foundation. Use a smoothing primer or styling cream with heat protection before you dry, and make sure hair is fully dry — even slightly damp roots will fall flat within hours. Finish with a cool shot to set the cuticle.'
        ),
        h2('Protect it between washes'),
        ul(
          'Sleep on a silk or satin pillowcase to cut friction and frizz',
          'Pin the top loosely or wrap your hair at night to keep the shape',
          'Reach for dry shampoo at the roots before you reach for water',
          'Refresh the ends with a single drop of finishing oil, never more'
        ),
        p(
          'Wash less than you think you need to. Most people stretch to every third day comfortably, and the longer your blowout lives, the more your hair thanks you for the break from heat.'
        )
      ),
    },
    {
      slug: 'at-home-care-between-visits',
      title: 'At-home care between visits',
      excerpt:
        'The simple routine that keeps color bright and ends healthy until your next appointment.',
      daysAgo: 22,
      body: doc(
        p(
          'What you do at home between appointments matters more than the appointment itself. A handful of small habits will keep your color truer, your ends stronger, and your next visit easier on both your hair and your wallet.'
        ),
        h2('Build a simple routine'),
        ul(
          'Use a sulfate-free, color-safe shampoo and conditioner — harsh cleansers strip tone fast',
          'Add a bond-repair treatment once or twice a week if your hair is colored or heat-styled',
          'Always use a heat protectant before hot tools, every single time',
          'Finish with a drop of oil on the ends to seal and add shine'
        ),
        h2('Protect what you paid for'),
        p(
          'Sun, chlorine, and very hot water all fade color quickly. Rinse cooler, wear a hat on long days outside, and wet your hair with clean water before you swim so it absorbs less of the pool. Small things, but they add weeks to the life of your color.'
        ),
        h2('Know when to come in'),
        p(
          'Book your next visit before you leave — a standing rhythm beats waiting until your roots or your ends force the issue. If something feels off between appointments, call us; a quick gloss or trim is far cheaper than a correction later.'
        )
      ),
    },
  ],
};
