// Module-complete fallbacks — no enabled module renders empty just because the
// vertical pack didn't author that section (docs/104, Wave 5 follow-up).
//
// The engine gates every slice on the tenant's ENABLED module set, but a pack only
// seeds what its author wrote — so a clothing tenant that turns on `scheduling`
// would load the apparel pack and get ZERO bookings, because the apparel pack
// authors no scheduling block. That's an empty surface on an enabled module —
// exactly the confusion sample data exists to prevent.
//
// `withFallbacks` closes the gap: before a load runs, it splices a generic-but-real,
// industry-flavored default into any section the pack left blank for an enabled
// module. Verticals keep their rich hand-authored data where it exists; the fallback
// only fills the holes. Everything it produces flows through the SAME appliers +
// markers as authored data, so Clear removes it with no extra bookkeeping.

import type {
  SampleConfigurator,
  SampleDataPack,
  SampleLot,
  SamplePersona,
  SampleProduct,
  SampleRecordType,
  SampleScheduling,
  SampleService,
  SampleStockLevel,
  SampleWarehouse,
} from '../types';

const isPhysical = (p: SampleProduct): boolean => (p.fulfillmentType ?? 'physical') === 'physical';

// ── Scheduling ────────────────────────────────────────────────────────────
//
// A tenant only turns scheduling on because it books SOMETHING — a consult, a
// fitting, a tasting — so every vertical can carry a small appointment set. Flavored
// by industry where a nicer noun exists; falls back to a professional consultation.

interface FlavorService {
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  bookingType?: string;
  assignmentStrategy?: SampleService['assignmentStrategy'];
}
interface SchedulingFlavor {
  skill: string;
  resources: [string, string];
  services: [FlavorService, FlavorService];
}

const SCHEDULING_FLAVORS: Record<string, SchedulingFlavor> = {
  apparel: {
    skill: 'styling',
    resources: ['Maya Chen, Style Advisor', 'Tomás Ruiz, Tailor'],
    services: [
      {
        name: 'Personal styling session',
        description:
          'A one-on-one session to build a capsule wardrobe around your fit, colors, and the occasions you dress for. Leave with a shortlist and a plan.',
        durationMinutes: 60,
        priceCents: 9500,
      },
      {
        name: 'Alterations fitting',
        description: 'A quick fitting to pin hems, sleeves, and waist for a tailored finish.',
        durationMinutes: 30,
        priceCents: 4500,
      },
    ],
  },
  food: {
    skill: 'tasting',
    resources: ['Chef Amara Okafor', 'Priya Nair, Events Lead'],
    services: [
      {
        name: 'Tasting & menu consultation',
        description:
          'Sit down with the kitchen to taste seasonal dishes and shape a menu for your event — dietary needs, pairings, and portion planning included.',
        durationMinutes: 60,
        priceCents: 7500,
      },
      {
        name: 'Private event planning',
        description: 'Plan the timeline, staffing, and courses for a private dinner or party.',
        durationMinutes: 45,
        priceCents: 12000,
      },
    ],
  },
  electronics: {
    skill: 'demo',
    resources: ['Sam Patel, Product Specialist', 'Riley Okafor, Repair Tech'],
    services: [
      {
        name: 'Product demo & setup',
        description:
          'Hands-on walkthrough of a device before you buy, or an in-store setup so it works the moment you get home.',
        durationMinutes: 45,
        priceCents: 0,
      },
      {
        name: 'Repair drop-off consultation',
        description: 'A diagnostic sit-down to scope a repair and give you a firm estimate.',
        durationMinutes: 30,
        priceCents: 4900,
      },
    ],
  },
  wholesale: {
    skill: 'account',
    resources: ['Dana Whitfield, Account Manager', 'Leo Marsh, Sales Engineer'],
    services: [
      {
        name: 'Account onboarding consultation',
        description:
          'Walk a new wholesale account through catalog access, pricing tiers, net terms, and reorder workflows so the first PO goes smoothly.',
        durationMinutes: 45,
        priceCents: 0,
      },
      {
        name: 'Quarterly account review',
        description: 'Review volume, forecast the next quarter, and revisit pricing and terms.',
        durationMinutes: 60,
        priceCents: 0,
      },
    ],
  },
  generic: {
    skill: 'consult',
    resources: ['Alex Rivera, Specialist', 'Jordan Lee, Specialist'],
    services: [
      {
        name: 'Consultation',
        description:
          'A focused one-on-one to understand what you need and map out next steps. Book a time that works and pick who you meet with.',
        durationMinutes: 30,
        priceCents: 7500,
      },
      {
        name: 'Follow-up session',
        description: 'A working session to review progress and keep things moving.',
        durationMinutes: 45,
        priceCents: 12000,
      },
    ],
  },
};

