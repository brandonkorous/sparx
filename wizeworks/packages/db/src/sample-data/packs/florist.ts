// Florist & plants sample pack — a neighbourhood flower shop that also runs
// evening workshops and takes wedding work. Data-as-code.
//
// ── WHY THIS VERTICAL EXISTS ────────────────────────────────────────────────
//
// It is the one shape none of the other eight packs covers: a business whose
// stock is PERISHABLE and whose calendar is a CLASS rather than a chair. Apparel
// and food sell things; salon and fitness sell time; a florist does both at once
// and its inventory expires in five days, so the lot/expiry, shrinkage and
// stockout surfaces have something true to render instead of a warehouse full of
// things that keep forever.
//
// ── THE STAR IS THE PAIR ────────────────────────────────────────────────────
//
// Two halves that have to agree: a cooler full of dated stems (lots with real
// `expiresInDays`, including one already gone) and a workshop bench booked as a
// CLASS with a capacity — `capacity: 8`, which is what makes "6 of 8" a real
// number rather than a caption. Everything else hangs off those: the standing
// weekly order that becomes a trade account, the wedding consultation that
// becomes a quote, the care guides that answer the question every buyer asks at
// the counter.
//
// ── EVERY NUMBER IS COMMITTED TO SOMEWHERE ELSE ─────────────────────────────
//
// The wreath workshop is Saturday at 10:00 with eight places and six taken,
// because that is what the Piggles home page shows on screen. A pack whose job
// is partly to be photographed has to match the thing already published, or the
// screenshot quietly contradicts the film beside it.

