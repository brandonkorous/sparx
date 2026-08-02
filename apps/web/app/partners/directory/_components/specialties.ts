// One source for how a partner's specialty is labelled AND coloured.
//
// It was two copies of a label map — one in the facet bar, one in the card —
// which is how "ecommerce" could render as "E-commerce" in a filter chip and
// something else on the card it filtered to. More importantly, neither carried a
// colour, so every specialty tag rendered the same grey `neutral` pill: four
// identical chips per card, telling a reader nothing they could not already read
// off the words.
//
// A specialty IS a module — "E-commerce" is Commerce, "CRM" is CRM — so it wears
// that module's registered hue, the same one it wears on /features, /pricing and
// its own marketing page. That makes the directory scannable by colour: a
// business looking for someone to run their store is looking for orange.
//
// `migration` is deliberately the exception. It is a service rather than a
// module, and `neutral` is exactly what RULE #4 says neutral is FOR — a
// genuinely untyped value, not a default.

export interface Specialty {
  label: string;
  /** A registered silica colour NAME, for `<Badge color=…>`. */
  color: string;
  /** What the specialty MEANS, in the words of someone who has never heard of a
   *  CMS. The directory card has room for the label only; the profile page
   *  (/partners/[slug]) has room to say what hiring this person for it gets you,
   *  and the audience for both is a business owner, not a developer. */
  blurb: string;
}

const SPECIALTIES: Record<string, Specialty> = {
  ecommerce: {
    label: 'E-commerce',
    color: 'module-commerce',
    blurb: 'Selling online — products, checkout, shipping and tax.',
  },
  commerce: {
    label: 'Commerce',
    color: 'module-commerce',
    blurb: 'Selling online — products, checkout, shipping and tax.',
  },
  b2b: {
    label: 'B2B',
    color: 'module-b2b',
    blurb: 'Trade and wholesale accounts — price lists, credit terms, approvals.',
  },
  crm: {
    label: 'CRM',
    color: 'module-crm',
    blurb: 'Keeping track of customers, quotes and follow-ups in one place.',
  },
  email: {
    label: 'Email',
    color: 'module-email',
    blurb: 'Newsletters, campaigns, and the automatic emails a business sends.',
  },
  cms: {
    label: 'CMS',
    color: 'module-cms',
    blurb: 'The pages, posts and photos a site publishes, and who can edit them.',
  },
  seo: {
    label: 'SEO',
    color: 'module-seo',
    blurb: 'Being found on search — page structure, speed, and what Google reads.',
  },
  ai: {
    label: 'AI',
    color: 'module-ai',
    blurb: 'Connecting an AI assistant to the business’s own products and records.',
  },
  design: {
    label: 'Design',
    color: 'module-builder',
    blurb: 'How the site looks and reads — layout, branding, and building it.',
  },
  migration: {
    label: 'Migration',
    color: 'neutral',
    blurb: 'Moving off your current platform without losing orders or history.',
  },
};

/** Falls back to a title-cased version of whatever the API returned, so a
 *  specialty added server-side still renders as a real word rather than a slug.
 *  The fallback carries an EMPTY blurb rather than an invented one — a surface
 *  that explains what a specialty means must not make it up. */
export function specialty(value: string): Specialty {
  return (
    SPECIALTIES[value] ?? {
      label: value.charAt(0).toUpperCase() + value.slice(1),
      color: 'neutral',
      blurb: '',
    }
  );
}
