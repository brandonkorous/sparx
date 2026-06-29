// Wholesale sample pack — a janitorial & packaging supply distributor. Data-as-code:
// case/carton/pallet products with real specs + B2B-buyer reviews + MOQ/lead-time Q&A,
// a heavy inventory ledger across two warehouses with two suppliers, six B2B buyers
// (hotel group, school district, restaurant chain, property manager, hospital, gym)
// who drive the engine's quotes + deals, buyer-facing articles (net-30 terms, reorder
// forecasting, bulk vs JIT), and a Facility Starter Pallet bundle. The wholesale demo:
// stocked-deep, sold-by-the-case, sourced-from-a-supplier, quoted-to-an-account.

import { doc, h2, ol, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const wholesalePack: SampleDataPack = {
  industry: 'wholesale',
  label: 'Wholesale & distribution',
  summary:
    'A janitorial & packaging supply distributor: a deep case/pallet catalog, B2B accounts with net terms, quotes and deals, two warehouses with supplier purchasing, verified buyer reviews, and bulk-buying guides.',

  warehouses: [
    {
      key: 'DC1',
      code: 'DC1',
      name: 'Central Distribution Center',
      type: 'owned',
      city: 'Columbus',
      region: 'OH',
    },
    {
      key: 'DC2',
      code: 'DC2-3PL',
      name: 'Southeast 3PL',
      type: '3pl',
      city: 'Atlanta',
      region: 'GA',
    },
  ],

  suppliers: [
    {
      code: 'KIMBERLY',
      name: 'Kimberly Paper & Tissue Co.',
      paymentTerms: 'net30',
      leadTimeDays: 10,
      city: 'Neenah',
      region: 'WI',
      variantKeys: ['PT-MF-CS16', 'TL-33-CS250', 'TL-55-CS100', 'BOX-MED-BDL25'],
    },
    {
      code: 'PROCHEM',
      name: 'ProChem Industrial Supply',
      paymentTerms: 'net45',
      leadTimeDays: 18,
      city: 'Memphis',
      region: 'TN',
      variantKeys: [
        'GLV-NIT-M-CS10',
        'GLV-NIT-L-CS10',
        'SOAP-GAL-CS4',
        'DIS-GAL-CS4',
        'FC-GAL-CS4',
      ],
    },
  ],

  lots: [
    {
      variantKey: 'DIS-GAL-CS4',
      warehouseKey: 'DC1',
      lotNumber: 'DIS-2026-0418',
      quantity: 220,
      expiresInDays: 540,
      hazmatClass: 'class8',
    },
    {
      variantKey: 'SOAP-GAL-CS4',
      warehouseKey: 'DC1',
      lotNumber: 'SOAP-2026-0391',
      quantity: 180,
      expiresInDays: 720,
    },
    {
      variantKey: 'FC-GAL-CS4',
      warehouseKey: 'DC2',
      lotNumber: 'FC-2025-7712',
      quantity: 96,
      expiresInDays: 365,
      hazmatClass: 'class8',
    },
    {
      variantKey: 'GLV-NIT-M-CS10',
      warehouseKey: 'DC1',
      lotNumber: 'NIT-2025-1188',
      quantity: 40,
      recall:
        'Lot notice: pinhole defect reported on a single carton run — quarantined pending QA.',
    },
  ],

  categories: [
    { key: 'chemicals', name: 'Cleaning Chemicals', handle: 'cleaning-chemicals' },
    { key: 'paper', name: 'Paper & Disposables', handle: 'paper-disposables' },
    { key: 'packaging', name: 'Packaging', handle: 'packaging' },
    { key: 'safety', name: 'Safety', handle: 'safety' },
    { key: 'liners', name: 'Can Liners', handle: 'can-liners' },
    { key: 'equipment', name: 'Equipment', handle: 'equipment' },
  ],

  collections: [
    { key: 'best-sellers', name: 'Best Sellers', handle: 'best-sellers', featured: true },
    { key: 'bulk-deals', name: 'Bulk Deals', handle: 'bulk-deals' },
    { key: 'new', name: 'New', handle: 'new' },
  ],

  personas: [
    {
      key: 'harlan',
      name: 'Harlan Pace',
      email: 'harlan.pace@meridianhotels',
      kind: 'b2b',
      company: 'Meridian Hotel Group',
      phone: '+1-614-555-0142',
      line1: '4400 Easton Loop W',
      city: 'Columbus',
      region: 'OH',
      postalCode: '43219',
    },
    {
      key: 'denise',
      name: 'Denise Okafor',
      email: 'denise.okafor@unifiedschools',
      kind: 'b2b',
      company: 'Unified School District 211',
      phone: '+1-913-555-0188',
      line1: '900 Education Blvd',
      city: 'Overland Park',
      region: 'KS',
      postalCode: '66210',
    },
    {
      key: 'victor',
      name: 'Victor Almeida',
      email: 'victor.almeida@coastlinedining',
      kind: 'b2b',
      company: 'Coastline Dining Group',
      phone: '+1-305-555-0119',
      line1: '1820 Biscayne Commerce Dr',
      city: 'Miami',
      region: 'FL',
      postalCode: '33137',
    },
    {
      key: 'rhonda',
      name: 'Rhonda Steele',
      email: 'rhonda.steele@keystoneprop',
      kind: 'b2b',
      company: 'Keystone Property Management',
      phone: '+1-412-555-0173',
      line1: '550 Liberty Center',
      city: 'Pittsburgh',
      region: 'PA',
      postalCode: '15222',
    },
    {
      key: 'samuel',
      name: 'Samuel Tran',
      email: 'samuel.tran@stbenedicthealth',
      kind: 'b2b',
      company: 'St. Benedict Health Network',
      phone: '+1-503-555-0156',
      line1: '1200 Marquam Hill Rd',
      city: 'Portland',
      region: 'OR',
      postalCode: '97239',
    },
    {
      key: 'aisha',
      name: 'Aisha Bello',
      email: 'aisha.bello@apexfitness',
      kind: 'b2b',
      company: 'Apex Fitness Clubs',
      phone: '+1-602-555-0124',
      line1: '3300 Camelback Commerce Park',
      city: 'Phoenix',
      region: 'AZ',
      postalCode: '85016',
    },
  ],

  products: [
    {
      key: 'nitrile-gloves',
      title: 'Nitrile Exam Gloves — Powder-Free (Case of 1,000)',
      handle: 'nitrile-exam-gloves-powder-free-case',
      description:
        '<p>Powder-free, 4-mil nitrile gloves built for back-of-house and facility crews who burn through boxes by the carton. Textured fingertips for wet grip, latex-free for allergen-safe kitchens and clinics, and a beaded cuff that resists roll-down through a full shift.</p><p><strong>Case pack:</strong> 10 dispenser boxes of 100 (1,000 gloves per case). Ambidextrous. AQL 1.5. Choose your size — most facilities stock a 60/40 split of Medium to Large.</p><p><strong>Who buys it:</strong> hotels, restaurants, schools, property crews, and clinics standardizing on one disposable glove across every department.</p>',
      productType: 'Safety',
      vendor: 'GuardTouch',
      tags: ['nitrile gloves', 'powder-free', 'ppe', 'case', 'foodservice'],
      seoTitle: 'Nitrile Exam Gloves Powder-Free — Wholesale Case of 1,000',
      seoDescription:
        'Powder-free 4-mil nitrile gloves by the case. Latex-free, textured grip — bulk pricing for facilities, foodservice, and clinics.',
      categoryKeys: ['safety'],
      collectionKeys: ['best-sellers', 'bulk-deals'],
      variants: [
        {
          sku: 'GLV-NIT-M-CS10',
          title: 'Medium — Case of 1,000',
          priceCents: 7499,
          costCents: 4200,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 120,
              reorderQuantity: 480,
              leadTimeDays: 18,
              movements: [
                { delta: 640, reason: 'receive', daysAgo: 26 },
                { delta: -120, reason: 'sale', daysAgo: 11 },
                { delta: -88, reason: 'sale', daysAgo: 4 },
                { delta: -4, reason: 'recount', daysAgo: 1 },
              ],
            },
            {
              warehouseKey: 'DC2',
              reorderPoint: 60,
              reorderQuantity: 240,
              movements: [
                { delta: 300, reason: 'receive', daysAgo: 22 },
                { delta: -64, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
        {
          sku: 'GLV-NIT-L-CS10',
          title: 'Large — Case of 1,000',
          priceCents: 7499,
          costCents: 4200,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 100,
              reorderQuantity: 400,
              leadTimeDays: 18,
              movements: [
                { delta: 520, reason: 'receive', daysAgo: 24 },
                { delta: -96, reason: 'sale', daysAgo: 9 },
                { delta: -60, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Standardized every property on these',
          body: 'We run twelve hotels off one glove now. Consistent fit, no tearing on housekeeping carts. Reordering by the pallet is painless.',
          authorPersona: 'harlan',
          response:
            'Thanks Harlan — happy to set up a standing PO so you never run a property dry.',
          helpfulCount: 12,
          daysAgo: 22,
        },
        {
          rating: 4,
          title: 'Good gloves, watch the size split',
          body: 'Kitchen crew likes the grip. We over-ordered Medium the first time; reorder leaned Large and that fixed it.',
          authorPersona: 'victor',
          helpfulCount: 5,
          daysAgo: 13,
        },
        {
          rating: 5,
          title: 'Latex-free was the deciding factor',
          body: 'Clinic side needed allergen-safe and the price by the case beat our old GPO contract. Easy switch.',
          displayName: 'FacilitiesLead_OR',
          helpfulCount: 4,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'What is the minimum order — can we do a single case or is there a pallet MOQ?',
          authorPersona: 'rhonda',
          answer:
            'Single case is fine for an opening order. Standing accounts usually move to half-pallet (24 cases) for the bracket price — ask us for a quote.',
          daysAgo: 16,
        },
        {
          body: 'Lead time if we order 40 cases for a new building turnover?',
          displayName: 'NewSiteOps',
          status: 'pending',
          daysAgo: 3,
        },
      ],
    },
    {
      key: 'paper-towels',
      title: 'Multifold Paper Towels — 1-Ply (Case of 4,000)',
      handle: 'multifold-paper-towels-case',
      description:
        '<p>High-capacity multifold towels engineered for fold-out dispensers in high-traffic restrooms. One-at-a-time dispense cuts usage and waste versus loose stacks, and the absorbent embossed sheet dries hands in a single pull.</p><p><strong>Case pack:</strong> 16 packs of 250 (4,000 towels per case). Fits standard universal multifold dispensers. 9.25" x 9.4" unfolded.</p><p><strong>Who buys it:</strong> schools, gyms, offices, and any facility running dozens of restroom dispensers around the clock.</p>',
      productType: 'Paper & Disposables',
      vendor: 'Kimberly',
      tags: ['paper towels', 'multifold', 'restroom', 'case', 'disposables'],
      seoTitle: 'Multifold Paper Towels 1-Ply — Wholesale Case of 4,000',
      seoDescription:
        'Universal-fit multifold paper towels by the case. High-capacity, low-waste dispense for high-traffic restrooms.',
      categoryKeys: ['paper'],
      collectionKeys: ['best-sellers', 'bulk-deals'],
      variants: [
        {
          sku: 'PT-MF-CS16',
          title: 'Case of 4,000',
          priceCents: 4299,
          costCents: 2350,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 150,
              reorderQuantity: 600,
              leadTimeDays: 10,
              movements: [
                { delta: 800, reason: 'receive', daysAgo: 28 },
                { delta: -180, reason: 'sale', daysAgo: 12 },
                { delta: -110, reason: 'sale', daysAgo: 5 },
              ],
            },
            {
              warehouseKey: 'DC2',
              reorderPoint: 80,
              reorderQuantity: 320,
              movements: [
                { delta: 420, reason: 'receive', daysAgo: 25 },
                { delta: -96, reason: 'sale', daysAgo: 8 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Cut our towel spend noticeably',
          body: 'Switching the district to multifold from roll cut waste in every restroom. Kids pull one, not a handful.',
          authorPersona: 'denise',
          response:
            'Glad the dispensers paid off — let us know if you want a refill schedule by campus.',
          helpfulCount: 9,
          daysAgo: 19,
        },
        {
          rating: 4,
          title: 'Fits our dispensers fine',
          body: 'Universal fit was accurate, no jamming. One-ply is thin but that is the point for volume.',
          authorPersona: 'aisha',
          helpfulCount: 3,
          daysAgo: 10,
        },
      ],
      questions: [
        {
          body: 'Do these fit the older recessed dispensers, or only the surface-mount ones?',
          authorPersona: 'aisha',
          answer:
            'They fit both — multifold is the universal standard. If your dispensers take C-fold instead, ask us and we will quote the right pack.',
          daysAgo: 14,
        },
      ],
    },
    {
      key: 'trash-liners-33',
      title: 'Trash Can Liners — 33 Gal, 1.5 Mil (Case of 250)',
      handle: 'trash-liners-33-gal-case',
      description:
        '<p>Heavy-duty low-density 33-gallon liners with a star-seal bottom that distributes weight and resists leaks — no gusseted seam to split. The 1.5-mil wall handles wet, sharp, and heavy waste streams without double-bagging.</p><p><strong>Case pack:</strong> 10 rolls of 25 (250 liners per case). 33" x 39", black. Coreless rolls for clean dispense.</p><p><strong>Who buys it:</strong> offices, schools, and property crews on a daily can-change cadence.</p>',
      productType: 'Can Liners',
      vendor: 'Kimberly',
      tags: ['trash liners', 'can liners', '33 gallon', 'star-seal', 'case'],
      seoTitle: 'Trash Can Liners 33 Gal 1.5 Mil — Wholesale Case of 250',
      seoDescription:
        'Star-seal 33-gallon low-density can liners by the case. Leak-resistant, no double-bagging — bulk facility pricing.',
      categoryKeys: ['liners'],
      collectionKeys: ['best-sellers'],
      variants: [
        {
          sku: 'TL-33-CS250',
          title: 'Case of 250',
          priceCents: 3299,
          costCents: 1750,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 100,
              reorderQuantity: 400,
              leadTimeDays: 10,
              movements: [
                { delta: 560, reason: 'receive', daysAgo: 27 },
                { delta: -130, reason: 'sale', daysAgo: 11 },
                { delta: -75, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'No more split bags',
          body: 'Star-seal is the difference. Our old liners gusset-split and leaked in the cart. These do not.',
          authorPersona: 'rhonda',
          helpfulCount: 6,
          daysAgo: 18,
        },
        {
          rating: 4,
          title: 'Solid for the price',
          body: '1.5 mil is right for daily office trash. Coreless rolls dispense clean off the cart.',
          displayName: 'JanitorialBuyer',
          helpfulCount: 2,
          daysAgo: 9,
        },
      ],
      questions: [
        {
          body: 'What is your lead time and freight policy on a 30-case standing order?',
          authorPersona: 'rhonda',
          answer:
            'Ten business days from DC1, and freight is free over $750 on a single delivery — a 30-case order clears that easily.',
          daysAgo: 12,
        },
      ],
    },
    {
      key: 'trash-liners-55',
      title: 'Trash Can Liners — 55 Gal, 2.0 Mil (Case of 100)',
      handle: 'trash-liners-55-gal-case',
      description:
        '<p>Contractor-grade 55-gallon liners for drum cans, dock waste, and event cleanup. The 2.0-mil wall and star-seal bottom take heavy, jagged, and wet loads that tear lighter bags. Sized to line a full 55-gallon barrel with cuff to spare.</p><p><strong>Case pack:</strong> 4 rolls of 25 (100 liners per case). 38" x 58", black.</p><p><strong>Who buys it:</strong> restaurants, hospitals, and property crews handling large-can and back-of-house waste.</p>',
      productType: 'Can Liners',
      vendor: 'Kimberly',
      tags: ['trash liners', 'can liners', '55 gallon', 'contractor', 'case'],
      categoryKeys: ['liners'],
      collectionKeys: ['bulk-deals'],
      variants: [
        {
          sku: 'TL-55-CS100',
          title: 'Case of 100',
          priceCents: 4599,
          costCents: 2500,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 60,
              reorderQuantity: 240,
              leadTimeDays: 10,
              movements: [
                { delta: 320, reason: 'receive', daysAgo: 30 },
                { delta: -84, reason: 'sale', daysAgo: 10 },
                { delta: -40, reason: 'sale', daysAgo: 3 },
              ],
            },
            {
              warehouseKey: 'DC2',
              movements: [{ delta: 120, reason: 'receive', daysAgo: 21 }],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Take the abuse',
          body: 'Dock crew loads broken pallets and glass into these and they hold. 2-mil is worth the extra few cents.',
          authorPersona: 'samuel',
          helpfulCount: 7,
          daysAgo: 15,
        },
      ],
      questions: [],
    },
    {
      key: 'hand-soap',
      title: 'Foaming Hand Soap — Gallon Refill (Case of 4)',
      handle: 'foaming-hand-soap-gallon-case',
      description:
        '<p>Concentrated foaming hand soap in bulk gallon refills — pour-and-go for any open dispenser, no proprietary cartridge lock-in. A mild, dye-free formula that lathers fast and rinses clean, gentle enough for the dozens of washes a foodservice or clinic shift demands.</p><p><strong>Case pack:</strong> 4 one-gallon jugs. One gallon refills a 1,000-mL dispenser roughly four times.</p><p><strong>Who buys it:</strong> restaurants, schools, gyms, and clinics standardizing restroom and kitchen soap across sites.</p>',
      productType: 'Cleaning Chemicals',
      vendor: 'ProChem',
      tags: ['hand soap', 'foaming', 'gallon', 'refill', 'case'],
      seoTitle: 'Foaming Hand Soap Gallon Refill — Wholesale Case of 4',
      seoDescription:
        'Bulk foaming hand soap in gallon refills, 4 per case. Dye-free, dispenser-agnostic — facility pricing.',
      categoryKeys: ['chemicals'],
      collectionKeys: ['best-sellers'],
      variants: [
        {
          sku: 'SOAP-GAL-CS4',
          title: 'Case of 4 Gallons',
          priceCents: 3899,
          costCents: 2050,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 80,
              reorderQuantity: 320,
              leadTimeDays: 18,
              movements: [
                { delta: 400, reason: 'receive', daysAgo: 25 },
                { delta: -96, reason: 'sale', daysAgo: 9 },
                { delta: -60, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'No cartridge lock-in',
          body: 'We ditched the proprietary-cartridge system. Gallon refills into open dispensers cost a third as much.',
          authorPersona: 'victor',
          response: 'That switch saves our restaurant accounts the most — glad it landed.',
          helpfulCount: 8,
          daysAgo: 17,
        },
        {
          rating: 4,
          title: 'Mild, good lather',
          body: 'Staff with sensitive skin stopped complaining after we moved to the dye-free formula.',
          authorPersona: 'samuel',
          helpfulCount: 3,
          daysAgo: 8,
        },
      ],
      questions: [
        {
          body: 'Is this compatible with our existing wall dispensers or do we need new ones?',
          authorPersona: 'victor',
          answer:
            'Any open/refillable foaming dispenser works — just pour. If yours only takes sealed cartridges, ask us about a low-cost open-dispenser swap.',
          daysAgo: 13,
        },
      ],
    },
    {
      key: 'disinfectant',
      title: 'Disinfectant Cleaner Concentrate — Gallon (Case of 4)',
      handle: 'disinfectant-cleaner-concentrate-case',
      description:
        '<p>Hospital-grade quaternary disinfectant concentrate — one gallon dilutes to dozens of ready-to-use gallons at the trigger bottle. EPA-registered, kills the bacteria and viruses on a standard facility kill list, and doubles as a one-step cleaner-disinfectant for hard surfaces.</p><p><strong>Case pack:</strong> 4 one-gallon concentrate jugs. Dilution ~1:64 for general use; see the label for contact times.</p><p><strong>Who buys it:</strong> hospitals, schools, gyms, and hotels running daily high-touch disinfection.</p>',
      productType: 'Cleaning Chemicals',
      vendor: 'ProChem',
      tags: ['disinfectant', 'concentrate', 'gallon', 'epa-registered', 'case'],
      hazmatClass: 'class8',
      categoryKeys: ['chemicals'],
      collectionKeys: ['best-sellers', 'new'],
      variants: [
        {
          sku: 'DIS-GAL-CS4',
          title: 'Case of 4 Gallons',
          priceCents: 5499,
          costCents: 2950,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 70,
              reorderQuantity: 280,
              leadTimeDays: 18,
              movements: [
                { delta: 360, reason: 'receive', daysAgo: 23 },
                { delta: -88, reason: 'sale', daysAgo: 8 },
                { delta: -52, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Dilutes way down',
          body: 'One gallon makes 64 at the bottle. Our cost-per-use dropped hard versus ready-to-use sprays.',
          authorPersona: 'samuel',
          helpfulCount: 10,
          daysAgo: 16,
        },
        {
          rating: 4,
          title: 'On our kill-list',
          body: 'Checked the EPA registration against our infection-control list and it covers what we need.',
          displayName: 'EVSManager',
          status: 'pending',
          helpfulCount: 2,
          daysAgo: 4,
        },
      ],
      questions: [
        {
          body: 'Do you provide the SDS and EPA master label for our compliance binder?',
          authorPersona: 'samuel',
          answer:
            'Yes — the SDS and master label download from the product page, and we email a packet with every first shipment to a new account.',
          daysAgo: 11,
        },
      ],
    },
    {
      key: 'stretch-wrap',
      title: 'Stretch Wrap Film — 18" x 1,500 ft (Case of 4 Rolls)',
      handle: 'stretch-wrap-film-18in-case',
      description:
        '<p>80-gauge hand stretch film for palletizing and load containment. High cling locks loads without tails, and the pre-stretched blend yields more wrap per pound so a case goes further than the spec suggests. Clear, so labels and contents stay readable on the dock.</p><p><strong>Case pack:</strong> 4 rolls, 18" x 1,500 ft each. Fits standard hand dispensers.</p><p><strong>Who buys it:</strong> warehouses, restaurants, and property crews shipping or staging palletized goods.</p>',
      productType: 'Packaging',
      vendor: 'PackRight',
      tags: ['stretch wrap', 'pallet wrap', 'film', 'shipping', 'case'],
      categoryKeys: ['packaging'],
      collectionKeys: ['bulk-deals'],
      variants: [
        {
          sku: 'SW-18-CS4',
          title: 'Case of 4 Rolls',
          priceCents: 4999,
          costCents: 2700,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 50,
              reorderQuantity: 200,
              leadTimeDays: 12,
              movements: [
                { delta: 240, reason: 'receive', daysAgo: 29 },
                { delta: -56, reason: 'sale', daysAgo: 10 },
                { delta: -28, reason: 'sale', daysAgo: 3 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Cling is real',
          body: 'No tails, no flapping on the truck. Pallets arrive tight. Buying it by the case made the math obvious.',
          authorPersona: 'harlan',
          helpfulCount: 4,
          daysAgo: 14,
        },
      ],
      questions: [
        {
          body: 'Can we get a machine-grade roll for our wrapper, or is this hand-grade only?',
          displayName: 'DCSupervisor',
          answer:
            'This SKU is hand-grade. We stock machine-grade in 20" x 5,000 ft — ask us for a quote and we will add it to your catalog.',
          daysAgo: 9,
        },
      ],
    },
    {
      key: 'shipping-boxes',
      title: 'Corrugated Shipping Boxes — 12x12x12 (Bundle of 25)',
      handle: 'corrugated-shipping-boxes-12x12x12',
      description:
        '<p>200-lb-test, 32-ECT single-wall corrugated boxes — the workhorse cube for shipping, storage, and move-outs. Ships flat to save space and assembles into a square, stackable cube that protects edges and holds in a stack.</p><p><strong>Case pack:</strong> bundle of 25, shipped flat. 12" x 12" x 12" inside dimensions. Kraft brown.</p><p><strong>Who buys it:</strong> property managers handling turnovers, restaurants storing dry goods, and any account that ships or stores by the box.</p>',
      productType: 'Packaging',
      vendor: 'PackRight',
      tags: ['shipping boxes', 'corrugated', 'cardboard', '12x12x12', 'bundle'],
      categoryKeys: ['packaging'],
      collectionKeys: ['new'],
      variants: [
        {
          sku: 'BOX-MED-BDL25',
          title: 'Bundle of 25',
          priceCents: 2899,
          costCents: 1500,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 90,
              reorderQuantity: 360,
              leadTimeDays: 10,
              movements: [
                { delta: 480, reason: 'receive', daysAgo: 31 },
                { delta: -110, reason: 'sale', daysAgo: 9 },
                { delta: -64, reason: 'sale', daysAgo: 3 },
              ],
            },
            {
              warehouseKey: 'DC2',
              movements: [{ delta: 200, reason: 'receive', daysAgo: 20 }],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 4,
          title: 'Sturdy cube',
          body: '32-ECT holds in a stack. We use them for unit turnovers and they survive the dolly.',
          authorPersona: 'rhonda',
          helpfulCount: 3,
          daysAgo: 12,
        },
      ],
      questions: [],
    },
    {
      key: 'packing-tape',
      title: 'Packing Tape — 2" x 110 yd, 2.0 Mil (Case of 36)',
      handle: 'packing-tape-2in-case',
      description:
        '<p>2.0-mil acrylic carton-sealing tape that holds its grip across temperature swings — cold docks to hot trailers — without the yellowing or release that kills cheaper hot-melt tape in storage. Clear, quiet off the roll, and sized to fit any standard 2" dispenser.</p><p><strong>Case pack:</strong> 36 rolls, 2" x 110 yd each.</p><p><strong>Who buys it:</strong> warehouses, restaurants, and offices that seal cartons daily.</p>',
      productType: 'Packaging',
      vendor: 'PackRight',
      tags: ['packing tape', 'carton tape', 'acrylic', 'shipping', 'case'],
      categoryKeys: ['packaging'],
      collectionKeys: ['bulk-deals'],
      variants: [
        {
          sku: 'TAPE-2-CS36',
          title: 'Case of 36 Rolls',
          priceCents: 3399,
          costCents: 1800,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 70,
              reorderQuantity: 280,
              leadTimeDays: 12,
              movements: [
                { delta: 360, reason: 'receive', daysAgo: 26 },
                { delta: -82, reason: 'sale', daysAgo: 8 },
                { delta: -44, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Holds in the cold dock',
          body: 'Acrylic was the right call — hot-melt let go in our cold storage. These seal and stay.',
          authorPersona: 'samuel',
          helpfulCount: 5,
          daysAgo: 11,
        },
        {
          rating: 4,
          title: 'Quiet and clear',
          body: 'Less ear-splitting than the cheap stuff and the clear hides nicely on kraft. Case price is fair.',
          displayName: 'ShippingClerk',
          helpfulCount: 1,
          daysAgo: 6,
        },
      ],
      questions: [
        {
          body: 'Whats the MOQ to get the bracket price — one case or do we need to combine SKUs?',
          authorPersona: 'victor',
          answer:
            'Bracket pricing kicks in at 6 cases of tape, or you can hit it by combining packaging SKUs on one order. Either way we will quote it.',
          daysAgo: 10,
        },
      ],
    },
    {
      key: 'floor-cleaner',
      title: 'Neutral Floor Cleaner Concentrate — Gallon (Case of 4)',
      handle: 'neutral-floor-cleaner-concentrate-case',
      description:
        '<p>pH-neutral floor cleaner concentrate safe for finished floors, sealed concrete, tile, and LVT — no dulling, no film, no rinse required on most surfaces. One gallon dilutes to dozens of mop buckets, and the low-foam formula plays nice with auto-scrubbers.</p><p><strong>Case pack:</strong> 4 one-gallon concentrate jugs. Dilution ~2 oz per gallon of water for daily mopping.</p><p><strong>Who buys it:</strong> schools, hotels, gyms, and property crews running large finished-floor areas.</p>',
      productType: 'Cleaning Chemicals',
      vendor: 'ProChem',
      tags: ['floor cleaner', 'neutral', 'concentrate', 'auto-scrubber', 'case'],
      hazmatClass: 'class8',
      categoryKeys: ['chemicals'],
      collectionKeys: ['new'],
      variants: [
        {
          sku: 'FC-GAL-CS4',
          title: 'Case of 4 Gallons',
          priceCents: 4299,
          costCents: 2250,
          stock: [
            {
              warehouseKey: 'DC1',
              reorderPoint: 60,
              reorderQuantity: 240,
              leadTimeDays: 18,
              movements: [
                { delta: 280, reason: 'receive', daysAgo: 24 },
                { delta: -68, reason: 'sale', daysAgo: 9 },
                { delta: -36, reason: 'sale', daysAgo: 3 },
              ],
            },
            {
              warehouseKey: 'DC2',
              reorderPoint: 30,
              reorderQuantity: 120,
              movements: [
                { delta: 160, reason: 'receive', daysAgo: 19 },
                { delta: -24, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'No film on the LVT',
          body: 'Our finished lobby floors stay clear, no haze. Low-foam works fine in the scrubber. Buying the concentrate by the case is the only way.',
          authorPersona: 'harlan',
          helpfulCount: 6,
          daysAgo: 13,
        },
        {
          rating: 4,
          title: 'Neutral and safe',
          body: 'Safe on every floor type in the district so we only stock one cleaner now. Dilution is generous.',
          authorPersona: 'denise',
          helpfulCount: 3,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Can we set up auto-reorder so we never run a campus dry mid-semester?',
          authorPersona: 'denise',
          answer:
            'Yes — we will set reorder points per ship-to and trigger a PO automatically. Most districts run it as a standing monthly delivery.',
          daysAgo: 12,
        },
      ],
    },
    {
      key: 'facility-starter-pallet',
      title: 'Facility Starter Pallet',
      handle: 'facility-starter-pallet',
      description:
        '<p>Everything a new site needs to open the doors, on one pallet at one price: a case of nitrile gloves, multifold paper towels, 33-gallon can liners, and foaming hand soap. Built for property turnovers, new-location openings, and onboarding a fresh account — skip the line-by-line cart and order the whole opening kit.</p><p>Priced below the sum of its cases. Swap the glove size at checkout.</p>',
      productType: 'Bundle',
      vendor: 'House Pallet',
      tags: ['starter pallet', 'bundle', 'facility', 'opening order'],
      categoryKeys: ['paper'],
      collectionKeys: ['best-sellers', 'bulk-deals'],
      variants: [{ sku: 'PALLET-FACILITY-START', title: null, priceCents: 17999, costCents: 9800 }],
      reviews: [
        {
          rating: 5,
          title: 'Opened a new building off one order',
          body: 'New property, one pallet, done. Saved our ops team an afternoon of building a cart and beat buying the cases separately.',
          authorPersona: 'rhonda',
          response: 'Exactly what we built it for — congrats on the new building, Rhonda.',
          helpfulCount: 7,
          daysAgo: 10,
        },
      ],
      questions: [
        {
          body: 'Can we swap the soap for the disinfectant in this pallet?',
          authorPersona: 'samuel',
          answer:
            'The soap line is swappable at checkout. If you want a custom standing pallet (disinfectant, floor cleaner, etc.) we will quote one for your account.',
          daysAgo: 8,
        },
      ],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'facility-starter-pallet',
      pricing: { mode: 'percent', percentOff: 15 },
      inventoryMode: 'components',
      components: [
        { productKey: 'nitrile-gloves', quantity: 1, required: true },
        { productKey: 'paper-towels', quantity: 2, required: true },
        { productKey: 'trash-liners-33', quantity: 2, required: true },
        { productKey: 'hand-soap', quantity: 1, required: false, swappable: true },
      ],
    },
  ],

  articles: [
    {
      slug: 'setting-up-net-30-terms',
      title: 'Setting up net-30 terms with your distributor',
      excerpt:
        'How a wholesale account actually opens credit — what we ask for, how fast it clears, and how to keep the terms once you have them.',
      daysAgo: 6,
      body: doc(
        p(
          'For most facilities, net-30 terms are the difference between a smooth purchasing cycle and a month of credit-card friction. Opening terms with a distributor is straightforward once you know what they need from you.'
        ),
        h2('What we ask for'),
        ul(
          'A completed credit application with your EIN and ownership info',
          'Two or three trade references (suppliers you already pay on terms)',
          'A bank reference, and sometimes a recent financial statement for larger lines',
          'The ship-to and bill-to addresses, plus an AP contact for invoices'
        ),
        h2('How fast it clears'),
        p(
          'A clean application with reachable references usually clears in two to three business days. While it processes, you can place an opening order on a card or COD so your sites are not waiting on paperwork.'
        ),
        h2('Keeping your terms'),
        p(
          'Pay inside the window. A net-30 line is a relationship, not a right — consistent on-time payment is what unlocks higher limits, longer terms, and the bracket pricing that comes with volume. If a payment will be late, call your rep before the due date; a heads-up keeps the line open.'
        )
      ),
    },
    {
      slug: 'forecasting-reorder-points',
      title: 'How to forecast reorder points for facility supplies',
      excerpt:
        'A simple way to set the trigger level for every SKU so you reorder before you run out — without drowning in safety stock.',
      daysAgo: 14,
      body: doc(
        p(
          'Running out of can liners on a Friday is expensive; sitting on a year of stretch wrap ties up cash and floor space. The reorder point is the number that keeps you between those two failures.'
        ),
        h2('The formula'),
        p(
          'A reorder point is just your usage during the lead time, plus a safety buffer. Track three numbers per SKU and the rest is arithmetic:'
        ),
        ol(
          'Average daily usage — total cases consumed over a period, divided by the days',
          'Lead time — how many days from PO to receiving (ask your distributor per SKU)',
          'Safety stock — a buffer for demand spikes and late deliveries, often a few days of usage'
        ),
        p(
          'Reorder point = (average daily usage × lead-time days) + safety stock. When on-hand drops to that number, cut the PO.'
        ),
        h2('Tune it over time'),
        p(
          'Start conservative, then watch how often you actually hit the trigger. If you reorder and still have weeks of cushion, your safety stock is too high. If you scramble, raise it. Seasonal accounts — schools, resorts — should set different points for peak and off-peak.'
        )
      ),
    },
    {
      slug: 'bulk-buying-vs-just-in-time',
      title: 'Bulk buying vs. just-in-time: which is right for your facility?',
      excerpt:
        'Pallet pricing is tempting, but every case on your shelf is cash you cannot spend. Here is how to decide where each SKU lands.',
      daysAgo: 21,
      body: doc(
        p(
          'Every purchasing manager feels the pull of the pallet price. Buying deep cuts the per-unit cost and the freight per case — but it also parks cash on a shelf and bets that you will use it before it ages out. The right answer is usually different for different SKUs.'
        ),
        h2('Buy in bulk when'),
        ul(
          'The item is non-perishable and turns predictably (liners, towels, tape)',
          'The bracket discount and freight savings beat your cost of carrying the stock',
          'You have the storage and the demand is steady, not seasonal'
        ),
        h2('Stay just-in-time when'),
        ul(
          'The product has a shelf life or a recall risk (some chemicals, dated stock)',
          'Demand is lumpy or you are still learning a new site usage rate',
          'Storage is tight or cash is the binding constraint this quarter'
        ),
        h2('The hybrid most facilities land on'),
        p(
          'Buy your steady, shelf-stable A-items by the pallet on a standing schedule, and keep your variable or perishable items on a just-in-time reorder point. Set the reorder triggers with your distributor so the bulk SKUs auto-PO and the JIT SKUs only move when usage says so. That gets you the bracket price where it pays and the cash flexibility where it counts.'
        )
      ),
    },
  ],
};
