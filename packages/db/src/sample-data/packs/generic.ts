// Generic sample pack — the NO-INDUSTRY FALLBACK. `resolveSamplePack` loads this
// for any tenant whose `settings.industry` has no specific pack authored yet, so
// every tenant gets a real, cross-module "Load sample data" experience out of the
// box. Deliberately lighter than the vertical packs — neutral, brandable merch
// that fits any business — but still real: stocked catalog, retail customers,
// orders, reviews, Q&A, a starter bundle, and a friendly getting-started guide.

import { doc, h2, ol, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const genericPack: SampleDataPack = {
  industry: 'generic',
  label: 'Generic starter',
  summary:
    'A neutral starter catalog and activity for any business — products, customers, orders, reviews, and a getting-started guide.',

  warehouses: [
    {
      key: 'MAIN',
      code: 'MAIN',
      name: 'Main Warehouse',
      type: 'owned',
      city: 'Columbus',
      region: 'OH',
    },
  ],

  suppliers: [
    {
      code: 'HOUSE',
      name: 'House Goods Supply',
      paymentTerms: 'net30',
      leadTimeDays: 10,
      city: 'Grand Rapids',
      region: 'MI',
      variantKeys: ['NB-A5-RULED', 'NB-A5-DOTTED', 'MUG-12-WHITE', 'MUG-12-BLACK', 'BOT-20-STEEL'],
    },
  ],

  categories: [
    { key: 'stationery', name: 'Stationery', handle: 'stationery' },
    { key: 'drinkware', name: 'Drinkware', handle: 'drinkware' },
    { key: 'accessories', name: 'Accessories', handle: 'accessories' },
  ],

  collections: [
    { key: 'featured', name: 'Featured', handle: 'featured', featured: true },
    { key: 'new-arrivals', name: 'New Arrivals', handle: 'new-arrivals' },
  ],

  personas: [
    {
      key: 'avery',
      name: 'Avery Sloane',
      email: 'avery.sloane',
      phone: '+1-503-555-0148',
      line1: '2210 Hawthorne Blvd',
      city: 'Portland',
      region: 'OR',
      postalCode: '97214',
    },
    {
      key: 'noah',
      name: 'Noah Castellano',
      email: 'noah.castellano',
      phone: '+1-312-555-0192',
      line1: '845 W Madison St',
      city: 'Chicago',
      region: 'IL',
      postalCode: '60607',
    },
    {
      key: 'imani',
      name: 'Imani Okafor',
      email: 'imani.okafor',
      phone: '+1-404-555-0137',
      line1: '1190 Peachtree St NE',
      city: 'Atlanta',
      region: 'GA',
      postalCode: '30309',
    },
    {
      key: 'leo',
      name: 'Leo Park',
      email: 'leo.park',
      phone: '+1-617-555-0165',
      line1: '57 Brattle St',
      city: 'Cambridge',
      region: 'MA',
      postalCode: '02138',
    },
    {
      key: 'maya',
      name: 'Maya Behrens',
      email: 'maya.behrens',
      phone: '+1-720-555-0179',
      line1: '3344 Tennyson St',
      city: 'Denver',
      region: 'CO',
      postalCode: '80212',
    },
  ],

  products: [
    {
      key: 'classic-notebook',
      title: 'Classic Notebook',
      handle: 'classic-notebook',
      description:
        '<p>A clean, hardcover A5 notebook that works as well in a meeting as it does on a coffee shop table. The lay-flat binding means it stays open while you write, and the 120gsm paper takes fountain pen, gel, and ballpoint without bleeding through.</p><p>192 pages, an elastic closure, a ribbon bookmark, and a back pocket for loose notes and cards. Pick ruled for everyday writing or dotted for sketches, bullet journaling, and planning.</p>',
      productType: 'Stationery',
      vendor: 'House Goods',
      tags: ['notebook', 'stationery', 'a5', 'everyday'],
      seoTitle: 'Classic A5 Hardcover Notebook',
      seoDescription:
        'A lay-flat A5 hardcover notebook with 120gsm paper, elastic closure, and a ribbon bookmark. Ruled or dotted.',
      categoryKeys: ['stationery'],
      collectionKeys: ['featured'],
      variants: [
        {
          sku: 'NB-A5-RULED',
          title: 'Ruled',
          priceCents: 1495,
          costCents: 640,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 10,
              movements: [
                { delta: 150, reason: 'receive', daysAgo: 26 },
                { delta: -22, reason: 'sale', daysAgo: 11 },
                { delta: -14, reason: 'sale', daysAgo: 4 },
                { delta: -2, reason: 'recount', daysAgo: 1 },
              ],
            },
          ],
        },
        {
          sku: 'NB-A5-DOTTED',
          title: 'Dotted',
          priceCents: 1495,
          costCents: 640,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 10,
              movements: [
                { delta: 130, reason: 'receive', daysAgo: 26 },
                { delta: -18, reason: 'sale', daysAgo: 9 },
                { delta: -11, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'My everyday notebook now',
          body: 'Paper is genuinely good — no bleed-through with my fountain pen. The lay-flat binding is the real win.',
          authorPersona: 'avery',
          response: 'So glad it found a spot on your desk, Avery — thank you!',
          helpfulCount: 6,
          daysAgo: 18,
        },
        {
          rating: 4,
          title: 'Great, wish it had more pages',
          body: 'Lovely little notebook and the dotted layout is perfect for planning. Fills up faster than I expected.',
          authorPersona: 'leo',
          helpfulCount: 3,
          daysAgo: 9,
        },
        {
          rating: 5,
          title: '',
          body: 'Bought three. The back pocket is more useful than it sounds.',
          displayName: 'PlannerPete',
          helpfulCount: 1,
          daysAgo: 4,
        },
      ],
      questions: [
        {
          body: 'Does the dotted version have page numbers?',
          authorPersona: 'maya',
          answer:
            'It does — every page is numbered in the bottom corner, plus there are two index pages up front.',
          daysAgo: 12,
        },
        {
          body: 'Will a regular ballpoint show through?',
          displayName: 'CuriousCarl',
          status: 'pending',
          daysAgo: 2,
        },
      ],
    },
    {
      key: 'ceramic-mug',
      title: 'Ceramic Mug',
      handle: 'ceramic-mug',
      description:
        '<p>A satisfyingly heavy 12oz stoneware mug with a comfortable handle and a glaze that holds its color through years of dishwasher cycles. The slightly wider base keeps it stable on a busy desk.</p><p>Microwave- and dishwasher-safe. Sold in classic white or matte black — both look great with a logo or left clean.</p>',
      productType: 'Drinkware',
      vendor: 'House Goods',
      tags: ['mug', 'drinkware', 'ceramic', 'coffee'],
      seoTitle: '12oz Ceramic Stoneware Mug',
      seoDescription:
        'A 12oz stoneware mug with a comfy handle and a durable glaze. Dishwasher- and microwave-safe. White or black.',
      categoryKeys: ['drinkware'],
      collectionKeys: ['featured', 'new-arrivals'],
      options: [
        {
          name: 'Color',
          displayType: 'swatch',
          values: [
            { value: 'White', swatchHex: '#F5F5F4' },
            { value: 'Black', swatchHex: '#1C1917' },
          ],
        },
      ],
      variants: [
        {
          sku: 'MUG-12-WHITE',
          title: 'White',
          optionValues: ['White'],
          priceCents: 1299,
          costCents: 520,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 40,
              reorderQuantity: 160,
              leadTimeDays: 10,
              movements: [
                { delta: 180, reason: 'receive', daysAgo: 22 },
                { delta: -34, reason: 'sale', daysAgo: 8 },
                { delta: -19, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
        {
          sku: 'MUG-12-BLACK',
          title: 'Black',
          optionValues: ['Black'],
          priceCents: 1299,
          costCents: 520,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 40,
              reorderQuantity: 160,
              leadTimeDays: 10,
              movements: [
                { delta: 160, reason: 'receive', daysAgo: 22 },
                { delta: -28, reason: 'sale', daysAgo: 7 },
                { delta: -12, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Heftier than it looks',
          body: 'Feels premium, keeps coffee warm a good while, and the handle actually fits my fingers. Black is a deep matte.',
          authorPersona: 'imani',
          helpfulCount: 5,
          daysAgo: 14,
        },
        {
          rating: 4,
          title: 'Good mug',
          body: 'Nice weight and the glaze has held up in the dishwasher. Took a couple days to arrive.',
          authorPersona: 'noah',
          helpfulCount: 2,
          daysAgo: 6,
        },
      ],
      questions: [
        {
          body: 'Is the white one bright white or more of a cream?',
          displayName: 'CoffeeFirst',
          answer: 'It is a clean, slightly warm white — not a stark bright white and not a cream.',
          daysAgo: 10,
        },
      ],
    },
    {
      key: 'canvas-tote',
      title: 'Canvas Tote Bag',
      handle: 'canvas-tote-bag',
      description:
        '<p>A sturdy 12oz cotton canvas tote built for actual hauling — groceries, books, a laptop, a beach day. Reinforced stitching at the strap joins where cheaper totes give out, and long 28" handles clear your shoulder.</p><p>Roomy main compartment with an interior slip pocket. Throw it in the wash when it needs it and it comes out looking lived-in, not worn out.</p>',
      productType: 'Accessories',
      vendor: 'House Goods',
      tags: ['tote', 'bag', 'canvas', 'reusable'],
      seoTitle: 'Heavy-Duty Canvas Tote Bag',
      seoDescription:
        'A 12oz cotton canvas tote with reinforced straps, a 28" drop, and an interior pocket. Built to actually carry things.',
      categoryKeys: ['accessories'],
      collectionKeys: ['featured'],
      variants: [
        {
          sku: 'TOTE-CANVAS',
          title: null,
          priceCents: 1899,
          costCents: 780,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 25,
              reorderQuantity: 100,
              leadTimeDays: 12,
              movements: [
                { delta: 110, reason: 'receive', daysAgo: 24 },
                { delta: -16, reason: 'sale', daysAgo: 10 },
                { delta: -9, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Finally a tote that holds up',
          body: 'Loaded it with a dozen library books and the straps did not budge. The interior pocket is great for keys.',
          authorPersona: 'maya',
          helpfulCount: 7,
          daysAgo: 16,
        },
        {
          rating: 4,
          title: 'Solid everyday bag',
          body: 'Thick canvas, roomy, washes well. I wish it came in a darker color too.',
          displayName: 'MarketRunner',
          helpfulCount: 2,
          daysAgo: 5,
        },
      ],
      questions: [
        {
          body: 'Does it stand up on its own when empty?',
          authorPersona: 'avery',
          answer:
            'Mostly — the heavy canvas holds its shape well, though it leans a bit until you put something in it.',
          daysAgo: 8,
        },
      ],
    },
    {
      key: 'sticker-pack',
      title: 'Sticker Pack',
      handle: 'sticker-pack',
      description:
        '<p>A set of ten die-cut vinyl stickers — waterproof, UV-resistant, and dishwasher-safe, so they survive water bottles, laptops, and notebooks without fading or peeling. Matte finish, no cheap glossy glare.</p><p>The easy way to add a little personality to anything flat. Peels clean if you ever change your mind.</p>',
      productType: 'Accessories',
      vendor: 'House Goods',
      tags: ['stickers', 'vinyl', 'accessories', 'fun'],
      seoTitle: 'Die-Cut Vinyl Sticker Pack (10)',
      seoDescription:
        'Ten waterproof, UV-resistant matte vinyl stickers. Survive bottles, laptops, and notebooks. Peel clean.',
      categoryKeys: ['accessories'],
      collectionKeys: ['new-arrivals'],
      variants: [
        {
          sku: 'STK-PACK-10',
          title: null,
          priceCents: 899,
          costCents: 280,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 50,
              reorderQuantity: 200,
              leadTimeDays: 8,
              movements: [
                { delta: 240, reason: 'receive', daysAgo: 19 },
                { delta: -41, reason: 'sale', daysAgo: 9 },
                { delta: -23, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Stuck through a whole semester',
          body: 'On my water bottle for months, through the dishwasher, still looks new. Great little impulse buy.',
          authorPersona: 'leo',
          helpfulCount: 4,
          daysAgo: 11,
        },
        {
          rating: 3,
          title: 'Cute but small',
          body: 'Quality is good, I just thought they would be a bit bigger from the photos.',
          displayName: 'StickerFan22',
          status: 'pending',
          helpfulCount: 1,
          daysAgo: 3,
        },
      ],
      questions: [],
    },
    {
      key: 'water-bottle',
      title: 'Insulated Water Bottle',
      handle: 'insulated-water-bottle',
      description:
        '<p>A 20oz double-wall vacuum-insulated stainless steel bottle that keeps drinks cold for 24 hours and hot for 12. The powder-coat finish resists fingerprints and chips, and the leakproof lid sips clean — no splash, no drip down the side.</p><p>Fits a standard cup holder, takes ice cubes through the wide mouth, and is built to live in a bag without leaking. Hand-wash to keep the finish its best.</p>',
      productType: 'Drinkware',
      vendor: 'House Goods',
      tags: ['water bottle', 'insulated', 'drinkware', 'stainless steel'],
      seoTitle: '20oz Insulated Stainless Steel Water Bottle',
      seoDescription:
        'A 20oz vacuum-insulated steel bottle — cold 24h, hot 12h — with a leakproof lid and a chip-resistant finish.',
      categoryKeys: ['drinkware'],
      collectionKeys: ['featured', 'new-arrivals'],
      variants: [
        {
          sku: 'BOT-20-STEEL',
          title: null,
          priceCents: 2499,
          costCents: 1080,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 12,
              movements: [
                { delta: 140, reason: 'receive', daysAgo: 23 },
                { delta: -27, reason: 'sale', daysAgo: 8 },
                { delta: -15, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Ice survives the whole day',
          body: 'Filled it with ice water in the morning, still had cubes at dinner. The lid genuinely does not leak in my bag.',
          authorPersona: 'imani',
          response: 'Love to hear it — thanks for the leakproof test, Imani!',
          helpfulCount: 8,
          daysAgo: 15,
        },
        {
          rating: 5,
          title: 'Better than the name brands',
          body: 'Same performance for less money. The matte finish hides fingerprints nicely.',
          authorPersona: 'noah',
          helpfulCount: 4,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Will it fit in a car cup holder?',
          displayName: 'CommuterCam',
          answer: 'Yes — the base is sized for a standard cup holder and sits in snugly.',
          daysAgo: 9,
        },
        {
          body: 'Is the lid dishwasher safe even if the bottle is hand-wash?',
          authorPersona: 'maya',
          status: 'pending',
          daysAgo: 1,
        },
      ],
    },
    {
      key: 'enamel-pin',
      title: 'Enamel Pin',
      handle: 'enamel-pin',
      description:
        '<p>A hard enamel pin with a polished metal finish and crisp, raised color fill — the good kind that feels like a keepsake, not a giveaway. Backed with a rubber clutch that actually holds, so it stays put on a jacket, bag, or lanyard.</p><p>About 1.25 inches, individually carded. A small, easy add-on that people genuinely keep.</p>',
      productType: 'Accessories',
      vendor: 'House Goods',
      tags: ['pin', 'enamel', 'accessories', 'gift'],
      seoTitle: 'Hard Enamel Pin',
      seoDescription:
        'A 1.25" hard enamel pin with polished metal, raised color fill, and a rubber clutch that holds.',
      categoryKeys: ['accessories'],
      collectionKeys: ['new-arrivals'],
      variants: [
        {
          sku: 'PIN-ENAMEL',
          title: null,
          priceCents: 999,
          costCents: 310,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 40,
              reorderQuantity: 160,
              leadTimeDays: 9,
              movements: [
                { delta: 200, reason: 'receive', daysAgo: 20 },
                { delta: -33, reason: 'sale', daysAgo: 9 },
                { delta: -17, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Surprisingly nice quality',
          body: 'Hard enamel, not the soft stuff. Colors are crisp and the clutch is rubber so it does not fall off.',
          authorPersona: 'avery',
          helpfulCount: 3,
          daysAgo: 12,
        },
      ],
      questions: [],
    },
    {
      key: 'starter-pack',
      title: 'Starter Pack',
      handle: 'starter-pack',
      description:
        '<p>Our most popular trio in one bundle: the Classic Notebook, a Ceramic Mug, and a Canvas Tote — the everyday-carry set that makes a great gift or a clean welcome kit. Buy them together and save versus picking each one on its own.</p>',
      productType: 'Bundles',
      vendor: 'House Goods',
      tags: ['bundle', 'starter', 'gift', 'value'],
      seoTitle: 'Starter Pack — Notebook, Mug & Tote',
      seoDescription:
        'A value bundle of our Classic Notebook, Ceramic Mug, and Canvas Tote. The everyday-carry set, priced to save.',
      categoryKeys: ['accessories'],
      collectionKeys: ['featured'],
      variants: [{ sku: 'KIT-STARTER', title: null, priceCents: 3999, costCents: 1940 }],
      reviews: [
        {
          rating: 5,
          title: 'Great welcome gift',
          body: 'Bought a few as onboarding gifts for new hires. Felt thoughtful and the savings add up.',
          authorPersona: 'noah',
          helpfulCount: 5,
          daysAgo: 13,
        },
      ],
      questions: [],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'starter-pack',
      pricing: { mode: 'percent', percentOff: 15 },
      inventoryMode: 'components',
      components: [
        { productKey: 'classic-notebook', quantity: 1, required: true },
        { productKey: 'ceramic-mug', quantity: 1, required: true },
        { productKey: 'canvas-tote', quantity: 1, required: true },
      ],
    },
  ],

  articles: [
    {
      slug: 'welcome-to-your-new-store',
      title: 'Welcome to your new store',
      excerpt:
        'You have a storefront, a catalog, and sample orders to explore. Here is how to make it yours and start selling.',
      daysAgo: 6,
      body: doc(
        p(
          'Welcome! Your store is already live with a sample catalog, a few customers, and some example orders so nothing feels empty while you set up. Everything you see is sample data — you can clear it with one click whenever you are ready to go live with your own products.'
        ),
        h2('Make it yours'),
        p(
          'Start by replacing the placeholder products with your own. Add a title, a few photos, an honest description, and a price — that is genuinely all it takes to publish your first real product. Your store name, logo, and colors live in settings, so the whole site updates the moment you change them.'
        ),
        h2('Then start selling'),
        p(
          'Once you have a product or two and a way to take payment connected, you are ready to take a real order. Share your store link, and watch it land on your orders page — the same place these sample orders are sitting right now.'
        ),
        p(
          'Take your time exploring. Nothing here is permanent, and you cannot break anything by clicking around.'
        )
      ),
    },
    {
      slug: 'five-things-to-set-up-first',
      title: 'Five things to set up first',
      excerpt:
        'A short, no-pressure checklist to get from sample store to your own store — in roughly the order that matters.',
      daysAgo: 14,
      body: doc(
        p(
          'There is a lot you can do, but only a few things you need to do before you can take a real order. Here is the short list, in the order we would tackle it.'
        ),
        h2('The checklist'),
        ol(
          'Set your store name, logo, and colors so the site looks like your brand',
          'Add your first real product — a title, a photo, a description, and a price',
          'Connect a payment method so you can actually get paid',
          'Set up shipping or pickup so customers know how it arrives',
          'Add your contact details and policies so customers know who they are buying from'
        ),
        h2('What can wait'),
        p(
          'Collections, discounts, email campaigns, and a custom domain are all worth doing — later. None of them block your first sale, so do not let them slow you down now.'
        ),
        ul(
          'Clear the sample data whenever you are ready for a clean slate',
          'Add products in batches — you do not have to do them all at once',
          'Revisit settings any time; nothing here is locked in'
        ),
        p('When in doubt, ship it. You can always refine after the first order comes in.')
      ),
    },
  ],
};