import { doc, h2, h3, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const floristPack: SampleDataPack = {
  industry: 'florist',
  label: 'Florist & plants',
  summary:
    'A neighbourhood flower shop: a cooler of dated stems with real expiry, wrapped bouquets and houseplants, evening workshops booked as classes, wedding consultations that become quotes, and the standing weekly order that turns a café into a trade account.',

  // Two locations, because a florist genuinely has two and they behave
  // differently: the cooler is where stems live and lose days, the dry store is
  // where vases and ribbon sit indefinitely. One warehouse would put a bucket of
  // ranunculus and a box of glass vases on the same shelf and make the expiry
  // surface look like a bug.
  warehouses: [
    {
      key: 'COOLER',
      code: 'COOLER',
      name: 'Shop Cooler',
      type: 'owned',
      city: 'Asheville',
      region: 'NC',
    },
    {
      key: 'DRYSTORE',
      code: 'DRYSTORE',
      name: 'Dry Store',
      type: 'owned',
      city: 'Asheville',
      region: 'NC',
    },
  ],

  categories: [
    { key: 'bouquets', name: 'Bouquets', handle: 'bouquets' },
    { key: 'stems', name: 'Stems by the Bunch', handle: 'stems' },
    { key: 'plants', name: 'Plants', handle: 'plants' },
    { key: 'dried', name: 'Dried & Everlasting', handle: 'dried' },
    { key: 'vessels', name: 'Vases & Care', handle: 'vessels' },
  ],

  collections: [
    { key: 'in-season', name: 'In Season This Week', handle: 'in-season', featured: true },
    { key: 'weddings', name: 'Wedding & Event', handle: 'weddings' },
    { key: 'sympathy', name: 'Sympathy', handle: 'sympathy' },
  ],

  // What a florist writes on a customer card. Two of these are the difference
  // between a good shop and a forgettable one: the standing date nobody should
  // have to be reminded of, and the allergy that makes lilies unsendable.
  recordTypes: [
    {
      objectKey: 'contact',
      properties: [
        {
          key: 'standingDate',
          label: 'The date they never want to miss',
          type: 'text',
          helpText:
            'An anniversary, a birthday, a remembrance. Drives the reminder the week before.',
        },
        {
          key: 'avoidFlowers',
          label: 'Never send',
          type: 'text',
          helpText: 'Allergies, funerals associations, or simply what they cannot stand.',
        },
        {
          key: 'usualStyle',
          label: 'What they usually go for',
          type: 'enum',
          options: [
            { value: 'garden', label: 'Loose and garden-style' },
            { value: 'structured', label: 'Structured and tidy' },
            { value: 'dried', label: 'Dried and everlasting' },
            { value: 'plants', label: 'Plants rather than cut' },
          ],
        },
        {
          key: 'deliveryNotes',
          label: 'Getting it to the door',
          type: 'long_text',
          helpText: 'Gate codes, which neighbour takes parcels, the dog.',
        },
      ],
    },
    {
      objectKey: 'company',
      properties: [
        {
          key: 'standingDay',
          label: 'Standing order day',
          type: 'enum',
          helpText: 'The weekday their arrangements are made up and dropped off.',
          options: [
            { value: 'mon', label: 'Monday' },
            { value: 'tue', label: 'Tuesday' },
            { value: 'wed', label: 'Wednesday' },
            { value: 'thu', label: 'Thursday' },
            { value: 'fri', label: 'Friday' },
          ],
        },
        {
          key: 'vesselsOnLoan',
          label: 'Vases out on loan',
          type: 'number',
          integer: true,
          helpText: 'Swapped at each drop-off. The number that quietly goes missing.',
        },
      ],
    },
  ],

  personas: [
    {
      key: 'tess',
      name: 'Tess Ferraro',
      email: 'tess.ferraro',
      phone: '+1-828-555-0117',
      line1: '18 Cumberland Ave',
      city: 'Asheville',
      region: 'NC',
      postalCode: '28801',
      properties: {
        standingDate: '14 February — always before 11am, she leaves for work at noon',
        usualStyle: 'garden',
        deliveryNotes: 'Blue door on the side. Leave with Marta at number 20 if out.',
      },
    },
    {
      key: 'declan',
      name: 'Declan Moss',
      email: 'declan.moss',
      phone: '+1-828-555-0164',
      line1: '402 Haywood Rd',
      city: 'Asheville',
      region: 'NC',
      postalCode: '28806',
      properties: {
        standingDate: '9 September, his mother’s birthday',
        avoidFlowers: 'No lilies — his wife reacts to the pollen',
        usualStyle: 'structured',
      },
    },
    {
      key: 'priya',
      name: 'Priya Raghunathan',
      email: 'priya.raghunathan',
      phone: '+1-828-555-0129',
      line1: '77 Riverside Dr',
      city: 'Asheville',
      region: 'NC',
      postalCode: '28801',
      properties: {
        usualStyle: 'plants',
        deliveryNotes: 'Studio at the back of the building, ring the second buzzer.',
      },
    },
    {
      key: 'hollis',
      name: 'Hollis Bramwell',
      email: 'hollis.bramwell',
      phone: '+1-828-555-0193',
      line1: '3 Montford Ave',
      city: 'Asheville',
      region: 'NC',
      postalCode: '28801',
      properties: { usualStyle: 'dried', standingDate: '2 June, wedding anniversary' },
    },
    {
      key: 'niamh',
      name: 'Niamh Okorie',
      email: 'niamh.okorie',
      phone: '+1-828-555-0155',
      line1: '221 Charlotte St',
      city: 'Asheville',
      region: 'NC',
      postalCode: '28801',
      properties: { usualStyle: 'garden' },
    },
    // The trade account. A café buying the same three arrangements every Tuesday
    // is how most small florists actually pay the rent, and it is the row that
    // gives B2B pricing, approvals and a monthly invoice something real to be
    // about.
    {
      key: 'harbor-cafe',
      name: 'Rosa Delgado',
      email: 'rosa.delgado',
      kind: 'b2b',
      company: 'Harbor & Main Coffee',
      phone: '+1-828-555-0102',
      line1: '55 Broadway St',
      city: 'Asheville',
      region: 'NC',
      postalCode: '28801',
      companyProperties: { standingDay: 'tue', vesselsOnLoan: 9 },
    },
    {
      key: 'linden-house',
      name: 'Arthur Bell',
      email: 'arthur.bell',
      kind: 'b2b',
      company: 'Linden House Hotel',
      phone: '+1-828-555-0176',
      line1: '1 Linden Terrace',
      city: 'Asheville',
      region: 'NC',
      postalCode: '28804',
      companyProperties: { standingDay: 'fri', vesselsOnLoan: 24 },
    },
  ],

  suppliers: [
    {
      code: 'VALLEY',
      name: 'Valley Field Growers',
      paymentTerms: 'net30',
      leadTimeDays: 2,
      city: 'Hendersonville',
      region: 'NC',
      variantKeys: ['stem-roses', 'stem-ranunculus', 'stem-eucalyptus'],
    },
    {
      code: 'GLASSWORKS',
      name: 'Ridgeway Glassworks',
      paymentTerms: 'net45',
      leadTimeDays: 14,
      city: 'Greensboro',
      region: 'NC',
      variantKeys: ['vase-tall', 'vase-bud'],
    },
  ],

  // Where the vertical earns its place. Cut stems carry a real date; the dry
  // goods carry none. One lot is already past — a shop that has never had to
  // throw anything away has not been open long, and a demo that only shows the
  // happy case teaches the wrong reflex about the expiry screen.
  lots: [
    {
      variantKey: 'stem-roses',
      warehouseKey: 'COOLER',
      lotNumber: 'VF-2211',
      quantity: 60,
      expiresInDays: 4,
    },
    {
      variantKey: 'stem-ranunculus',
      warehouseKey: 'COOLER',
      lotNumber: 'VF-2214',
      quantity: 40,
      expiresInDays: 2,
    },
    {
      variantKey: 'stem-eucalyptus',
      warehouseKey: 'COOLER',
      lotNumber: 'VF-2208',
      quantity: 25,
      expiresInDays: 9,
    },
    {
      variantKey: 'stem-ranunculus',
      warehouseKey: 'COOLER',
      lotNumber: 'VF-2199',
      quantity: 12,
      expiresInDays: -1,
    },
  ],

  products: [
    {
      key: 'market-bouquet',
      title: 'The Market Bouquet',
      handle: 'market-bouquet',
      description: `<p>Whatever came off the van that morning, wrapped in kraft and tied with cotton string. We make it up fresh each day, which is the only honest way to sell a bouquet: you get what is genuinely at its best this week rather than what a photograph promised three months ago.</p>
<p>Expect something loose and garden-style — a few focal blooms, something airy through the middle, and foliage with a bit of movement in it. In April that is ranunculus and blossom; in September it is dahlias and grasses.</p>
<h3>How long it lasts</h3>
<p>Seven to ten days with a fresh cut and clean water. There is a sachet of flower food in the wrap and a card explaining what to do with it, because most bouquets die of neglect in the first forty-eight hours rather than old age.</p>`,
      productType: 'Bouquet',
      productTypeKey: 'general',
      vendor: 'Wildroot',
      tags: ['fresh', 'seasonal', 'gift'],
      seoTitle: 'The Market Bouquet — seasonal hand-tied flowers',
      seoDescription:
        'A hand-tied seasonal bouquet made up fresh each morning from whatever is at its best that week. Three sizes, flower food included.',
      emoji: '💐',
      options: [
        {
          name: 'Size',
          displayType: 'segmented',
          values: [{ value: 'Posy' }, { value: 'Generous' }, { value: 'Showstopper' }],
        },
      ],
      categoryKeys: ['bouquets'],
      collectionKeys: ['in-season'],
      variants: [
        {
          key: 'bouquet-posy',
          sku: 'WR-BQ-POSY',
          title: 'Posy',
          optionValues: ['Posy'],
          priceCents: 3200,
          costCents: 1400,
          stock: [
            {
              warehouseKey: 'COOLER',
              reorderPoint: 6,
              reorderQuantity: 24,
              leadTimeDays: 2,
              movements: [
                { delta: 24, reason: 'receive', daysAgo: 6 },
                { delta: -9, reason: 'sale', daysAgo: 4 },
                { delta: -6, reason: 'sale', daysAgo: 2 },
                { delta: -2, reason: 'loss', daysAgo: 1 },
              ],
            },
          ],
        },
        {
          key: 'bouquet-generous',
          sku: 'WR-BQ-GEN',
          title: 'Generous',
          optionValues: ['Generous'],
          priceCents: 5400,
          costCents: 2400,
          stock: [
            {
              warehouseKey: 'COOLER',
              reorderPoint: 5,
              reorderQuantity: 18,
              leadTimeDays: 2,
              movements: [
                { delta: 18, reason: 'receive', daysAgo: 6 },
                { delta: -7, reason: 'sale', daysAgo: 3 },
                { delta: -5, reason: 'sale', daysAgo: 1 },
              ],
            },
          ],
        },
        {
          key: 'bouquet-showstopper',
          sku: 'WR-BQ-SHOW',
          title: 'Showstopper',
          optionValues: ['Showstopper'],
          priceCents: 9500,
          costCents: 4200,
          stock: [
            {
              warehouseKey: 'COOLER',
              reorderPoint: 3,
              reorderQuantity: 8,
              leadTimeDays: 2,
              movements: [
                { delta: 8, reason: 'receive', daysAgo: 6 },
                { delta: -6, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Arrived looking like the picture, which never happens',
          body: 'Ordered the Generous for my sister and asked them to leave the lilies out. They did, without me having to explain twice, and the whole thing still looked full. Ten days later she sent me a photo of it still going.',
          authorPersona: 'tess',
          daysAgo: 12,
          helpfulCount: 7,
        },
        {
          rating: 4,
          title: 'Lovely, and genuinely seasonal',
          body: 'You do have to accept you are not choosing the flowers. That is the point and it is worth it — I have had things in these I would never have picked and loved.',
          authorPersona: 'niamh',
          daysAgo: 26,
          response:
            'Thank you Niamh — that is exactly the deal, and we are glad it landed. Ask for a peek at the buckets any Friday if you want to see what is coming.',
        },
      ],
      questions: [
        {
          body: 'Can I ask for no lilies? My wife reacts to the pollen.',
          authorPersona: 'declan',
          answer:
            'Always. Put it in the notes at checkout, or tell us once and we will keep it on your card so you never have to ask again.',
          daysAgo: 30,
        },
      ],
    },
    {
      key: 'garden-roses',
      title: 'Garden Roses, by the Bunch',
      handle: 'garden-roses',
      description: `<p>Ten stems of scented garden roses, cut at the Valley Field fields in Hendersonville two days before they reach you. Short-stemmed and open-faced rather than the tight, scentless heads that survive a flight from the other side of the world.</p>
<p>Sold as a bunch to arrange yourself. If you would rather we did it, take the Market Bouquet instead and ask for roses through it.</p>`,
      productType: 'Cut stems',
      productTypeKey: 'general',
      vendor: 'Valley Field Growers',
      tags: ['fresh', 'scented', 'local'],
      emoji: '🌹',
      categoryKeys: ['stems'],
      collectionKeys: ['in-season', 'weddings'],
      variants: [
        {
          key: 'stem-roses',
          sku: 'WR-ST-ROSE',
          title: null,
          priceCents: 2800,
          costCents: 1250,
          stock: [
            {
              warehouseKey: 'COOLER',
              reorderPoint: 12,
              reorderQuantity: 60,
              leadTimeDays: 2,
              movements: [
                { delta: 60, reason: 'receive', daysAgo: 3 },
                { delta: -14, reason: 'sale', daysAgo: 2 },
                { delta: -11, reason: 'sale', daysAgo: 1 },
                { delta: -4, reason: 'loss', daysAgo: 1 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'You can actually smell these',
          body: 'I had forgotten roses were supposed to have a scent. Bought a bunch on a Friday and the whole kitchen smelled of them by Sunday.',
          authorPersona: 'hollis',
          daysAgo: 19,
          helpfulCount: 4,
        },
      ],
    },
    {
      key: 'ranunculus',
      title: 'Ranunculus, by the Bunch',
      handle: 'ranunculus',
      description: `<p>Ten stems, layered like tissue paper, in whatever the field is giving that week — usually a mix of coral, cream and a dusty pink that photographs far better than it sounds.</p>
<p>They are a short season and a short vase life: five or six days, and worth every one of them. When they are gone in June they are gone until February.</p>`,
      productType: 'Cut stems',
      productTypeKey: 'general',
      vendor: 'Valley Field Growers',
      tags: ['fresh', 'seasonal', 'short-season'],
      emoji: '🌸',
      categoryKeys: ['stems'],
      collectionKeys: ['in-season'],
      variants: [
        {
          key: 'stem-ranunculus',
          sku: 'WR-ST-RANU',
          title: null,
          priceCents: 2400,
          costCents: 1100,
          stock: [
            {
              warehouseKey: 'COOLER',
              reorderPoint: 10,
              reorderQuantity: 40,
              leadTimeDays: 2,
              movements: [
                { delta: 40, reason: 'receive', daysAgo: 5 },
                { delta: -18, reason: 'sale', daysAgo: 3 },
                { delta: -12, reason: 'sale', daysAgo: 1 },
                { delta: -6, reason: 'loss', daysAgo: 0 },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'eucalyptus',
      title: 'Eucalyptus, by the Bunch',
      handle: 'eucalyptus',
      description: `<p>Silver dollar eucalyptus, ten stems. The workhorse of every arrangement in the shop and the one thing we never run out of on purpose.</p>
<p>Fresh it lasts a fortnight in water. Left to dry hanging upside down it lasts more or less forever, which is why half of what we sell goes straight into a bathroom rather than a vase.</p>`,
      productType: 'Foliage',
      productTypeKey: 'general',
      vendor: 'Valley Field Growers',
      tags: ['foliage', 'dries-well'],
      emoji: '🌿',
      categoryKeys: ['stems', 'dried'],
      variants: [
        {
          key: 'stem-eucalyptus',
          sku: 'WR-ST-EUC',
          title: null,
          priceCents: 1400,
          costCents: 550,
          stock: [
            {
              warehouseKey: 'COOLER',
              reorderPoint: 8,
              reorderQuantity: 25,
              leadTimeDays: 2,
              movements: [
                { delta: 25, reason: 'receive', daysAgo: 4 },
                { delta: -9, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'dried-wreath',
      title: 'Dried Everlasting Wreath',
      handle: 'dried-wreath',
      description: `<p>A twelve-inch wreath on a copper ring — dried eucalyptus, bunny tails, strawflower and a bit of preserved oak. Made in the shop, one at a time, so no two come out quite the same.</p>
<p>It will not drop, will not need water, and will still be on the door next year if you keep it out of direct sun. This is also the thing everybody makes at the Saturday workshop, if you would rather build your own.</p>`,
      productType: 'Wreath',
      productTypeKey: 'home_goods',
      attributes: {
        material: 'Dried eucalyptus, bunny tail grass, strawflower, preserved oak',
        dimensions: '12 in diameter',
        care: 'Keep out of direct sunlight. Dust with a hairdryer on cold.',
      },
      vendor: 'Wildroot',
      tags: ['dried', 'everlasting', 'handmade'],
      emoji: '🍂',
      categoryKeys: ['dried'],
      collectionKeys: ['in-season'],
      variants: [
        {
          key: 'wreath-12',
          sku: 'WR-DR-WR12',
          title: null,
          priceCents: 6800,
          costCents: 2600,
          stock: [
            {
              warehouseKey: 'DRYSTORE',
              reorderPoint: 4,
              reorderQuantity: 12,
              leadTimeDays: 7,
              movements: [
                { delta: 12, reason: 'receive', daysAgo: 21 },
                { delta: -5, reason: 'sale', daysAgo: 12 },
                { delta: -3, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Third year on the same door',
          body: 'Bought one in 2024 and it still looks like the day it arrived. Bought two more as presents this month.',
          authorPersona: 'hollis',
          daysAgo: 8,
          helpfulCount: 11,
        },
      ],
    },
    {
      key: 'peace-lily',
      title: 'Peace Lily',
      handle: 'peace-lily',
      description: `<p>A properly grown peace lily in a plain terracotta pot, not the supermarket sort that arrives root-bound and sulks for a month. Happy in a north-facing room, forgiving if you forget it, and it tells you when it is thirsty by drooping theatrically and then recovering within the hour.</p>
<h3>Worth knowing</h3>
<p>The leaves are mildly toxic to cats and dogs if chewed. If you have either, take the parlour palm instead and we will swap it at the counter.</p>`,
      productType: 'Houseplant',
      productTypeKey: 'home_goods',
      attributes: {
        material: 'Spathiphyllum wallisii in terracotta',
        care: 'Indirect light. Water when the leaves droop, roughly weekly.',
        dimensions: '14 cm pot, approx. 45 cm tall',
      },
      vendor: 'Wildroot',
      tags: ['plant', 'low-light', 'toxic-to-pets'],
      emoji: '🪴',
      categoryKeys: ['plants'],
      variants: [
        {
          key: 'plant-lily-14',
          sku: 'WR-PL-LILY14',
          title: null,
          priceCents: 3400,
          costCents: 1500,
          stock: [
            {
              warehouseKey: 'DRYSTORE',
              reorderPoint: 5,
              reorderQuantity: 15,
              leadTimeDays: 5,
              movements: [
                { delta: 15, reason: 'receive', daysAgo: 14 },
                { delta: -6, reason: 'sale', daysAgo: 7 },
                { delta: -1, reason: 'damage', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      questions: [
        {
          body: 'Is this safe around a cat?',
          displayName: 'Sam',
          answer:
            'Not really — the leaves upset cats and dogs if they chew them. Ask us for the parlour palm or the calathea instead; both are fine and about the same money.',
          daysAgo: 15,
        },
      ],
    },
    {
      key: 'vase-tall',
      title: 'Tall Glass Vase',
      handle: 'tall-glass-vase',
      description: `<p>A plain, heavy-bottomed glass cylinder, twenty-five centimetres tall. Made at Ridgeway Glassworks in Greensboro. It holds a Generous bouquet without help and does not tip over when the dog goes past.</p>
<p>Nothing clever about it, which is the point — a vase should disappear behind what is in it.</p>`,
      productType: 'Vase',
      productTypeKey: 'home_goods',
      attributes: {
        material: 'Hand-finished soda-lime glass',
        dimensions: '25 cm tall, 11 cm mouth',
        care: 'Dishwasher safe',
      },
      vendor: 'Ridgeway Glassworks',
      tags: ['vase', 'glass'],
      emoji: '🏺',
      categoryKeys: ['vessels'],
      variants: [
        {
          key: 'vase-tall',
          sku: 'WR-VS-TALL',
          title: null,
          priceCents: 2600,
          costCents: 1050,
          stock: [
            {
              warehouseKey: 'DRYSTORE',
              reorderPoint: 6,
              reorderQuantity: 24,
              leadTimeDays: 14,
              movements: [
                { delta: 24, reason: 'receive', daysAgo: 30 },
                { delta: -8, reason: 'sale', daysAgo: 16 },
                { delta: -5, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'vase-bud',
      title: 'Bud Vase, Set of Three',
      handle: 'bud-vase-set',
      description: `<p>Three small glass bud vases in graduated heights. For the two or three stems left over when a bouquet starts to go, which is when most people throw the whole thing out.</p>
<p>Strip everything below the water line, cut short, and a bouquet on its last legs will give you another four days on a windowsill.</p>`,
      productType: 'Vase',
      productTypeKey: 'home_goods',
      attributes: {
        material: 'Soda-lime glass',
        dimensions: '9, 12 and 15 cm',
        care: 'Hand wash — the necks are narrow',
      },
      vendor: 'Ridgeway Glassworks',
      tags: ['vase', 'glass', 'gift'],
      emoji: '🫙',
      categoryKeys: ['vessels'],
      variants: [
        {
          key: 'vase-bud',
          sku: 'WR-VS-BUD3',
          title: null,
          priceCents: 3200,
          costCents: 1300,
          stock: [
            {
              warehouseKey: 'DRYSTORE',
              reorderPoint: 5,
              reorderQuantity: 18,
              leadTimeDays: 14,
              movements: [
                { delta: 18, reason: 'receive', daysAgo: 28 },
                { delta: -7, reason: 'sale', daysAgo: 9 },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'care-kit',
      title: 'Flower Care Kit',
      handle: 'flower-care-kit',
      description: `<p>A pair of proper floristry snips, ten sachets of flower food, and a card with the four things that actually matter written on it. We give the card away free at the counter; the snips are the part worth paying for.</p>
<p>Kitchen scissors crush the stem rather than cutting it, which closes the very channel the flower drinks through. It is the single most common reason a bouquet dies early.</p>`,
      productType: 'Accessory',
      productTypeKey: 'general',
      vendor: 'Wildroot',
      tags: ['care', 'gift', 'tools'],
      emoji: '✂️',
      categoryKeys: ['vessels'],
      variants: [
        {
          key: 'care-kit',
          sku: 'WR-CR-KIT',
          title: null,
          priceCents: 2200,
          costCents: 850,
          stock: [
            {
              warehouseKey: 'DRYSTORE',
              reorderPoint: 8,
              reorderQuantity: 30,
              leadTimeDays: 10,
              movements: [
                { delta: 30, reason: 'receive', daysAgo: 24 },
                { delta: -11, reason: 'sale', daysAgo: 11 },
                { delta: -4, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
    },
    // The bundle wrapper. Sold as its own product so it can carry its own copy
    // and its own photograph; the bundle definition below points at the parts.
    {
      key: 'first-vase-set',
      title: 'The First Vase Set',
      handle: 'first-vase-set',
      description: `<p>A Generous bouquet, the tall glass vase it fits, and the care kit that keeps it going — the three things somebody moving into a new place does not yet own.</p>
<p>Cheaper than the parts, and it arrives ready to put straight on a table rather than in a sink while somebody hunts for something to stand it in.</p>`,
      productType: 'Gift set',
      productTypeKey: 'general',
      vendor: 'Wildroot',
      tags: ['gift', 'bundle', 'housewarming'],
      emoji: '🎁',
      categoryKeys: ['bouquets', 'vessels'],
      collectionKeys: ['in-season'],
      variants: [
        {
          key: 'first-vase-set',
          sku: 'WR-SET-FIRST',
          title: null,
          priceCents: 9900,
          costCents: 4400,
        },
      ],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'first-vase-set',
      pricing: { mode: 'percent', percentOff: 12 },
      inventoryMode: 'components',
      components: [
        { productKey: 'market-bouquet', quantity: 1, required: true },
        { productKey: 'vase-tall', quantity: 1, required: true },
        { productKey: 'care-kit', quantity: 1, required: false, swappable: true },
      ],
    },
  ],

  // The other half of the vertical. A florist's calendar is not a chair with one
  // person in it — the workshops are CLASSES with a capacity, and the wedding
  // work is a long consultation that turns into a quote rather than a sale.
  scheduling: {
    resources: [
      {
        key: 'florist-sena',
        name: 'Sena (Owner & Lead Florist)',
        kind: 'staff',
        skills: ['workshop', 'wedding', 'sympathy'],
        windows: [
          { day: 2, startMin: 540, endMin: 1020 },
          { day: 3, startMin: 540, endMin: 1020 },
          { day: 4, startMin: 540, endMin: 1140 },
          { day: 5, startMin: 540, endMin: 1020 },
          { day: 6, startMin: 540, endMin: 960 },
        ],
      },
      {
        key: 'florist-bo',
        name: 'Bo (Florist)',
        kind: 'staff',
        skills: ['workshop', 'sympathy'],
        windows: [
          { day: 1, startMin: 540, endMin: 1020 },
          { day: 4, startMin: 540, endMin: 1020 },
          { day: 5, startMin: 600, endMin: 1140 },
          { day: 6, startMin: 540, endMin: 960 },
        ],
      },
      {
        key: 'workshop-bench',
        name: 'The Workshop Bench',
        kind: 'space',
        capacityMin: 1,
        capacityMax: 8,
        windows: [
          { day: 4, startMin: 1020, endMin: 1260 },
          { day: 6, startMin: 540, endMin: 900 },
        ],
      },
      {
        key: 'consultation-table',
        name: 'Consultation Table',
        kind: 'table',
        windows: [
          { day: 2, startMin: 600, endMin: 1020 },
          { day: 3, startMin: 600, endMin: 1020 },
          { day: 4, startMin: 600, endMin: 1140 },
          { day: 5, startMin: 600, endMin: 1020 },
        ],
      },
    ],
    services: [
      // `capacity: 8` is the load-bearing number: it is what makes a booking
      // read "6 of 8" instead of "booked", and it is the figure the Piggles home
      // page already puts on screen. A class with no capacity is just an
      // appointment several people turned up to.
      {
        key: 'wreath-workshop',
        name: 'Wreath Workshop',
        description:
          'Two hours on a Saturday morning building a dried everlasting wreath on a copper ring. Everything is on the bench when you arrive, there is coffee, and you take the wreath home. No experience needed and nobody has ever made a bad one.',
        durationMinutes: 120,
        priceCents: 7500,
        capacity: 8,
        bookingType: 'class',
        slotIntervalMin: 120,
        bufferAfterMin: 30,
        assignmentStrategy: 'any_available',
        resourceRoles: [
          { role: 'tutor', kind: 'staff', skill: 'workshop' },
          { role: 'bench', kind: 'space' },
        ],
      },
      {
        key: 'bouquet-evening',
        name: 'Hand-Tied Bouquet Evening',
        description:
          'A Thursday evening class on the spiral hand-tie every florist uses. You build two — one to leave with and one to give away — and learn why the stems have to go the same way round.',
        durationMinutes: 120,
        priceCents: 6800,
        capacity: 8,
        bookingType: 'class',
        slotIntervalMin: 120,
        bufferAfterMin: 30,
        assignmentStrategy: 'any_available',
        resourceRoles: [
          { role: 'tutor', kind: 'staff', skill: 'workshop' },
          { role: 'bench', kind: 'space' },
        ],
      },
      // Free, long, and requires approval — a wedding consultation is the top of
      // a quote pipeline rather than a sale, and modelling it as a paid booking
      // would put revenue on the calendar that never existed.
      {
        key: 'wedding-consultation',
        name: 'Wedding Consultation',
        description:
          'An hour at the table with Sena, your dates, your venue and whatever photographs you have been collecting. You leave with a written quote rather than a number said out loud.',
        durationMinutes: 60,
        priceCents: 0,
        capacity: 1,
        bookingType: 'appointment',
        requiresApproval: true,
        slotIntervalMin: 30,
        assignmentStrategy: 'customer_choice',
        resourceRoles: [
          { role: 'florist', kind: 'staff', skill: 'wedding' },
          { role: 'table', kind: 'table' },
        ],
      },
      {
        key: 'sympathy-order',
        name: 'Sympathy & Tribute Order',
        description:
          'A half hour, in person or on the phone, to arrange flowers for a funeral. We will handle the timing with the funeral director so you do not have to.',
        durationMinutes: 30,
        priceCents: 0,
        capacity: 1,
        bookingType: 'appointment',
        slotIntervalMin: 30,
        assignmentStrategy: 'any_available',
        resourceRoles: [{ role: 'florist', kind: 'staff', skill: 'sympathy' }],
      },
    ],
  },

  articles: [
    {
      slug: 'make-cut-flowers-last',
      title: 'Four things that actually make cut flowers last',
      excerpt:
        'Not the penny, not the aspirin, not the lemonade. The four that genuinely work, and why the first forty-eight hours decide everything.',
      emoji: '💧',
      daysAgo: 9,
      body: doc(
        p(
          'Most bouquets do not die of old age. They die in the first two days, of thirst, because the stem sealed itself over on the way home and never drank again. Everything below is about keeping that channel open.'
        ),
        h2('Cut them again, properly'),
        p(
          'Take two centimetres off every stem at a slant, with something sharp. A slant means the cut end cannot sit flat on the bottom of the vase and seal itself shut, and sharp means cutting rather than crushing — kitchen scissors squash the very tubes the flower drinks through, which is why a bouquet trimmed with them fades days early.'
        ),
        h2('Nothing below the water line'),
        p(
          'Strip every leaf that would sit under water. Submerged foliage rots within a day, the water goes cloudy, and the bacteria that follow block the stems from the inside. This one step does more than the flower food.'
        ),
        h2('Use the sachet'),
        p(
          'It is not a marketing token. It is sugar to feed the bloom, an acidifier so the water moves up the stem more easily, and a small amount of biocide to keep the bacteria down. Half a sachet in a bud vase, the whole thing in a full vase.'
        ),
        h2('Change the water, not just top it up'),
        p(
          'Every two days, fresh water and a fresh cut. It takes ninety seconds and it roughly doubles what you get out of a bouquet.'
        ),
        h3('And the things that do not work'),
        ul(
          'A copper penny — modern pennies are barely copper and it does nothing.',
          'Aspirin — the theory is sound and the dose is far too small to matter.',
          'Lemonade — sugar with no biocide, so you feed the bacteria as well as the flower.',
          'Hairspray — it seals the petal and stops the flower breathing.'
        )
      ),
    },
    {
      slug: 'whats-in-season',
      title: 'What is actually in season, month by month',
      excerpt:
        'Why the shop looks different every six weeks, and what to expect when. Written for people planning something months ahead.',
      emoji: '📆',
      daysAgo: 22,
      body: doc(
        p(
          'Anything can be flown in at any time of year, and it will be expensive, scentless and tired when it arrives. Everything below is what grows near enough to be cut and sold within about two days, which is the only reason our stems smell of anything.'
        ),
        h2('Late winter'),
        p(
          'Ranunculus, anemone, narcissus and the first blossom. Short stems, extraordinary colour, and a vase life of five or six days rather than ten — worth knowing if you are planning something and want it to last the weekend.'
        ),
        h2('Spring'),
        p(
          'Tulips, which keep growing in the vase and will lean toward the window overnight. Lilac for about a fortnight. This is the cheapest and most abundant the shop ever is.'
        ),
        h2('Summer'),
        p(
          'Garden roses with real scent, sweet peas that last four days and are worth it, cosmos and scabious. The bulk of wedding work sits here for a reason.'
        ),
        h2('Autumn'),
        p(
          'Dahlias until the first frost takes them overnight, then grasses, hydrangea going papery, and the start of the dried season.'
        ),
        h2('If you are planning a wedding'),
        p(
          'Tell us the date before you tell us the flowers. A February wedding built around peonies means importing them at four times the price; the same budget spent on what is standing in the field that week buys roughly three times the flowers.'
        )
      ),
    },
    {
      slug: 'flowers-for-a-funeral',
      title: 'Ordering flowers for a funeral, when you have never done it',
      excerpt:
        'What the different arrangements are called, who is supposed to send what, and the questions to ask. Plainly, because this is not the week to be decoding jargon.',
      emoji: '🕊️',
      daysAgo: 41,
      body: doc(
        p(
          'People come in for this having never done it before and apologise for not knowing the words. There is nothing to know in advance — here is all of it.'
        ),
        h2('What the arrangements are called'),
        ul(
          'A casket spray sits on top of the coffin. Traditionally it comes from the immediate family, and there is only one.',
          'A wreath is the round one, on a stand. It comes from anyone.',
          'A posy or a tied sheaf is a bouquet laid rather than stood. Smaller, and what most people send.',
          'A letter tribute spells MUM, DAD, NAN. Family, usually, and it needs a few days notice.'
        ),
        h2('Who sends what'),
        p(
          'The immediate family sends the casket spray. Everyone else sends whatever they like — there is no rule, and nobody at a funeral has ever counted. If the notice says family flowers only, send something to the house the following week instead.'
        ),
        h2('What we need from you'),
        ul(
          'The date and time of the service, and the funeral director.',
          'Whether it goes to the home, the funeral home or the venue.',
          'What to write on the card, in your words. We will write it out for you.',
          'Anything they loved, or anything to avoid.'
        ),
        h2('The timing is ours to worry about'),
        p(
          'We deal with the funeral director directly about when flowers can be delivered and where they go afterwards. You do not need to coordinate that, and you should not have to think about it.'
        )
      ),
    },
  ],

  supportRequests: [
    {
      subject: 'Delivery went to the wrong door',
      detail:
        'The bouquet for my mother was left at number 20 instead of number 2. She found it four hours later and it had been in the sun. Can something be done?',
    },
    {
      subject: 'Can I move my workshop place to the following Saturday?',
      detail:
        'I am booked on the wreath workshop this Saturday but I have to be out of town. Is there space the week after, or can somebody take my place?',
    },
    {
      subject: 'Standing order — skip next week',
      detail:
        "The café is closed for a refit all next week, so please do not make up Tuesday's arrangements. Back to normal the week after.",
    },
    {
      subject: 'The peace lily has gone yellow',
      detail:
        'Bought it a fortnight ago and three leaves have gone yellow at the edges. I have been watering it every other day. Am I doing something wrong?',
    },
  ],
};