/** A universal, industry-flavored appointment set (2 services + 2 staff) so any
 *  tenant with `scheduling` on has a populated calendar. */
export function defaultScheduling(pack: SampleDataPack): SampleScheduling {
  const flavor = SCHEDULING_FLAVORS[pack.industry] ?? SCHEDULING_FLAVORS.generic!;
  return {
    resources: flavor.resources.map((name, i) => ({
      key: `fb-res-${i + 1}`,
      name,
      kind: 'staff',
      skills: [flavor.skill],
    })),
    services: flavor.services.map((s, i) => ({
      key: `fb-svc-${i + 1}`,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      bookingType: s.bookingType ?? 'appointment',
      // The first service lets the storefront visitor pick their specialist (the
      // "choose your …" step); the second load-balances across the pool.
      assignmentStrategy: s.assignmentStrategy ?? (i === 0 ? 'customer_choice' : 'any_available'),
      resourceRoles: [{ role: 'specialist', kind: 'staff', skill: flavor.skill }],
    })),
  };
}

// ── B2B ─────────────────────────────────────────────────────────────────────

/** A wholesale account so the B2B + Quotes surfaces aren't empty when the vertical
 *  authored only retail personas. Flows through the normal customer/quote/deal
 *  spine (`applyQuotes` already prefers B2B personas). */
export function defaultB2bPersona(): SamplePersona {
  return {
    key: 'fb-b2b-account',
    name: 'Dana Whitfield',
    // The engine rewrites the domain onto sample.example.
    email: 'purchasing@northgate-supply',
    kind: 'b2b',
    company: 'Northgate Supply Co.',
    phone: '(312) 555-0148',
    line1: '820 W Kinzie St',
    city: 'Chicago',
    region: 'IL',
    postalCode: '60642',
    country: 'US',
  };
}

// ── Record types ────────────────────────────────────────────────────────────

/**
 * The extra details a business tracks on its records (docs/144 §3), for a pack
 * that authored none.
 *
 * Every business keeps something the software did not ask for — a nickname, a
 * renewal month, who introduced them. The registry's whole point is that they can
 * write it down, and a demo tenant where that section is empty teaches nobody
 * that the section exists. So the fallback declares a small, universally-true set
 * rather than nothing: three details on a customer, one on a company, one on a
 * deal, all of them things a real business genuinely does keep.
 *
 * Deliberately SMALL. A wall of invented fields would read as clutter someone has
 * to clean up, which is the opposite of the point.
 */
