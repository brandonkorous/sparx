// Food & beverage sample pack — a specialty food + coffee shop. Data-as-code: a
// stocked pantry of single-origin coffee, tea, oils, honey, hot sauce, granola,
// chocolate, jam, and a spice blend; perishable lots with expiry watchlist demo;
// foodie retail buyers; verified reviews + Q&A; a "Morning Ritual" gift box bundle;
// and recipe/brew-guide articles. Loading it tells the full cross-module story for a
// grocer — stocked, lot-tracked, reviewed, bundled, and sourced from a PO.

import { doc, h2, ol, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const foodPack: SampleDataPack = {
  industry: 'food',
  label: 'Food & beverage',
  summary:
    'A specialty food + coffee shop: a stocked pantry of single-origin coffee, tea, oils, honey, and small-batch goods, with perishable lots, foodie customers, orders + returns, verified reviews, suppliers + purchase orders, a gift-box bundle, and recipe + brewing guides.',

  warehouses: [
    {
      key: 'ROAST',
      code: 'ROAST',
      name: 'Roastery & Pantry',
      type: 'owned',
      city: 'Portland',
      region: 'OR',
    },
    {
      key: 'EAST',
      code: 'EAST-3PL',
      name: 'East Coast Fulfillment',
      type: '3pl',
      city: 'Lancaster',
      region: 'PA',
    },
  ],

  suppliers: [
    {
      code: 'CASCADE',
      name: 'Cascade Green Coffee Importers',
      paymentTerms: 'net30',
      leadTimeDays: 10,
      city: 'Seattle',
      region: 'WA',
      variantKeys: [
        'COF-ETH-WB-12',
        'COF-ETH-GR-12',
        'COF-COL-WB-12',
        'COF-COL-GR-12',
        'COF-ESP-WB-12',
        'COF-ESP-WB-2LB',
      ],
    },
  ],

  lots: [
    {
      variantKey: 'COF-ETH-WB-12',
      warehouseKey: 'ROAST',
      lotNumber: 'ROAST-ETH-2026-0612',
      quantity: 96,
      expiresInDays: 45,
      hazmatClass: 'none',
    },
    {
      variantKey: 'COF-COL-WB-12',
      warehouseKey: 'ROAST',
      lotNumber: 'ROAST-COL-2026-0608',
      quantity: 84,
      expiresInDays: 60,
      hazmatClass: 'none',
    },
    {
      variantKey: 'GRAN-MAPLE-12',
      warehouseKey: 'ROAST',
      lotNumber: 'GRAN-2026-0530',
      quantity: 60,
      expiresInDays: 90,
      hazmatClass: 'none',
    },
    {
      variantKey: 'TEA-EG-4',
      warehouseKey: 'ROAST',
      lotNumber: 'TEA-EG-2025-1210',
      quantity: 52,
      expiresInDays: 110,
      hazmatClass: 'none',
    },
    {
      variantKey: 'OOIL-EVOO-500',
      warehouseKey: 'EAST',
      lotNumber: 'EVOO-2025-1120',
      quantity: 72,
      expiresInDays: 420,
      hazmatClass: 'none',
    },
  ],

  categories: [
    { key: 'coffee-tea', name: 'Coffee & Tea', handle: 'coffee-tea' },
    { key: 'pantry', name: 'Pantry', handle: 'pantry' },
    { key: 'snacks', name: 'Snacks', handle: 'snacks' },
    { key: 'sweets', name: 'Sweets', handle: 'sweets' },
    { key: 'oils-vinegars', name: 'Oils & Vinegars', handle: 'oils-vinegars' },
  ],

  collections: [
    { key: 'best-sellers', name: 'Best Sellers', handle: 'best-sellers', featured: true },
    { key: 'giftable', name: 'Gift-able', handle: 'giftable' },
    { key: 'new-season', name: 'New This Season', handle: 'new-this-season' },
  ],

  personas: [
    {
      key: 'amelia',
      name: 'Amelia Cho',
      email: 'amelia.cho',
      phone: '+1-503-555-0148',
      line1: '2210 SE Clinton St',
      city: 'Portland',
      region: 'OR',
      postalCode: '97202',
    },
    {
      key: 'desmond',
      name: 'Desmond Pierce',
      email: 'desmond.pierce',
      phone: '+1-718-555-0193',
      line1: '54 Greenpoint Ave',
      city: 'Brooklyn',
      region: 'NY',
      postalCode: '11222',
    },
    {
      key: 'lucia',
      name: 'Lucia Marin',
      email: 'lucia.marin',
      phone: '+1-512-555-0167',
      line1: '908 E Cesar Chavez St',
      city: 'Austin',
      region: 'TX',
      postalCode: '78702',
    },
    {
      key: 'theo',
      name: 'Theo Brandt',
      email: 'theo.brandt',
      phone: '+1-612-555-0121',
      line1: '417 Washington Ave N',
      city: 'Minneapolis',
      region: 'MN',
      postalCode: '55401',
    },
    {
      key: 'nadia',
      name: 'Nadia Rahimi',
      email: 'nadia.rahimi',
      phone: '+1-415-555-0179',
      line1: '1366 Valencia St',
      city: 'San Francisco',
      region: 'CA',
      postalCode: '94110',
    },
    {
      key: 'walt',
      name: 'Walter Osei',
      email: 'walter.osei',
      phone: '+1-404-555-0136',
      line1: '631 Edgewood Ave SE',
      city: 'Atlanta',
      region: 'GA',
      postalCode: '30312',
    },
  ],

  products: [
    {
      key: 'coffee-ethiopia',
      title: 'Single-Origin Ethiopia Yirgacheffe',
      handle: 'single-origin-ethiopia-yirgacheffe',
      description:
        '<p>A bright, washed Yirgacheffe from the Gedeo zone, roasted light to keep its signature florals intact. Expect jasmine and bergamot on the nose, a clean lemon-tea acidity, and a finish that lingers like stone fruit. This is the bag we hand someone who says they "don\'t like coffee" — because they\'ve never had it taste like this.</p><p>Roasted to order in small batches and shipped within 48 hours, so the bag in your hand is days off the roaster, not weeks. Best from days 4 through 21 after the roast date stamped on the valve seal.</p>',
      productType: 'Coffee',
      vendor: 'Ridgeline Roasters',
      tags: ['coffee', 'single-origin', 'ethiopia', 'light-roast', 'whole-bean'],
      seoTitle: 'Ethiopia Yirgacheffe Single-Origin Coffee — Light Roast',
      seoDescription:
        'Floral, citrus-bright washed Yirgacheffe roasted light and shipped within 48 hours. Whole bean or ground.',
      categoryKeys: ['coffee-tea'],
      collectionKeys: ['best-sellers', 'new-season'],
      options: [
        {
          name: 'Grind',
          displayType: 'segmented',
          values: [{ value: 'Whole bean' }, { value: 'Ground' }],
        },
      ],
      variants: [
        {
          key: 'COF-ETH-WB-12',
          sku: 'COF-ETH-WB-12',
          title: 'Whole bean — 12 oz',
          priceCents: 1899,
          costCents: 820,
          optionValues: ['Whole bean'],
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 24,
              reorderQuantity: 96,
              leadTimeDays: 10,
              movements: [
                { delta: 120, reason: 'receive', daysAgo: 18 },
                { delta: -14, reason: 'sale', daysAgo: 8 },
                { delta: -9, reason: 'sale', daysAgo: 3 },
                { delta: -1, reason: 'recount', daysAgo: 1 },
              ],
            },
            {
              warehouseKey: 'EAST',
              reorderPoint: 12,
              reorderQuantity: 48,
              movements: [
                { delta: 48, reason: 'receive', daysAgo: 15 },
                { delta: -7, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
        {
          key: 'COF-ETH-GR-12',
          sku: 'COF-ETH-GR-12',
          title: 'Ground — 12 oz',
          priceCents: 1899,
          costCents: 820,
          optionValues: ['Ground'],
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 16,
              reorderQuantity: 48,
              leadTimeDays: 10,
              movements: [
                { delta: 64, reason: 'receive', daysAgo: 16 },
                { delta: -18, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Tastes like a cup of tea in the best way',
          body: 'The jasmine note is no joke. I brew it as a pour-over and it is the cleanest cup I have made at home.',
          authorPersona: 'amelia',
          response:
            'So glad it landed, Amelia — try it a touch cooler (200°F) to push the florals even further.',
          helpfulCount: 12,
          daysAgo: 16,
        },
        {
          rating: 5,
          title: 'Freshness you can taste',
          body: 'Roast date was four days before it arrived. Night and day versus grocery-store bags.',
          authorPersona: 'nadia',
          helpfulCount: 6,
          daysAgo: 9,
        },
        {
          rating: 3,
          title: 'Lovely but light for me',
          body: 'Beautiful coffee, just brighter than I usually drink. My fault for not reading the roast level.',
          displayName: 'DarkRoastDan',
          status: 'pending',
          helpfulCount: 2,
          daysAgo: 2,
        },
      ],
      questions: [
        {
          body: 'Is the ground option fine enough for an AeroPress?',
          authorPersona: 'desmond',
          answer:
            'Our standard grind is a medium suited to drip and pour-over. For AeroPress it works, but for espresso or Turkish we recommend whole bean and grinding to taste.',
          daysAgo: 11,
        },
        {
          body: 'Is this decaf available?',
          displayName: 'EveningSipper',
          status: 'pending',
          daysAgo: 3,
        },
      ],
    },
    {
      key: 'coffee-colombia',
      title: 'Single-Origin Colombia Huila',
      handle: 'single-origin-colombia-huila',
      description:
        '<p>A crowd-pleasing washed Colombia from smallholder farms around Pitalito, Huila, roasted medium for balance. Caramel sweetness, a round red-apple acidity, and a cocoa finish make it the everyday bag that works in any brewer — drip, French press, or espresso.</p><p>If you keep one coffee in the house, this is it. Forgiving to brew, equally good black or with a splash of milk, and roasted in small batches so every bag ships fresh.</p>',
      productType: 'Coffee',
      vendor: 'Ridgeline Roasters',
      tags: ['coffee', 'single-origin', 'colombia', 'medium-roast', 'whole-bean'],
      seoTitle: 'Colombia Huila Single-Origin Coffee — Medium Roast',
      seoDescription:
        'Balanced, caramel-sweet washed Colombia roasted medium for any brewer. Whole bean or ground.',
      categoryKeys: ['coffee-tea'],
      collectionKeys: ['best-sellers'],
      options: [
        {
          name: 'Grind',
          displayType: 'segmented',
          values: [{ value: 'Whole bean' }, { value: 'Ground' }],
        },
      ],
      variants: [
        {
          key: 'COF-COL-WB-12',
          sku: 'COF-COL-WB-12',
          title: 'Whole bean — 12 oz',
          priceCents: 1699,
          costCents: 740,
          optionValues: ['Whole bean'],
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 10,
              movements: [
                { delta: 140, reason: 'receive', daysAgo: 20 },
                { delta: -22, reason: 'sale', daysAgo: 9 },
                { delta: -16, reason: 'sale', daysAgo: 4 },
              ],
            },
            {
              warehouseKey: 'EAST',
              reorderPoint: 16,
              reorderQuantity: 64,
              movements: [
                { delta: 64, reason: 'receive', daysAgo: 17 },
                { delta: -12, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
        {
          key: 'COF-COL-GR-12',
          sku: 'COF-COL-GR-12',
          title: 'Ground — 12 oz',
          priceCents: 1699,
          costCents: 740,
          optionValues: ['Ground'],
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 16,
              reorderQuantity: 48,
              leadTimeDays: 10,
              movements: [
                { delta: 72, reason: 'receive', daysAgo: 19 },
                { delta: -20, reason: 'sale', daysAgo: 7 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'My new house coffee',
          body: 'Subscribed after one bag. Sweet, easy, never bitter even when I oversteep the press.',
          authorPersona: 'theo',
          helpfulCount: 8,
          daysAgo: 14,
        },
        {
          rating: 4,
          title: 'Reliable and smooth',
          body: 'Exactly the caramel-and-cocoa profile described. Knocked one star only because I wish it came in 2 lb.',
          authorPersona: 'walt',
          response:
            'Good news — the 2 lb size is on the way for the espresso blend, and Colombia is next!',
          helpfulCount: 5,
          daysAgo: 8,
        },
      ],
      questions: [
        {
          body: 'Will this work for espresso or is it too light?',
          authorPersona: 'lucia',
          answer:
            'It pulls a lovely shot — medium roast and forgiving. Dial in around an 18 g dose for a 36 g out in roughly 28 seconds and adjust to taste.',
          daysAgo: 10,
        },
      ],
    },
    {
      key: 'espresso-blend',
      title: 'House Espresso Blend — "Lamplight"',
      handle: 'house-espresso-blend-lamplight',
      description:
        '<p>Our signature espresso blend: a Brazil-and-Guatemala base for body and chocolate, lifted with a touch of washed Ethiopian for sparkle. Roasted medium-dark to pull thick, syrupy shots with notes of dark chocolate, toasted almond, and a brown-sugar sweetness that cuts beautifully through milk.</p><p>Built for the home espresso machine but every bit as good in a moka pot or press. Give it three to five days off the roast to degas before you pull your first shot.</p>',
      productType: 'Coffee',
      vendor: 'Ridgeline Roasters',
      tags: ['coffee', 'espresso', 'blend', 'medium-dark', 'whole-bean'],
      seoTitle: 'House Espresso Blend "Lamplight" — Medium-Dark Roast',
      seoDescription:
        'A chocolate-forward espresso blend that shines with milk. Whole bean, 12 oz or 2 lb.',
      categoryKeys: ['coffee-tea'],
      collectionKeys: ['best-sellers', 'giftable'],
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: '12 oz' }, { value: '2 lb' }],
        },
      ],
      variants: [
        {
          key: 'COF-ESP-WB-12',
          sku: 'COF-ESP-WB-12',
          title: 'Whole bean — 12 oz',
          priceCents: 1799,
          costCents: 760,
          optionValues: ['12 oz'],
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 10,
              movements: [
                { delta: 160, reason: 'receive', daysAgo: 22 },
                { delta: -28, reason: 'sale', daysAgo: 10 },
                { delta: -19, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          key: 'COF-ESP-WB-2LB',
          sku: 'COF-ESP-WB-2LB',
          title: 'Whole bean — 2 lb',
          priceCents: 4299,
          compareAtPriceCents: 4796,
          costCents: 1980,
          optionValues: ['2 lb'],
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 12,
              reorderQuantity: 48,
              leadTimeDays: 10,
              movements: [
                { delta: 48, reason: 'receive', daysAgo: 21 },
                { delta: -9, reason: 'sale', daysAgo: 6 },
                { delta: -4, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Cuts through milk perfectly',
          body: 'Pulls a gorgeous shot and the chocolate sings in a flat white. The 2 lb bag is the move if you have a machine.',
          authorPersona: 'lucia',
          response: 'Thanks Lucia! Glad the 2 lb is treating you right.',
          helpfulCount: 10,
          daysAgo: 13,
        },
        {
          rating: 5,
          title: 'Consistent crema',
          body: 'Easy to dial in and stays sweet shot after shot. Has become my daily.',
          authorPersona: 'desmond',
          helpfulCount: 4,
          daysAgo: 6,
        },
        {
          rating: 2,
          title: 'Bag arrived split',
          body: 'Coffee itself is great but the valve seam on my bag had split in transit and some beans spilled.',
          displayName: 'BaristaBeck',
          status: 'flagged',
          response:
            "So sorry about the bag — we have shipped a replacement and re-checked that lot's sealer.",
          helpfulCount: 1,
          daysAgo: 4,
        },
      ],
      questions: [
        {
          body: 'How long should I let it rest before pulling shots?',
          authorPersona: 'lucia',
          answer:
            'Three to five days off the roast date is the sweet spot — fresh enough for flavor, rested enough that it is not too gassy to dial in.',
          daysAgo: 9,
        },
      ],
    },
    {
      key: 'tea-earl-grey',
      title: 'Loose-Leaf Earl Grey Supreme',
      handle: 'loose-leaf-earl-grey-supreme',
      description:
        '<p>A proper Earl Grey: a brisk Ceylon-and-Assam black tea base scented with natural bergamot oil and finished with a scatter of blue cornflower petals. Bold enough to take milk, fragrant enough to drink straight with a twist of lemon. No artificial flavoring — just real oil of bergamot.</p><p>Sold loose by weight in a resealable tin-tie pouch. One heaping teaspoon per cup, steeped 3 to 4 minutes in just-off-boil water.</p>',
      productType: 'Tea',
      vendor: 'Harbor & Vine Tea Co.',
      tags: ['tea', 'loose-leaf', 'earl-grey', 'black-tea', 'bergamot'],
      seoTitle: 'Loose-Leaf Earl Grey Supreme — Bergamot Black Tea',
      seoDescription:
        'A brisk Ceylon-Assam Earl Grey scented with real bergamot oil and cornflower. Loose leaf, 4 oz.',
      categoryKeys: ['coffee-tea'],
      collectionKeys: ['giftable'],
      variants: [
        {
          key: 'TEA-EG-4',
          sku: 'TEA-EG-4',
          title: '4 oz pouch',
          priceCents: 1399,
          costCents: 560,
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 18,
              reorderQuantity: 60,
              leadTimeDays: 12,
              movements: [
                { delta: 80, reason: 'receive', daysAgo: 26 },
                { delta: -15, reason: 'sale', daysAgo: 11 },
                { delta: -6, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'The real bergamot makes the difference',
          body: 'You can smell the difference the moment you open the pouch. Floral, not soapy like the bagged stuff.',
          authorPersona: 'nadia',
          helpfulCount: 7,
          daysAgo: 17,
        },
        {
          rating: 4,
          title: 'Lovely afternoon cup',
          body: 'Brisk and aromatic. I get three good steeps out of a spoonful.',
          displayName: 'TeaAtThree',
          helpfulCount: 3,
          daysAgo: 8,
        },
      ],
      questions: [
        {
          body: 'Does this have caffeine?',
          displayName: 'NightOwl',
          answer:
            'Yes — it is a black tea base, so it is fully caffeinated. For evenings, steep it a minute shorter or pick one of our herbal tisanes.',
          daysAgo: 7,
        },
      ],
    },
    {
      key: 'hot-sauce-habanero',
      title: 'Small-Batch Habanero-Mango Hot Sauce',
      handle: 'small-batch-habanero-mango-hot-sauce',
      description:
        "<p>A bright, fruit-forward hot sauce that leads with ripe mango and ends with a clean habanero burn. Fermented in small batches for a week before bottling, which rounds the heat and builds a tangy depth you don't get from a quick-blend sauce. Medium-hot: enough to make you notice, never enough to ruin the dish.</p><p>Spectacular on tacos, grilled chicken, eggs, and — trust us — a wedge of sharp cheddar. Five ounces in a glass bottle with a drip-control cap.</p>",
      productType: 'Condiment',
      vendor: 'Ember Lane Provisions',
      tags: ['hot-sauce', 'habanero', 'mango', 'fermented', 'small-batch'],
      seoTitle: 'Habanero-Mango Hot Sauce — Small-Batch Fermented',
      seoDescription:
        'A fruit-forward, fermented habanero-mango hot sauce. Medium heat, bright and tangy. 5 oz.',
      categoryKeys: ['pantry'],
      collectionKeys: ['new-season'],
      variants: [
        {
          key: 'HS-HABMANGO-5',
          sku: 'HS-HABMANGO-5',
          title: '5 oz bottle',
          priceCents: 1099,
          costCents: 410,
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 24,
              reorderQuantity: 96,
              leadTimeDays: 14,
              movements: [
                { delta: 96, reason: 'receive', daysAgo: 24 },
                { delta: -21, reason: 'sale', daysAgo: 12 },
                { delta: -13, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'On everything now',
          body: 'The mango up front then the heat builds — perfect on fish tacos. Already on my second bottle.',
          authorPersona: 'walt',
          response: 'Try it on grilled pineapple next, Walter. Game changer.',
          helpfulCount: 9,
          daysAgo: 15,
        },
        {
          rating: 4,
          title: 'Great flavor, wish it were hotter',
          body: 'Delicious and balanced. Heat-seekers may find it medium, but the flavor is the star here.',
          authorPersona: 'desmond',
          helpfulCount: 4,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Does it need to be refrigerated after opening?',
          authorPersona: 'amelia',
          answer:
            'We recommend refrigerating after opening to keep the fresh fruit flavor at its peak, though the vinegar and ferment make it shelf-stable for a while.',
          daysAgo: 9,
        },
      ],
    },
    {
      key: 'granola-maple',
      title: 'Maple-Pecan Grain-Free Granola',
      handle: 'maple-pecan-grain-free-granola',
      description:
        "<p>A clustery, grain-free granola built on almonds, pecans, coconut, and pumpkin seeds, bound with real maple syrup and a whisper of sea salt. Baked low and slow for big, crunchy clusters that hold up in milk or yogurt instead of dissolving into dust. No oats, no refined sugar, no filler.</p><p>Twelve ounces in a resealable pouch. Wonderful over Greek yogurt with fresh berries, or eaten by the handful straight from the bag (we won't tell).</p>",
      productType: 'Snack',
      vendor: 'Wildflour Kitchen',
      tags: ['granola', 'grain-free', 'maple', 'pecan', 'breakfast', 'snack'],
      seoTitle: 'Maple-Pecan Grain-Free Granola — No Oats, No Refined Sugar',
      seoDescription:
        'Clustery grain-free granola of almonds, pecans, and coconut, sweetened with real maple. 12 oz.',
      categoryKeys: ['snacks'],
      collectionKeys: ['best-sellers', 'giftable'],
      variants: [
        {
          key: 'GRAN-MAPLE-12',
          sku: 'GRAN-MAPLE-12',
          title: '12 oz pouch',
          priceCents: 1299,
          costCents: 520,
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 20,
              reorderQuantity: 72,
              leadTimeDays: 8,
              movements: [
                { delta: 90, reason: 'receive', daysAgo: 14 },
                { delta: -19, reason: 'sale', daysAgo: 7 },
                { delta: -11, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Actual clusters!',
          body: 'So many granolas are sand in a bag. These clusters are huge and stay crunchy in almond milk.',
          authorPersona: 'amelia',
          helpfulCount: 11,
          daysAgo: 13,
        },
        {
          rating: 5,
          title: 'Grain-free that tastes good',
          body: 'Bought it for the no-oats angle, stayed for the maple-pecan flavor. My kids fight over it.',
          authorPersona: 'theo',
          helpfulCount: 5,
          daysAgo: 6,
        },
        {
          rating: 4,
          title: 'A touch sweet',
          body: 'Excellent texture. Maple comes through strong — a hair sweet for me but great over plain yogurt.',
          displayName: 'MorningRunner',
          status: 'pending',
          helpfulCount: 2,
          daysAgo: 2,
        },
      ],
      questions: [
        {
          body: 'Is this nut-free safe? Allergy in the house.',
          displayName: 'CarefulMom',
          answer:
            'No — this granola contains almonds and pecans and is made in a facility that handles tree nuts, so it is not suitable for nut allergies.',
          daysAgo: 10,
        },
      ],
    },
    {
      key: 'olive-oil-evoo',
      title: 'Extra-Virgin Olive Oil — Cold-Pressed',
      handle: 'extra-virgin-olive-oil-cold-pressed',
      description:
        '<p>A single-estate, cold-pressed extra-virgin olive oil from a family grove in Jaén, Spain, pressed within hours of harvest. Grassy and peppery with a green-almond finish and the throat-catching tickle that tells you the polyphenols are alive. Harvest date — not just a "best by" — is stamped on every tin.</p><p>500 ml in a light-blocking tin to protect it from oxidation. Finish soups, dress salads, or pour over warm bread; save the neutral oil for the frying pan.</p>',
      productType: 'Oil',
      vendor: 'Olivar del Sol',
      tags: ['olive-oil', 'extra-virgin', 'cold-pressed', 'spain', 'pantry'],
      seoTitle: 'Cold-Pressed Extra-Virgin Olive Oil — Single-Estate Spain',
      seoDescription:
        'Grassy, peppery single-estate EVOO from Jaén, cold-pressed and harvest-dated. 500 ml tin.',
      categoryKeys: ['oils-vinegars', 'pantry'],
      collectionKeys: ['giftable', 'new-season'],
      variants: [
        {
          key: 'OOIL-EVOO-500',
          sku: 'OOIL-EVOO-500',
          title: '500 ml tin',
          priceCents: 2499,
          costCents: 1180,
          stock: [
            {
              warehouseKey: 'EAST',
              reorderPoint: 16,
              reorderQuantity: 60,
              leadTimeDays: 21,
              movements: [
                { delta: 84, reason: 'receive', daysAgo: 30 },
                { delta: -14, reason: 'sale', daysAgo: 12 },
                { delta: -8, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Peppery and alive',
          body: 'That little throat tickle means it is the real deal. Best finishing oil I have bought in years.',
          authorPersona: 'nadia',
          response:
            'Right on — that pungency is the polyphenols. Thanks for noticing the harvest date too!',
          helpfulCount: 8,
          daysAgo: 18,
        },
        {
          rating: 5,
          title: 'Bread and oil, done',
          body: 'A little flaky salt and this oil on warm sourdough. That is dinner some nights.',
          authorPersona: 'lucia',
          helpfulCount: 3,
          daysAgo: 9,
        },
      ],
      questions: [
        {
          body: 'Can I cook with this or is it only for finishing?',
          displayName: 'HomeCook22',
          answer:
            'You can sauté with it, but its real magic is raw — drizzled to finish — where the flavor and polyphenols survive. For high-heat frying use a neutral oil.',
          daysAgo: 11,
        },
      ],
    },
    {
      key: 'honey-raw',
      title: 'Raw Wildflower Honey',
      handle: 'raw-wildflower-honey',
      description:
        "<p>Unfiltered, unpasteurized wildflower honey from hives in the Willamette Valley, bottled raw to keep its pollen, enzymes, and complex floral character intact. Amber and thick with a layered sweetness that shifts with the season's blooms — clover one batch, blackberry the next. It may crystallize over time; that is the mark of real raw honey, not a flaw.</p><p>Twelve ounces in a glass jar. Stir into tea, drizzle over the granola, or spoon onto a cheese board. Not for infants under one year.</p>",
      productType: 'Sweetener',
      vendor: 'Willamette Apiaries',
      tags: ['honey', 'raw', 'wildflower', 'unfiltered', 'pantry'],
      seoTitle: 'Raw Wildflower Honey — Unfiltered & Unpasteurized',
      seoDescription:
        'Raw, unfiltered wildflower honey from the Willamette Valley with pollen and enzymes intact. 12 oz jar.',
      categoryKeys: ['pantry', 'sweets'],
      collectionKeys: ['giftable', 'best-sellers'],
      variants: [
        {
          key: 'HON-WILD-12',
          sku: 'HON-WILD-12',
          title: '12 oz jar',
          priceCents: 1499,
          costCents: 620,
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 24,
              reorderQuantity: 96,
              leadTimeDays: 9,
              movements: [
                { delta: 110, reason: 'receive', daysAgo: 23 },
                { delta: -24, reason: 'sale', daysAgo: 10 },
                { delta: -15, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Tastes like the season',
          body: 'You can actually taste the blackberry batch differently from the clover one. Magical in tea.',
          authorPersona: 'theo',
          helpfulCount: 6,
          daysAgo: 16,
        },
        {
          rating: 5,
          title: 'Crystallized and I love it',
          body: 'Went grainy after a month, which someone explained means it is the real raw deal. Warm-water bath and it is liquid again.',
          authorPersona: 'walt',
          helpfulCount: 4,
          daysAgo: 8,
        },
      ],
      questions: [
        {
          body: 'Why did my jar go solid and cloudy?',
          authorPersona: 'amelia',
          answer:
            'That is natural crystallization — a hallmark of raw, unfiltered honey. Set the jar in a bowl of warm (not hot) water and it returns to liquid without harming the enzymes.',
          daysAgo: 12,
        },
      ],
    },
    {
      key: 'chocolate-dark',
      title: 'Single-Origin Dark Chocolate Bar — 72%',
      handle: 'single-origin-dark-chocolate-bar-72',
      description:
        '<p>A bean-to-bar 72% dark chocolate made from single-origin Ecuadorian Nacional cacao, stone-ground and conched for three days for a silken snap and a clean finish. Tasting notes of dried cherry, toasted hazelnut, and a faint floral lift — only three ingredients: cacao, cane sugar, and cocoa butter.</p><p>A generous 2.5 oz bar, hand-wrapped. Let a square melt slowly on the tongue rather than chewing to catch the full arc of flavor.</p>',
      productType: 'Chocolate',
      vendor: 'Cobblestone Chocolate Works',
      tags: ['chocolate', 'dark', 'single-origin', 'bean-to-bar', 'ecuador', 'sweets'],
      seoTitle: 'Single-Origin 72% Dark Chocolate Bar — Bean-to-Bar Ecuador',
      seoDescription:
        'A bean-to-bar 72% dark chocolate from Ecuadorian Nacional cacao. Three ingredients, 2.5 oz.',
      categoryKeys: ['sweets'],
      collectionKeys: ['giftable', 'new-season'],
      variants: [
        {
          key: 'CHOC-DARK-72',
          sku: 'CHOC-DARK-72',
          title: '2.5 oz bar',
          priceCents: 799,
          costCents: 300,
          stock: [
            {
              warehouseKey: 'ROAST',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 15,
              movements: [
                { delta: 140, reason: 'receive', daysAgo: 19 },
                { delta: -31, reason: 'sale', daysAgo: 9 },
                { delta: -18, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Cherry note is real',
          body: 'Let it melt and the dried-cherry note blooms. Three ingredients and it tastes like ten.',
          authorPersona: 'nadia',
          helpfulCount: 7,
          daysAgo: 14,
        },
        {
          rating: 4,
          title: 'Excellent, melts fast',
          body: 'Beautiful snap and flavor. Arrived a little soft in summer heat — maybe a cold pack next time.',
          authorPersona: 'desmond',
          response:
            'Noted — we add insulated packaging and cold packs on hot-weather routes. Sorry it caught a warm spell!',
          helpfulCount: 3,
          daysAgo: 6,
        },
      ],
      questions: [
        {
          body: 'Is this dairy-free?',
          authorPersona: 'lucia',
          answer:
            'Yes — the bar is just cacao, cane sugar, and cocoa butter, so it is dairy-free. It is made in a facility that also handles tree nuts and milk, however.',
          daysAgo: 8,
        },
      ],
    },
    {
      key: 'gift-box-morning',
      title: 'Morning Ritual Gift Box',
      handle: 'morning-ritual-gift-box',
      description:
        '<p>The cure for "I don\'t know what to get them." Our Morning Ritual gift box pairs a bag of fresh single-origin coffee, a pouch of clustery maple-pecan granola, and a jar of raw wildflower honey in a kraft box with a hand-tied ribbon and a card you can personalize at checkout.</p><p>It is the breakfast we\'d want delivered to our own door — and it saves versus buying the three pieces on their own. Ships in protective packaging with everything dated fresh.</p>',
      productType: 'Gift Box',
      vendor: 'Ridgeline Roasters',
      tags: ['gift', 'gift-box', 'bundle', 'coffee', 'breakfast'],
      seoTitle: 'Morning Ritual Gift Box — Coffee, Granola & Honey',
      seoDescription:
        'A curated breakfast gift box: fresh single-origin coffee, maple-pecan granola, and raw wildflower honey.',
      categoryKeys: ['pantry'],
      collectionKeys: ['giftable'],
      variants: [
        {
          key: 'GIFT-MORNING',
          sku: 'GIFT-MORNING',
          title: null,
          priceCents: 4499,
          costCents: 1960,
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Perfect host gift',
          body: 'Sent this to my parents and they raved. The presentation is genuinely lovely, not an afterthought box.',
          authorPersona: 'walt',
          helpfulCount: 9,
          daysAgo: 12,
        },
        {
          rating: 5,
          title: 'Gifted three already',
          body: 'My go-to now for new-baby and housewarming gifts. The card personalization is a nice touch.',
          authorPersona: 'amelia',
          response: 'Thank you, Amelia — we love being your go-to gift!',
          helpfulCount: 4,
          daysAgo: 5,
        },
      ],
      questions: [
        {
          body: 'Can I choose which coffee goes in the box?',
          authorPersona: 'theo',
          answer:
            'Yes — use the gift-box builder to pick your coffee, a sweet, and an extra. By default it ships with our Colombia Huila, granola, and honey.',
          daysAgo: 9,
        },
      ],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'gift-box-morning',
      pricing: { mode: 'percent', percentOff: 10 },
      inventoryMode: 'components',
      components: [
        { productKey: 'coffee-colombia', quantity: 1, required: true, swappable: true },
        { productKey: 'granola-maple', quantity: 1, required: true },
        { productKey: 'honey-raw', quantity: 1, required: true },
      ],
    },
  ],

  configurator: {
    productKey: 'gift-box-morning',
    name: 'Build your gift box',
    options: [
      {
        key: 'coffee',
        label: 'Choose your coffee',
        inputType: 'single',
        choices: [
          { value: 'colombia', label: 'Colombia Huila (medium)', isDefault: true },
          { value: 'ethiopia', label: 'Ethiopia Yirgacheffe (light)' },
          { value: 'espresso', label: 'Lamplight Espresso Blend', priceDeltaCents: 100 },
        ],
      },
      {
        key: 'sweet',
        label: 'Pick a sweet',
        inputType: 'single',
        choices: [
          { value: 'honey', label: 'Raw wildflower honey', isDefault: true },
          { value: 'chocolate', label: '72% dark chocolate bar' },
        ],
      },
      {
        key: 'extra',
        label: 'Add an extra',
        inputType: 'toggle',
        choices: [
          { value: 'none', label: 'No extra', isDefault: true },
          { value: 'chocolate', label: 'Add a dark chocolate bar (+$7)', priceDeltaCents: 700 },
        ],
      },
    ],
    addOns: [{ variantKey: 'CHOC-DARK-72', defaultIncluded: false, priceOverrideCents: 699 }],
  },

  articles: [
    {
      slug: 'perfect-pour-over',
      title: 'How to brew the perfect pour-over at home',
      excerpt:
        'Five minutes, a paper filter, and a kitchen scale stand between you and the best cup you have made.',
      daysAgo: 4,
      body: doc(
        p(
          'A pour-over is the most forgiving way to make a stunning cup of coffee at home, because it puts every variable in your hands — and once you nail the rhythm, it is the same five minutes every morning. You need a cone dripper, a paper filter, a gooseneck kettle if you have one, and a scale.'
        ),
        h2('The recipe'),
        p(
          'Aim for a 1-to-16 ratio of coffee to water. A great starting point is 22 grams of coffee to 350 grams of water.'
        ),
        ol(
          'Boil your water and let it rest 30 seconds — you want about 200°F, just off the boil.',
          'Rinse the paper filter with hot water, then dump the rinse water; this kills the papery taste and warms the cup.',
          'Grind 22 g of coffee to a medium, table-salt texture and add it to the filter.',
          'Pour just enough water (about 50 g) to wet all the grounds and let it bloom for 30 to 45 seconds.',
          'Pour the rest in slow, steady spirals, keeping the bed level, until you reach 350 g total.',
          'The whole draw-down should finish around 3 to 3.5 minutes. Swirl, serve, and adjust next time.'
        ),
        h2('Dial it in'),
        ul(
          'Tastes sour or thin? Grind finer or pour a touch slower.',
          'Tastes bitter or harsh? Grind coarser or use slightly cooler water.',
          'Always start from fresh, recently roasted beans — no recipe rescues stale coffee.'
        ),
        p(
          'Change one variable at a time and taste as you go. Within a week you will have a recipe dialed to your beans and your palate.'
        )
      ),
    },
    {
      slug: 'storing-coffee-for-freshness',
      title: 'Storing coffee for freshness: what actually matters',
      excerpt:
        'The fridge is a myth and the freezer is misunderstood. Here is how to keep your beans tasting like the roast date.',
      daysAgo: 11,
      body: doc(
        p(
          'Coffee has four enemies: air, moisture, heat, and light. Every storage decision comes down to keeping those four away from your beans. Get that right and a bag stays vibrant for weeks; get it wrong and great coffee tastes flat in days.'
        ),
        h2('The everyday rules'),
        ul(
          'Buy whole bean and grind right before brewing — ground coffee goes stale in hours, not weeks.',
          'Keep beans in an airtight, opaque container at room temperature, away from the stove and the window.',
          'Never store coffee in the fridge — it is humid and full of odors the beans will happily absorb.',
          'Buy only what you will drink in two to three weeks so you are always near the roast date.'
        ),
        h2('What about the freezer?'),
        p(
          'For long-term storage, the freezer works — but only if you do it right. Portion beans into airtight, single-use bags, freeze them, and pull a bag out as you need it. The cardinal rule: never re-freeze. Each thaw cycle drives condensation into the beans, and moisture is the enemy. Let a frozen portion come fully to room temperature before opening the bag.'
        ),
        p(
          'Stored well at room temperature, treat a bag as best within three to four weeks of its roast date.'
        )
      ),
    },
    {
      slug: 'honey-glazed-carrots-recipe',
      title: 'Recipe: honey-glazed roasted carrots',
      excerpt:
        'A four-ingredient side that turns a jar of raw wildflower honey into the best thing on the table.',
      daysAgo: 19,
      body: doc(
        p(
          "This is the side dish we make when we want maximum payoff for minimum effort. Roasting concentrates the carrots' natural sugar; a glaze of raw honey and good olive oil does the rest. It takes one sheet pan and about half an hour."
        ),
        h2('You will need'),
        ul(
          '1.5 lb carrots, scrubbed and halved lengthwise',
          '2 tablespoons extra-virgin olive oil',
          '2 tablespoons raw wildflower honey',
          'Flaky sea salt, black pepper, and a squeeze of lemon to finish'
        ),
        h2('Method'),
        ol(
          'Heat your oven to 425°F and line a sheet pan.',
          'Toss the carrots with the olive oil, a big pinch of salt, and pepper, then spread them in a single layer.',
          'Roast 20 minutes, until the edges start to caramelize and a knife slides in easily.',
          'Drizzle the honey over the hot carrots, toss, and roast 5 more minutes so the glaze sets without burning.',
          'Finish with flaky salt and a squeeze of lemon, and serve warm.'
        ),
        p(
          'A handful of toasted pecans or a scatter of fresh thyme takes it further, but it needs nothing — the honey and the carrots do all the work.'
        )
      ),
    },
  ],
};
