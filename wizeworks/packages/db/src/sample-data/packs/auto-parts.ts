// Auto-parts sample pack — a diesel truck-parts shop (the Gillett anchor vertical,
// here as one industry among many). Data-as-code: rich products with real specs +
// reviews + Q&A, a full inventory ledger across two warehouses with suppliers/POs,
// fleet-operator buyers, service-bay scheduling, maintenance guides, a kit bundle,
// and a tuner configurator. Loading it tells the whole cross-module story — a
// product that's stocked, reviewed (verified against a real fleet order), bundled,
// and sourced from a PO.
//
// Pairs with the `auto-parts` industry STARTER (Wave 3), which installs the config
// (tax/shipping/fitment/markup); this pack brings the catalog + activity.

import { doc, h2, p, ul } from '../engine/prose';
import type { SampleDataPack } from '../types';

export const autoPartsPack: SampleDataPack = {
  industry: 'auto-parts',
  label: 'Auto parts & accessories',
  summary:
    'A diesel truck-parts shop: a stocked catalog with fitment, fleet customers, orders + returns, verified reviews, service-bay appointments, suppliers + purchase orders, and maintenance guides.',

  warehouses: [
    {
      key: 'MAIN',
      code: 'MAIN',
      name: 'Main Warehouse',
      type: 'owned',
      city: 'West Valley City',
      region: 'UT',
    },
    {
      key: 'WEST',
      code: 'WEST-3PL',
      name: 'West Coast 3PL',
      type: '3pl',
      city: 'Reno',
      region: 'NV',
    },
  ],

  suppliers: [
    {
      code: 'BOSCH',
      name: 'Bosch Diesel Supply',
      paymentTerms: 'net30',
      leadTimeDays: 7,
      city: 'Charleston',
      region: 'SC',
      variantKeys: ['INJ-67C-REMAN', 'INJ-67C-NEW', 'GP-60-SET8'],
    },
    {
      code: 'STAN',
      name: 'Stanadyne Distribution',
      paymentTerms: 'net45',
      leadTimeDays: 14,
      city: 'Windsor',
      region: 'CT',
      variantKeys: ['FF-67-STD', 'FF-67-OEM', 'BELT-73'],
    },
  ],

  lots: [
    {
      variantKey: 'OIL-15W40-1G',
      warehouseKey: 'MAIN',
      lotNumber: 'ROT-2026-0418',
      quantity: 480,
      expiresInDays: 540,
      hazmatClass: 'class9',
    },
    {
      variantKey: 'OIL-15W40-1G',
      warehouseKey: 'WEST',
      lotNumber: 'ROT-2026-0392',
      quantity: 240,
      expiresInDays: 300,
      hazmatClass: 'class9',
    },
    {
      variantKey: 'COOL-HD-1G',
      warehouseKey: 'MAIN',
      lotNumber: 'FG-COOL-2025-7731',
      quantity: 120,
      expiresInDays: 120,
      hazmatClass: 'class9',
    },
    {
      variantKey: 'GP-60-SET8',
      warehouseKey: 'MAIN',
      lotNumber: 'MC-GP60-2025-1188',
      quantity: 28,
      recall: 'Supplier notice: ceramic tip may crack on cold-start cycling.',
    },
  ],

  categories: [
    { key: 'filters', name: 'Filters', handle: 'filters' },
    { key: 'fuel-system', name: 'Fuel System', handle: 'fuel-system' },
    { key: 'cooling', name: 'Cooling', handle: 'cooling' },
    { key: 'forced-induction', name: 'Forced Induction', handle: 'forced-induction' },
    { key: 'fluids', name: 'Fluids', handle: 'fluids' },
    { key: 'belts', name: 'Belts & Hoses', handle: 'belts-hoses' },
    { key: 'ignition', name: 'Ignition & Glow', handle: 'ignition-glow' },
  ],

  collections: [
    { key: 'best-sellers', name: 'Best Sellers', handle: 'best-sellers', featured: true },
    { key: 'new-arrivals', name: 'New Arrivals', handle: 'new-arrivals' },
    { key: 'shop-fluids', name: 'Shop Fluids & Chemicals', handle: 'shop-fluids' },
  ],

  // What a parts business keeps about a buyer beyond the order history
  // (docs/144 §3) — the things that decide whether the right part turns up.
  recordTypes: [
    {
      objectKey: 'contact',
      properties: [
        {
          key: 'accountKind',
          label: 'What kind of buyer',
          type: 'enum',
          helpText: 'Sets the tone, the pricing conversation, and the paperwork.',
          options: [
            { value: 'fleet', label: 'Runs a fleet' },
            { value: 'independent_shop', label: 'Independent shop' },
            { value: 'dealer', label: 'Dealer' },
            { value: 'owner_operator', label: 'Owner-operator' },
            { value: 'diy', label: 'Doing it themselves' },
          ],
        },
        {
          key: 'preferredBrands',
          label: 'Brands they ask for',
          type: 'text',
          helpText: 'What they will and will not accept a substitute for.',
        },
        {
          key: 'willingToTakeReman',
          label: 'Takes remanufactured parts',
          type: 'boolean',
          helpText: 'Off means quote new only — do not offer them a reman core.',
        },
      ],
    },
    {
      objectKey: 'company',
      properties: [
        {
          key: 'shopHours',
          label: 'When their shop is open',
          type: 'text',
          helpText: 'When a delivery will actually be received.',
        },
        {
          key: 'downtimeCostPerDay',
          label: 'What a day off the road costs them',
          type: 'currency',
          currency: 'USD',
          helpText: 'The number behind every rush-order conversation.',
        },
      ],
    },
    {
      objectKey: 'deal',
      properties: [
        {
          key: 'unitDown',
          label: 'Which unit is down',
          type: 'text',
          helpText: 'The truck or machine waiting on this. Blank means nothing is stopped.',
        },
      ],
    },
  ],

  personas: [
    {
      key: 'marcus',
      name: 'Marcus Bell',
      email: 'marcus.bell@fleetlogix',
      kind: 'b2b',
      company: 'FleetLogix',
      phone: '+1-208-555-0142',
      line1: '1840 Industrial Pkwy',
      city: 'Boise',
      region: 'ID',
      postalCode: '83702',
      properties: {
        accountKind: 'fleet',
        preferredBrands: 'Bosch and Delphi for injection. Will not take aftermarket turbos.',
        willingToTakeReman: true,
      },
      companyProperties: {
        shopHours: 'Yard open 5am–7pm weekdays, 7am–noon Saturday.',
        downtimeCostPerDay: { amount: 1450, currency: 'USD' },
      },
    },
    {
      key: 'dana',
      name: 'Dana Whitfield',
      email: 'dana.whitfield',
      phone: '+1-509-555-0188',
      line1: '67 Cedar Hollow Rd',
      city: 'Spokane',
      region: 'WA',
      postalCode: '99201',
      properties: {
        accountKind: 'diy',
        preferredBrands: 'Whatever fits — asks for the cheapest that is not junk.',
        willingToTakeReman: true,
      },
    },
    {
      key: 'rafael',
      name: 'Rafael Ortiz',
      email: 'rafael.ortiz@haulpro',
      kind: 'b2b',
      company: 'HaulPro',
      phone: '+1-505-555-0119',
      line1: '2204 Mesa Verde Blvd',
      city: 'Albuquerque',
      region: 'NM',
      postalCode: '87102',
      properties: {
        accountKind: 'fleet',
        preferredBrands: 'OEM only on anything emissions-related.',
        willingToTakeReman: false,
      },
    },
    {
      key: 'priya',
      name: 'Priya Nair',
      email: 'priya.nair',
      phone: '+1-512-555-0173',
      line1: '915 Lakeline Dr',
      city: 'Austin',
      region: 'TX',
      postalCode: '78717',
      properties: {
        accountKind: 'independent_shop',
        preferredBrands: 'Stocks ACDelco. Happy with reman if the core charge is clear.',
        willingToTakeReman: true,
      },
    },
    {
      key: 'glen',
      name: 'Glen Hartman',
      email: 'glen.hartman@summitfreight',
      kind: 'b2b',
      company: 'SummitFreight',
      phone: '+1-701-555-0156',
      line1: '430 Prairie Ridge Ave',
      city: 'Fargo',
      region: 'ND',
      postalCode: '58103',
      properties: {
        accountKind: 'fleet',
        preferredBrands: 'Standardised on Fleetguard filtration across the yard.',
        willingToTakeReman: true,
      },
    },
    {
      key: 'tessa',
      name: 'Tessa Boone',
      email: 'tessa.boone',
      phone: '+1-615-555-0124',
      line1: '78 Riverbend Ct',
      city: 'Nashville',
      region: 'TN',
      postalCode: '37209',
      properties: {
        accountKind: 'owner_operator',
        preferredBrands: 'No preference — cares about getting it tomorrow, not the badge.',
        willingToTakeReman: true,
      },
    },
  ],

  products: [
    {
      key: 'fuel-filter-67',
      title: 'Fuel Filter — 6.7L Power Stroke',
      handle: 'fuel-filter-67l-power-stroke',
      description:
        '<p>OE-spec fuel/water separator filter for the 2011–2016 6.7L Power Stroke. Captures contaminants down to 4 microns and pulls water out of the fuel before it reaches your high-pressure pump and injectors — the single cheapest insurance against a five-figure fuel-system failure.</p><p>Replace at every oil change or every 15,000 miles, whichever comes first. Fits the frame-mounted housing; the water-in-fuel sensor transfers from your old filter.</p>',
      productType: 'Filters',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'Fits the 2011–2016 6.7L Power Stroke diesel (Ford F-250/F-350/F-450 Super Duty). Mounts in the frame-rail fuel/water separator housing. The water-in-fuel (WIF) sensor is not included — it threads out of your old filter and into this one.',
        specs: [
          { label: 'Filtration', value: '4 micron absolute' },
          { label: 'Type', value: 'Fuel / water separator' },
          { label: 'Service interval', value: 'Every oil change or 15,000 mi' },
          { label: 'Housing', value: 'Frame-mounted, OE-spec' },
          { label: 'WIF sensor', value: 'Reuse existing (transfers over)' },
        ],
        warranty: '12-month / 12,000-mile limited warranty against manufacturing defects.',
      },
      vendor: 'Motorcraft',
      tags: ['fuel filter', 'power stroke', '6.7L', 'maintenance'],
      seoTitle: 'Fuel Filter for 6.7L Power Stroke (2011–2016)',
      seoDescription:
        'OE-spec 4-micron fuel/water separator for the 6.7L Power Stroke. Protects your injectors and HPFP.',
      categoryKeys: ['filters'],
      collectionKeys: ['best-sellers'],
      variants: [
        {
          sku: 'FF-67-STD',
          title: 'Standard',
          priceCents: 4299,
          costCents: 2150,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 24,
              reorderQuantity: 96,
              leadTimeDays: 7,
              movements: [
                { delta: 120, reason: 'receive', daysAgo: 21 },
                { delta: -15, reason: 'sale', daysAgo: 9 },
                { delta: -9, reason: 'sale', daysAgo: 3 },
                { delta: -1, reason: 'recount', daysAgo: 1 },
              ],
            },
            {
              warehouseKey: 'WEST',
              reorderPoint: 12,
              reorderQuantity: 48,
              movements: [
                { delta: 40, reason: 'receive', daysAgo: 18 },
                { delta: -6, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
        {
          sku: 'FF-67-OEM',
          title: 'OEM Motorcraft',
          priceCents: 5899,
          costCents: 3100,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 16,
              reorderQuantity: 64,
              leadTimeDays: 10,
              movements: [
                { delta: 58, reason: 'receive', daysAgo: 30 },
                { delta: -22, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Cheap insurance',
          body: 'Run these religiously on our fleet trucks. Easy swap, water sensor transferred right over.',
          authorPersona: 'marcus',
          response: 'Appreciate the fleet business, Marcus!',
          helpfulCount: 9,
          daysAgo: 21,
        },
        {
          rating: 5,
          title: 'OEM is worth it',
          body: 'Tried the cheap ones, came back to Motorcraft. No more water-in-fuel codes.',
          authorPersona: 'dana',
          helpfulCount: 4,
          daysAgo: 12,
        },
        {
          rating: 4,
          title: '',
          body: 'Good filter, shipping took a couple extra days but no real complaints.',
          displayName: 'TruckGuy208',
          helpfulCount: 2,
          daysAgo: 7,
        },
      ],
      questions: [
        {
          body: 'Does this come with a new water-in-fuel sensor or do I reuse mine?',
          authorPersona: 'priya',
          answer:
            'You reuse your existing WIF sensor — it threads out of the old filter and into this one.',
          daysAgo: 14,
        },
        { body: 'Will this fit a 2017 6.7?', displayName: 'Newbie', status: 'pending', daysAgo: 3 },
      ],
    },
    {
      key: 'glow-plug-60',
      title: 'Glow Plug Set (8) — 6.0L Power Stroke',
      handle: 'glow-plug-set-6-0l-power-stroke',
      description:
        '<p>Complete 8-piece glow plug set for the 2003–2007 6.0L Power Stroke. Hard cold starts, white smoke on startup, and a rough first minute are the classic symptoms of failed glow plugs — replace them as a set so you are not back under the valve cover in a month.</p><p>Includes all eight plugs gapped to spec. We strongly recommend inspecting the glow plug harness and valve-cover gasket while you are in there.</p>',
      productType: 'Ignition',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'Fits the 2003–2007 6.0L Power Stroke diesel (Ford Super Duty and Excursion). Covers all eight cylinders — one complete set per engine. Gapped to specification and ready to install.',
        specs: [
          { label: 'Set quantity', value: '8 glow plugs' },
          { label: 'Application', value: '6.0L Power Stroke' },
          { label: 'Gap', value: 'Pre-set to OE spec' },
          { label: 'Install', value: 'Mechanical swap, no programming' },
          { label: 'Recommended', value: 'Inspect harness + valve-cover gasket' },
        ],
        warranty: '12-month limited warranty; dead-on-arrival plugs replaced individually.',
      },
      vendor: 'Motorcraft',
      tags: ['glow plug', '6.0L', 'power stroke', 'cold start'],
      categoryKeys: ['ignition'],
      collectionKeys: [],
      variants: [
        {
          sku: 'GP-60-SET8',
          title: null,
          priceCents: 18999,
          costCents: 9800,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 10,
              reorderQuantity: 40,
              leadTimeDays: 14,
              movements: [
                { delta: 28, reason: 'receive', daysAgo: 24 },
                { delta: -13, reason: 'sale', daysAgo: 8 },
                { delta: -8, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Fixed my cold starts',
          body: 'Truck fires right up now even at 10 below. Do all 8 at once, trust me.',
          authorPersona: 'glen',
          helpfulCount: 6,
          daysAgo: 20,
        },
        {
          rating: 2,
          title: 'One was bad out of the box',
          body: 'Seven worked great, eighth was dead on arrival. Support sent a replacement quickly though.',
          displayName: 'ColdStartCarl',
          status: 'flagged',
          helpfulCount: 3,
          daysAgo: 10,
        },
      ],
      questions: [
        {
          body: 'Do I need to reprogram anything after replacing these?',
          authorPersona: 'rafael',
          answer:
            'No programming needed — straight mechanical swap. Just clear any stored glow-plug codes after.',
          daysAgo: 16,
        },
      ],
    },
    {
      key: 'injector-67-cummins',
      title: 'Fuel Injector — 6.7L Cummins',
      handle: 'fuel-injector-6-7l-cummins',
      description:
        '<p>Direct-replacement common-rail injector for the 2007.5–2018 6.7L Cummins. Rough idle, excessive smoke, hard starts, and a knock that comes and goes are all signs of a failing injector. Each unit is flow-matched and ships with a new copper sealing washer.</p><p>Available remanufactured (dyno-tested core) or new OEM. Replace in matched sets when possible and always re-torque to spec.</p>',
      productType: 'Fuel System',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'Fits the 2007.5–2018 6.7L Cummins (Ram 2500/3500 Heavy Duty) common-rail fuel system. Sold individually; replace in matched sets when possible. No injector trim coding required on the 6.7 Cummins — install and go.',
        specs: [
          { label: 'Type', value: 'Common-rail direct injector' },
          { label: 'Condition', value: 'Remanufactured (dyno-tested) or new OEM' },
          { label: 'Flow-matched', value: 'Yes, tested to spec' },
          { label: 'Included', value: 'New copper sealing washer' },
          { label: 'ECM coding', value: 'Not required' },
        ],
        warranty:
          'Remanufactured: 12-month / unlimited-mile limited warranty. New OEM: 24-month / unlimited-mile.',
      },
      vendor: 'Bosch',
      tags: ['injector', 'cummins', '6.7L', 'common rail'],
      categoryKeys: ['fuel-system'],
      collectionKeys: ['best-sellers'],
      variants: [
        {
          sku: 'INJ-67C-REMAN',
          title: 'Remanufactured',
          priceCents: 32900,
          costCents: 18500,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 8,
              reorderQuantity: 24,
              leadTimeDays: 21,
              movements: [
                { delta: 36, reason: 'receive', daysAgo: 40 },
                { delta: -11, reason: 'sale', daysAgo: 12 },
                { delta: -7, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
        {
          sku: 'INJ-67C-NEW',
          title: 'New OEM',
          priceCents: 58900,
          costCents: 41000,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 4,
              reorderQuantity: 12,
              leadTimeDays: 28,
              movements: [
                { delta: 9, reason: 'receive', daysAgo: 35 },
                { delta: -9, reason: 'sale', daysAgo: 6 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Idle is smooth again',
          body: 'Reman set cleared up my misfire and the smoke is gone. Flow numbers were on the sheet in the box.',
          authorPersona: 'marcus',
          response: 'Glad it sorted the misfire — thanks for the flow-sheet note!',
          helpfulCount: 11,
          daysAgo: 25,
        },
        {
          rating: 4,
          title: 'New OEM, pricey but right',
          body: 'Went new on a customer truck. No regrets but the reman is probably fine for most.',
          displayName: 'ShopOwnerMike',
          helpfulCount: 5,
          daysAgo: 16,
        },
      ],
      questions: [
        {
          body: 'Do these need to be coded to the ECM after install?',
          displayName: 'WrenchTurner',
          answer:
            'The 6.7 Cummins does not require injector trim coding like some Duramax/Power Stroke do — install and go.',
          daysAgo: 18,
        },
        {
          body: 'Is the core charge included or separate?',
          displayName: 'BudgetBuild',
          status: 'pending',
          daysAgo: 2,
        },
      ],
    },
    {
      key: 'turbo-lml',
      title: 'Turbocharger — Duramax LML',
      handle: 'turbocharger-duramax-lml',
      description:
        '<p>Complete drop-in variable-geometry turbocharger for the 2011–2016 6.6L Duramax LML. Sticking vanes, a P0299 underboost code, or a whistle-then-no-boost are the usual death rattles of the factory unit. This is a complete CHRA-and-housing assembly, not a rebuild kit — bolt it on and go.</p><p>Includes new mounting hardware and gaskets. We recommend a fresh oil feed line and a clean air filter at install.</p>',
      productType: 'Forced Induction',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'Fits the 2011–2016 6.6L Duramax LML (Chevrolet Silverado / GMC Sierra 2500HD/3500HD). Complete drop-in variable-geometry assembly — not a rebuild kit — that works on the factory calibration, so no tune is required.',
        specs: [
          { label: 'Type', value: 'Variable-geometry turbo (VGT)' },
          { label: 'Assembly', value: 'Complete CHRA + housing' },
          { label: 'Application', value: '6.6L Duramax LML' },
          { label: 'Calibration', value: 'Runs on stock, no tune needed' },
          { label: 'Included', value: 'Mounting hardware + gaskets' },
        ],
        warranty: '24-month / unlimited-mile limited warranty against defects in materials.',
      },
      vendor: 'Garrett',
      tags: ['turbo', 'duramax', 'LML', 'VGT'],
      categoryKeys: ['forced-induction'],
      collectionKeys: ['new-arrivals'],
      variants: [
        {
          sku: 'TURBO-LML',
          title: null,
          priceCents: 129900,
          costCents: 82000,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 3,
              reorderQuantity: 6,
              leadTimeDays: 35,
              movements: [
                { delta: 8, reason: 'receive', daysAgo: 50 },
                { delta: -2, reason: 'sale', daysAgo: 14 },
              ],
            },
            { warehouseKey: 'WEST', movements: [{ delta: 3, reason: 'receive', daysAgo: 22 }] },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Boost is back',
          body: 'Cleared my P0299 and the truck pulls like new. Big job but worth every penny.',
          authorPersona: 'rafael',
          helpfulCount: 7,
          daysAgo: 19,
        },
      ],
      questions: [
        {
          body: 'Does this come pre-calibrated or do I need a tune?',
          displayName: 'DuramaxDan',
          answer:
            'It is a direct OE replacement and works on the stock calibration — no tune required, though it pairs well with one.',
          daysAgo: 11,
        },
      ],
    },
    {
      key: 'oil-15w40',
      title: 'Diesel Engine Oil 15W-40 (1 gal)',
      handle: 'diesel-engine-oil-15w40-1gal',
      description:
        '<p>Heavy-duty 15W-40 CK-4 diesel engine oil — the workhorse weight for nearly every modern diesel pickup and medium-duty truck. Strong soot-handling and shear stability for long drain intervals and hard duty cycles.</p><p>One US gallon. A typical 6.7L oil change takes three gallons plus a filter.</p>',
      productType: 'Fluids',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'Suits nearly every modern diesel pickup and medium-duty truck that calls for a 15W-40 engine oil — 6.7L Power Stroke, 6.7L Cummins, 6.6L Duramax and older 7.3L applications alike. A typical 6.7L oil change takes three gallons plus a filter.',
        specs: [
          { label: 'Viscosity', value: '15W-40' },
          { label: 'Specification', value: 'API CK-4 (backward compatible with CJ-4)' },
          { label: 'Volume', value: '1 US gallon' },
          { label: 'Soot handling', value: 'High — long drain / hard duty' },
        ],
        warranty:
          'Consumable fluid — no product warranty. Meets or exceeds API CK-4 and major OEM diesel-oil approvals.',
      },
      vendor: 'Shell Rotella',
      tags: ['oil', '15w40', 'CK-4', 'fluids'],
      hazmatClass: 'class9',
      categoryKeys: ['fluids'],
      collectionKeys: ['shop-fluids', 'best-sellers'],
      variants: [
        {
          sku: 'OIL-15W40-1G',
          title: null,
          priceCents: 2999,
          costCents: 1450,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 60,
              reorderQuantity: 240,
              leadTimeDays: 5,
              movements: [
                { delta: 480, reason: 'receive', daysAgo: 28 },
                { delta: -96, reason: 'sale', daysAgo: 10 },
                { delta: -72, reason: 'sale', daysAgo: 3 },
              ],
            },
            {
              warehouseKey: 'WEST',
              reorderPoint: 40,
              reorderQuantity: 160,
              movements: [
                { delta: 240, reason: 'receive', daysAgo: 26 },
                { delta: -48, reason: 'sale', daysAgo: 7 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Standard for a reason',
          body: 'Been running Rotella for 20 years across a dozen trucks. Never let me down.',
          authorPersona: 'glen',
          helpfulCount: 8,
          daysAgo: 22,
        },
        {
          rating: 5,
          title: '',
          body: 'Good price by the gallon, way cheaper than the parts store.',
          authorPersona: 'tessa',
          helpfulCount: 3,
          daysAgo: 9,
        },
        {
          rating: 3,
          title: 'It is oil',
          body: 'Does the job. Hard to get excited about engine oil but no complaints.',
          displayName: 'JustaGuy',
          status: 'pending',
          helpfulCount: 1,
          daysAgo: 2,
        },
      ],
      questions: [
        {
          body: 'Is this the CK-4 spec? My manual calls for it.',
          authorPersona: 'priya',
          answer: 'Yes — this is full CK-4, backward compatible with CJ-4 applications.',
          daysAgo: 13,
        },
      ],
    },
    {
      key: 'coolant-hd',
      title: 'Heavy-Duty Coolant — Nitrite-Free (1 gal)',
      handle: 'heavy-duty-coolant-nitrite-free-1gal',
      description:
        '<p>Extended-life, nitrite-free (NOAT) heavy-duty coolant rated for 600,000 miles / six years in on-highway service. Protects against liner pitting and cavitation without supplemental coolant additives.</p><p>One US gallon, full strength — mix 50/50 with distilled water, or top off as needed.</p>',
      productType: 'Fluids',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'For heavy-duty diesel cooling systems that specify a nitrite-free (NOAT) extended-life coolant. Do not mix with conventional green or nitrited coolant — flush and run this straight for the full service life.',
        specs: [
          { label: 'Chemistry', value: 'Nitrite-free NOAT (extended-life)' },
          { label: 'Service life', value: '600,000 mi / 6 years on-highway' },
          { label: 'Volume', value: '1 US gallon, full strength' },
          { label: 'Mix ratio', value: '50/50 with distilled water' },
          { label: 'SCA testing', value: 'Not required' },
        ],
        warranty:
          'Consumable fluid — no product warranty. Backed by the manufacturer service-life rating when used as directed.',
      },
      vendor: 'Fleetguard',
      tags: ['coolant', 'NOAT', 'fluids', 'cooling'],
      hazmatClass: 'class9',
      categoryKeys: ['fluids', 'cooling'],
      collectionKeys: ['shop-fluids'],
      variants: [
        {
          sku: 'COOL-HD-1G',
          title: null,
          priceCents: 1999,
          costCents: 950,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 30,
              reorderQuantity: 120,
              leadTimeDays: 6,
              movements: [
                { delta: 120, reason: 'receive', daysAgo: 20 },
                { delta: -60, reason: 'sale', daysAgo: 9 },
                { delta: -42, reason: 'sale', daysAgo: 2 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'No more SCA testing',
          body: 'Switched the whole fleet to nitrite-free. One less thing to test and top off.',
          authorPersona: 'marcus',
          helpfulCount: 5,
          daysAgo: 18,
        },
      ],
      questions: [
        {
          body: 'Can I mix this with the green stuff already in my truck?',
          displayName: 'OldSchool',
          answer:
            'We do not recommend mixing coolant chemistries — flush the system and run this straight for the full service life.',
          daysAgo: 12,
        },
      ],
    },
    {
      key: 'serpentine-belt-73',
      title: 'Serpentine Belt — 7.3L Power Stroke',
      handle: 'serpentine-belt-7-3l-power-stroke',
      description:
        '<p>OE-length serpentine belt for the 1994–2003 7.3L Power Stroke. EPDM construction resists cracking and glazing far longer than the original. A squeal on cold start or visible cracks between the ribs means it is past due.</p><p>Carry a spare — a broken belt strands you and kills your charging and cooling instantly.</p>',
      productType: 'Belts',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'Fits the 1994–2003 7.3L Power Stroke diesel (Ford Super Duty, F-Series and Excursion). OE length and rib count match the factory routing diagram exactly. Carry a spare — a broken belt strands you and kills charging and cooling instantly.',
        specs: [
          { label: 'Construction', value: 'EPDM (crack + glaze resistant)' },
          { label: 'Length', value: 'OE-spec' },
          { label: 'Ribs', value: 'Matches factory routing' },
          { label: 'Application', value: '7.3L Power Stroke' },
        ],
        warranty: '24-month / 24,000-mile limited warranty against premature wear.',
      },
      vendor: 'Gates',
      tags: ['serpentine belt', '7.3L', 'power stroke', 'belt'],
      categoryKeys: ['belts'],
      collectionKeys: [],
      variants: [
        {
          sku: 'BELT-73',
          title: null,
          priceCents: 4599,
          costCents: 2200,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 20,
              reorderQuantity: 80,
              leadTimeDays: 9,
              movements: [
                { delta: 64, reason: 'receive', daysAgo: 33 },
                { delta: -19, reason: 'sale', daysAgo: 11 },
                { delta: -8, reason: 'sale', daysAgo: 4 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 5,
          title: 'Perfect fit',
          body: 'Dropped right on, routing matched the diagram. Keeping the old one as a spare.',
          authorPersona: 'dana',
          helpfulCount: 2,
          daysAgo: 15,
        },
      ],
      questions: [],
    },
    {
      key: 'water-pump-66',
      title: 'Water Pump — 6.6L Duramax',
      handle: 'water-pump-6-6l-duramax',
      description:
        '<p>Cast-impeller water pump for the 6.6L Duramax. A weep-hole drip, a bearing whine, or coolant loss with no visible hose leak point to a tired pump. Includes a new gasket and O-rings.</p><p>Replace the thermostat and refresh the coolant while the system is open — cheap parts, one job.</p>',
      productType: 'Cooling',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'Fits the 6.6L Duramax (LB7 through LML, Chevrolet Silverado / GMC Sierra 2500HD/3500HD). Replace the thermostat and refresh the coolant while the system is open. Includes a new gasket and O-rings.',
        specs: [
          { label: 'Impeller', value: 'Cast metal (not plastic)' },
          { label: 'Application', value: '6.6L Duramax' },
          { label: 'Bearing', value: 'Sealed' },
          { label: 'Included', value: 'Gasket + O-rings' },
        ],
        warranty: '12-month / 12,000-mile limited warranty against defects.',
      },
      vendor: 'ACDelco',
      tags: ['water pump', 'duramax', '6.6L', 'cooling'],
      categoryKeys: ['cooling'],
      collectionKeys: ['new-arrivals'],
      variants: [
        {
          sku: 'WP-66',
          title: null,
          priceCents: 17999,
          costCents: 9500,
          stock: [
            {
              warehouseKey: 'MAIN',
              reorderPoint: 6,
              reorderQuantity: 18,
              leadTimeDays: 16,
              movements: [
                { delta: 22, reason: 'receive', daysAgo: 44 },
                { delta: -7, reason: 'sale', daysAgo: 13 },
                { delta: -3, reason: 'sale', daysAgo: 5 },
              ],
            },
          ],
        },
      ],
      reviews: [
        {
          rating: 4,
          title: 'Solid replacement',
          body: 'Cast impeller, not plastic. Quiet so far after a few thousand miles.',
          authorPersona: 'rafael',
          helpfulCount: 3,
          daysAgo: 14,
        },
      ],
      questions: [],
    },
    {
      key: 'maint-kit-67',
      title: '6.7L Power Stroke Maintenance Kit',
      handle: '6-7l-power-stroke-maintenance-kit',
      description:
        '<p>Everything you need for a full 6.7L Power Stroke service in one box: fuel filter, three gallons of 15W-40, and a gallon of heavy-duty coolant. Buy the kit and save versus picking the parts individually.</p>',
      productType: 'Kits',
      productTypeKey: 'auto_part',
      attributes: {
        fitment:
          'A complete scheduled-service kit for the 2011–2016 6.7L Power Stroke — one box covers a full oil-and-filter change plus a coolant top-off. Buy the kit and save versus picking the parts individually.',
        specs: [
          { label: 'Includes', value: 'Fuel filter + 3 gal 15W-40 + 1 gal coolant' },
          { label: 'Service', value: 'Full oil + filter change' },
          { label: 'Interval', value: 'Every 15,000 mi' },
          { label: 'Application', value: '6.7L Power Stroke' },
        ],
        warranty:
          'Each component carries its own manufacturer warranty; the fuel filter is covered 12 months / 12,000 miles.',
      },
      vendor: 'Shop Kit',
      tags: ['kit', 'maintenance', '6.7L', 'bundle'],
      categoryKeys: ['filters'],
      collectionKeys: ['best-sellers'],
      variants: [{ sku: 'KIT-67-MAINT', title: null, priceCents: 11999, costCents: 6500 }],
      reviews: [
        {
          rating: 5,
          title: 'One-click oil change',
          body: 'Grab the kit, do the service in an afternoon. Nice not hunting for each part.',
          authorPersona: 'glen',
          helpfulCount: 4,
          daysAgo: 11,
        },
      ],
      questions: [],
    },
  ],

  bundles: [
    {
      wrapperProductKey: 'maint-kit-67',
      pricing: { mode: 'percent', percentOff: 12 },
      inventoryMode: 'components',
      components: [
        { productKey: 'fuel-filter-67', quantity: 1, required: true },
        { productKey: 'oil-15w40', quantity: 3, required: true },
        { productKey: 'coolant-hd', quantity: 1, required: false, swappable: true },
      ],
    },
  ],

  configurator: {
    productKey: 'turbo-lml',
    name: 'Turbo upgrade builder',
    options: [
      {
        key: 'tune-stage',
        label: 'Tune stage',
        inputType: 'single',
        choices: [
          { value: 'stock', label: 'Stock calibration', isDefault: true },
          { value: 'stage1', label: 'Stage 1 (+60 hp)', priceDeltaCents: 20000 },
          { value: 'stage2', label: 'Stage 2 (+120 hp)', priceDeltaCents: 50000 },
        ],
      },
      {
        key: 'downpipe',
        label: 'Add a 4" downpipe',
        inputType: 'toggle',
        choices: [
          { value: 'no', label: 'No', isDefault: true },
          { value: 'yes', label: 'Yes (+$350)', priceDeltaCents: 35000 },
        ],
      },
    ],
    addOns: [{ variantKey: 'OIL-15W40-1G', defaultIncluded: false, priceOverrideCents: 2499 }],
  },

  scheduling: {
    resources: [
      {
        key: 'bay1',
        name: 'Service Bay 1',
        kind: 'space',
        windows: [
          { day: 1, startMin: 480, endMin: 1020 },
          { day: 2, startMin: 480, endMin: 1020 },
          { day: 3, startMin: 480, endMin: 1020 },
          { day: 4, startMin: 480, endMin: 1020 },
          { day: 5, startMin: 480, endMin: 1020 },
        ],
      },
      {
        key: 'bay2',
        name: 'Service Bay 2',
        kind: 'space',
        windows: [
          { day: 1, startMin: 480, endMin: 1020 },
          { day: 2, startMin: 480, endMin: 1020 },
          { day: 3, startMin: 480, endMin: 1020 },
          { day: 4, startMin: 480, endMin: 1020 },
          { day: 5, startMin: 480, endMin: 1020 },
        ],
      },
      {
        key: 'tech-jim',
        name: 'Jim (Diagnostics)',
        kind: 'staff',
        skills: ['diagnostic', 'general'],
      },
      {
        key: 'tech-sara',
        name: 'Sara (Fuel Systems)',
        kind: 'staff',
        skills: ['injector', 'fuel', 'general'],
      },
    ],
    // A service shop assigns work, it doesn't let customers pick the mechanic — so
    // every job is `round_robin`, balancing the queue across the available techs
    // (the general-skill DPF job spreads across both Jim and Sara; skill-specific
    // jobs land on whoever holds that skill).
    services: [
      {
        key: 'diagnostic',
        name: 'Diesel Diagnostic',
        description:
          'A full scan + road test to pin down a check-engine light or driveability complaint.',
        durationMinutes: 60,
        priceCents: 12900,
        bookingType: 'appointment',
        assignmentStrategy: 'round_robin',
        resourceRoles: [
          { role: 'tech', kind: 'staff', skill: 'diagnostic' },
          { role: 'bay', kind: 'space' },
        ],
      },
      {
        key: 'dpf-service',
        name: 'DPF Cleaning Service',
        description:
          'Pull, bake, and flow-test your diesel particulate filter to clear a clogged-DPF code.',
        durationMinutes: 120,
        priceCents: 34900,
        bookingType: 'appointment',
        bufferAfterMin: 30,
        assignmentStrategy: 'round_robin',
        resourceRoles: [
          { role: 'tech', kind: 'staff', skill: 'general' },
          { role: 'bay', kind: 'space' },
        ],
      },
      {
        key: 'injector-service',
        name: 'Injector R&R',
        description:
          'Remove, replace, and re-torque a set of injectors. We confirm scope before booking.',
        durationMinutes: 180,
        priceCents: 65000,
        bookingType: 'appointment',
        requiresApproval: true,
        assignmentStrategy: 'round_robin',
        resourceRoles: [
          { role: 'tech', kind: 'staff', skill: 'injector' },
          { role: 'bay', kind: 'space' },
        ],
      },
    ],
  },

  articles: [
    {
      slug: 'how-often-change-6-7-fuel-filter',
      title: 'How often should you change your 6.7L fuel filter?',
      excerpt:
        'The single cheapest way to protect a five-figure fuel system — and the schedule most owners get wrong.',
      daysAgo: 5,
      body: doc(
        p(
          'Of all the maintenance on a modern diesel, the fuel filter is the one with the best return on a few dollars. The high-pressure fuel system on a 6.7L Power Stroke runs to tight tolerances, and the parts that fail when it ingests water or grit are not cheap.'
        ),
        h2('The short answer'),
        p(
          'Change the fuel/water separator filter at every oil change, or every 15,000 miles — whichever comes first. If you tow heavy, idle a lot, or buy fuel from low-volume stations, lean toward the shorter end.'
        ),
        h2('Signs you are overdue'),
        ul(
          'A "water in fuel" warning on the dash',
          'Hard starts or a stumble under load',
          'A noticeable drop in fuel economy',
          'Visible water or debris when you drain the filter bowl'
        ),
        p(
          'When in doubt, change it. A filter is a few dollars; an injector or a high-pressure pump is not.'
        )
      ),
    },
    {
      slug: 'glow-plug-failure-symptoms',
      title: 'Glow plug failure: the symptoms and the fix',
      excerpt:
        'Hard cold starts and white smoke on startup almost always point to one thing on a 6.0L Power Stroke.',
      daysAgo: 12,
      body: doc(
        p(
          'If your diesel cranks longer than it should on a cold morning, coughs white smoke for the first minute, and then runs fine once it is warm, you are almost certainly looking at failed glow plugs.'
        ),
        h2('What glow plugs do'),
        p(
          'Diesels have no spark. On a cold start the glow plugs pre-heat each cylinder so the compressed air is hot enough to ignite the first shots of fuel. As they wear out, cold starts get rough — and below freezing, a few dead plugs can mean it will not start at all.'
        ),
        h2('Replace them as a set'),
        p(
          'Once one plug has failed, the others are not far behind — they all have the same hours on them. Replacing all eight at once saves you a second teardown and a second valve-cover gasket. While you are in there, inspect the glow plug harness; a chafed connector is a common hidden culprit.'
        )
      ),
    },
    {
      slug: 'choosing-the-right-15w40',
      title: 'CK-4 vs CJ-4: choosing the right 15W-40',
      excerpt:
        'Engine oil specs changed in 2016. Here is what the letters mean and why CK-4 is the safe choice.',
      daysAgo: 20,
      body: doc(
        p(
          'Walk the oil aisle and you will see 15W-40 in CJ-4 and CK-4 flavors. The weight is the same; the additive package and the standard behind it are not.'
        ),
        h2('What changed'),
        p(
          'CK-4 replaced CJ-4 in late 2016 with better oxidation resistance and shear stability — meaning the oil holds its viscosity longer under heat and load. It is fully backward compatible: you can run CK-4 in any engine that called for CJ-4.'
        ),
        h2('The bottom line'),
        ul(
          'Buy CK-4 — it meets or exceeds older specs',
          'Match the weight your manual calls for (15W-40 for most on-highway diesels)',
          'Stick to the drain interval in your manual, shorter if you tow or idle hard'
        )
      ),
    },
  ],
};