export function defaultRecordTypes(): SampleRecordType[] {
  return [
    {
      objectKey: 'contact',
      properties: [
        {
          key: 'howTheyFoundUs',
          label: 'How they found us',
          type: 'enum',
          helpText: 'Worth asking once — it is the only way to know what is working.',
          options: [
            { value: 'word_of_mouth', label: 'Someone told them' },
            { value: 'search', label: 'Found us searching' },
            { value: 'social', label: 'Social media' },
            { value: 'event', label: 'Met us at an event' },
            { value: 'returning', label: 'They came back' },
          ],
        },
        {
          key: 'preferredName',
          label: 'What they like to be called',
          type: 'text',
          helpText: 'Use this instead of their first name when it is different.',
        },
        {
          key: 'lastReviewedOn',
          label: 'Last reviewed on',
          type: 'date',
          helpText: 'When someone last checked in on this relationship.',
        },
      ],
    },
    {
      objectKey: 'company',
      properties: [
        {
          key: 'renewalMonth',
          label: 'Renewal month',
          type: 'enum',
          helpText: 'The month their agreement comes up, so nothing lapses unnoticed.',
          options: [
            { value: '01', label: 'January' },
            { value: '02', label: 'February' },
            { value: '03', label: 'March' },
            { value: '04', label: 'April' },
            { value: '05', label: 'May' },
            { value: '06', label: 'June' },
            { value: '07', label: 'July' },
            { value: '08', label: 'August' },
            { value: '09', label: 'September' },
            { value: '10', label: 'October' },
            { value: '11', label: 'November' },
            { value: '12', label: 'December' },
          ],
        },
      ],
    },
    {
      objectKey: 'deal',
      properties: [
        {
          key: 'whoElseTheyAreTalkingTo',
          label: 'Who else they are talking to',
          type: 'text',
          helpText: 'Who you are up against. Blank means you do not know yet.',
        },
      ],
    },
  ];
}

/** The `how they found us` options, in the order the fallback declares them —
 *  used to give each persona a different, plausible answer. */
const FOUND_US = ['word_of_mouth', 'search', 'social', 'event', 'returning'] as const;

/**
 * Fill in the fallback's contact properties on every persona that has none.
 *
 * Spread deterministically rather than randomly: the same pack always produces
 * the same demo tenant, which is what makes a screenshot in the docs still true
 * next month. A persona that authored its own values is left exactly as written.
 */
export function withDefaultPersonaProperties(
  personas: SamplePersona[],
  now: number
): SamplePersona[] {
  return personas.map((persona, index) => {
    if (persona.properties) return persona;
    // A spread of "last reviewed" dates across the past few months, so the
    // column looks like a real one that people update at different times.
    const reviewed = new Date(now - (11 + index * 23) * 86_400_000);
    return {
      ...persona,
      properties: {
        howTheyFoundUs: FOUND_US[index % FOUND_US.length],
        lastReviewedOn: reviewed.toISOString().slice(0, 10),
      },
    };
  });
}

// ── Inventory ─────────────────────────────────────────────────────────────

/** A default stock location for a goods tenant that enabled inventory but authored
 *  no warehouses. (Services-only packs never reach this — see `hasPhysicalGoods`.) */
export function defaultWarehouse(): SampleWarehouse {
  return {
    key: 'fb-warehouse',
    code: 'FB-MAIN',
    name: 'Main warehouse',
    type: 'owned',
    city: 'Columbus',
    region: 'OH',
  };
}

/** True when the pack has at least one physical (stockable) product — the only case
 *  where an inventory / configurator / lot fallback makes sense. A services/digital
 *  catalog has nothing to stock or configure, so it stays correctly empty. */
export function hasPhysicalGoods(pack: SampleDataPack): boolean {
  return pack.products.some(isPhysical);
}

/** A light ledger (one receipt + two sales) so a fallback-stocked variant shows a
 *  realistic on-hand and movement history. */
function syntheticStock(): SampleStockLevel {
  return {
    warehouseKey: 'fb-warehouse',
    reorderPoint: 8,
    reorderQuantity: 40,
    leadTimeDays: 7,
    movements: [
      { delta: 48, reason: 'receive', daysAgo: 40 },
      { delta: -6, reason: 'sale', daysAgo: 18 },
      { delta: -3, reason: 'sale', daysAgo: 5 },
    ],
  };
}

// ── Configurator ────────────────────────────────────────────────────────────

/** A simple "personalize it" option matrix pinned to the pack's first physical
 *  product, so the Configurator surface isn't empty when commerce is on but the
 *  vertical authored no configurable product. Returns null for a services/digital
 *  catalog (nothing to configure). */
export function defaultConfigurator(pack: SampleDataPack): SampleConfigurator | null {
  const product = pack.products.find(isPhysical);
  if (!product) return null;
  return {
    productKey: product.key,
    name: 'Personalize it',
    options: [
      {
        key: 'finish',
        label: 'Finish',
        inputType: 'swatch',
        choices: [
          { value: 'classic', label: 'Classic', isDefault: true },
          {
            value: 'matte-black',
            label: 'Matte black',
            priceDeltaCents: 1500,
            swatchHex: '#1a1a1a',
          },
          { value: 'brushed', label: 'Brushed metal', priceDeltaCents: 2500, swatchHex: '#b8b8b8' },
        ],
      },
      {
        key: 'engraving',
        label: 'Add engraving',
        inputType: 'toggle',
        choices: [
          { value: 'none', label: 'No engraving', isDefault: true },
          { value: 'text', label: 'Custom text (up to 20 characters)', priceDeltaCents: 1000 },
        ],
      },
    ],
  };
}

// ── Lots ────────────────────────────────────────────────────────────────────

/** A single tracked batch on the pack's first stocked physical variant, so the Lots
 *  surface isn't empty when inventory is on but the vertical authored no lots. Reads
 *  the (possibly fallback-filled) stock positions, so `variantKey`/`warehouseKey`
 *  always resolve. Returns [] when nothing physical is stocked. */
export function defaultLots(pack: SampleDataPack): SampleLot[] {
  for (const p of pack.products) {
    if (!isPhysical(p)) continue;
    for (const v of p.variants) {
      const level = v.stock?.[0];
      if (level) {
        return [
          {
            variantKey: v.key ?? v.sku,
            warehouseKey: level.warehouseKey,
            lotNumber: 'LOT-FB-0001',
            quantity: 24,
          },
        ];
      }
    }
  }
  return [];
}

// ── Compose ─────────────────────────────────────────────────────────────────

/**
 * Return the pack with generic defaults spliced into any section left blank for an
 * ENABLED module — so no enabled module renders empty after a load. Pure: never
 * mutates the input pack (shallow-clones the touched sections), and only fills gaps
 * (an authored section is always kept verbatim).
 */
export function withFallbacks(
  pack: SampleDataPack,
  isOn: (module: string) => boolean,
  now: number = Date.now()
): SampleDataPack {
  let next = pack;

  // Record types — the extra details this business tracks (docs/144 §3). Both
  // halves are needed together: the schema is what the property panel renders,
  // and the persona values are what stops every one of those fields being blank
  // on a tenant that was just told sample data had loaded.
  if (isOn('crm')) {
    if (!pack.recordTypes?.length) next = { ...next, recordTypes: defaultRecordTypes() };
    next = { ...next, personas: withDefaultPersonaProperties(next.personas, now) };
  }

  // Scheduling — a universal appointment set (the common gap: only vertical packs
  // where booking is the whole business authored one).
  if (isOn('scheduling') && !pack.scheduling) {
    next = { ...next, scheduling: defaultScheduling(pack) };
  }

  // B2B — a wholesale account when the vertical shipped only retail personas.
  if (isOn('b2b') && !pack.personas.some((p) => p.kind === 'b2b')) {
    next = { ...next, personas: [...next.personas, defaultB2bPersona()] };
  }

  // Inventory — a stock location + light ledger for a goods pack that enabled
  // inventory but authored no warehouses (services-only packs stay empty).
  if (isOn('inventory') && !pack.warehouses?.length && hasPhysicalGoods(pack)) {
    next = {
      ...next,
      warehouses: [defaultWarehouse()],
      products: next.products.map((p) =>
        isPhysical(p)
          ? {
              ...p,
              variants: p.variants.map((v) =>
                v.stock?.length ? v : { ...v, stock: [syntheticStock()] }
              ),
            }
          : p
      ),
    };
  }

  // Lots — one tracked batch when inventory is on but the vertical authored none.
  // Runs AFTER the inventory step so it can attach to fallback-filled stock too.
  if (isOn('inventory') && !next.lots?.length) {
    const lots = defaultLots(next);
    if (lots.length) next = { ...next, lots };
  }

  // Configurator — a "personalize it" matrix when commerce is on but the vertical
  // authored no configurable product (skipped for services/digital catalogs).
  if (isOn('commerce') && !pack.configurator) {
    const cfg = defaultConfigurator(next);
    if (cfg) next = { ...next, configurator: cfg };
  }

  return next;
}
