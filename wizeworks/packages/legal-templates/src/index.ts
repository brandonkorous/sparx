// sparx legal-page starter templates (docs/42 §3).
//
// Platform-authored, read-only starting points. When a tenant is created (or
// from the dashboard "Create from template" action), each instantiates into an
// editable CMS `page` content entry the tenant owns. Mirrors the catalog shape
// of wizeworks/packages/sitebuilder-schemas/src/page-templates.ts.
//
// Dependency-free on purpose: the doc nodes are plain JSON in the ProseMirror
// shape `@wizeworks/cms-editor`'s renderDocToHtml consumes (doc → paragraph /
// heading / bulletList / listItem / callout). No @wizeworks/cms-editor import so
// the seed worker and api-rest can pull this without dragging React in.

export type LegalKind = 'privacy' | 'terms' | 'cookie-policy' | 'returns' | 'shipping' | 'refund';

/** How the dashboard checklist treats a missing page of this kind. */
export type LegalRequirement = 'always' | 'commerce' | 'optional';

export interface LegalDoc {
  type: 'doc';
  content: DocNode[];
}
interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
}

export interface LegalTemplate {
  legalKind: LegalKind;
  /** Default slug for the seeded page (tenant may rename — checklist keys on legalKind). */
  defaultSlug: string;
  /** Page title + the checklist row label. */
  title: string;
  /** Bumped when the prose changes; drives the "newer template available" hint. */
  templateVersion: number;
  /** 'always' required, 'commerce' required only when the commerce module is on, else 'optional'. */
  requirement: LegalRequirement;
  /** The rich-text document stored under the page entry's `body` field. */
  doc: LegalDoc;
}

// ─── doc builders ────────────────────────────────────────────────────────────

const p = (text?: string): DocNode => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
});
const h = (text: string, level = 2): DocNode => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const ul = (items: string[]): DocNode => ({
  type: 'bulletList',
  content: items.map((t) => ({ type: 'listItem', content: [p(t)] })),
});
const doc = (...nodes: DocNode[]): LegalDoc => ({ type: 'doc', content: nodes });

/** The starter-text disclaimer prepended to every template body. It is content
 *  (survives editing) — the structured "reviewed?" signal lives on the entry's
 *  legal_disclaimer_ack_at column. */
const disclaimer = (): DocNode => ({
  type: 'callout',
  attrs: { variant: 'warning' },
  content: [
    p(
      'This is a starter template provided by sparx — not legal advice. Review it with your own counsel and tailor it to your business, jurisdiction, and how you handle data before publishing.'
    ),
  ],
});

// ─── the catalog ─────────────────────────────────────────────────────────────

export const LEGAL_TEMPLATES: readonly LegalTemplate[] = [
  {
    legalKind: 'privacy',
    defaultSlug: 'privacy-policy',
    title: 'Privacy Policy',
    templateVersion: 1,
    requirement: 'always',
    doc: doc(
      disclaimer(),
      p(
        'This Privacy Policy explains what personal information we collect, how we use it, and the choices you have. It applies to this website and the services offered here.'
      ),
      h('Information we collect'),
      p('Depending on how you interact with us, we may collect:'),
      ul([
        'Contact details you provide — name, email, phone, and shipping or billing address.',
        'Order and account information when you make a purchase or create an account.',
        'Usage and device information collected automatically, including via cookies.',
        'Messages you send us through forms, email, or support.',
      ]),
      h('How we use your information'),
      ul([
        'To process orders, payments, and deliveries.',
        'To provide customer support and respond to your requests.',
        'To send transactional messages and, where you have opted in, marketing.',
        'To operate, secure, and improve our site.',
        'To meet legal, tax, and accounting obligations.',
      ]),
      h('Sharing'),
      p(
        'We share personal information with service providers who help us run the business — such as payment processors, shipping carriers, and email providers — and where required by law. We do not sell your personal information.'
      ),
      h('Your rights'),
      p(
        'Depending on where you live, you may have rights to access, correct, delete, or port your personal information, and to opt out of certain processing. To make a request, contact us using the details below.'
      ),
      h('Cookies'),
      p(
        'We use cookies and similar technologies as described in our Cookie Policy, including the choices available to you.'
      ),
      h('Contact us'),
      p('Questions about this policy or your information? Contact us and we will help.')
    ),
  },
  {
    legalKind: 'terms',
    defaultSlug: 'terms-of-service',
    title: 'Terms of Service',
    templateVersion: 1,
    requirement: 'always',
    doc: doc(
      disclaimer(),
      p(
        'These Terms govern your use of this website and any purchases you make. By using the site or placing an order, you agree to these Terms.'
      ),
      h('Using this site'),
      p(
        'You agree to use the site lawfully and not to misuse it, interfere with its operation, or attempt to access it in unauthorized ways. We may update, suspend, or discontinue parts of the site at any time.'
      ),
      h('Orders and pricing'),
      ul([
        'All orders are subject to acceptance and availability.',
        'We make reasonable efforts to display accurate prices and descriptions; errors may occur and we may correct them.',
        'Prices and promotions can change without notice.',
      ]),
      h('Payment'),
      p(
        'You authorize us to charge your chosen payment method for the total of your order, including taxes and shipping where applicable.'
      ),
      h('Returns and refunds'),
      p(
        'Returns, exchanges, and refunds are governed by our Return Policy and Refund Policy, where applicable.'
      ),
      h('Intellectual property'),
      p(
        'The content on this site is owned by us or our licensors and is protected by applicable laws. You may not use it without permission except as allowed for normal use of the site.'
      ),
      h('Disclaimers and liability'),
      p(
        'The site and products are provided on an "as is" basis to the fullest extent permitted by law. Nothing in these Terms excludes liability that cannot lawfully be excluded.'
      ),
      h('Contact'),
      p('Questions about these Terms? Contact us using the details on this site.')
    ),
  },
  {
    legalKind: 'cookie-policy',
    defaultSlug: 'cookie-policy',
    title: 'Cookie Policy',
    templateVersion: 1,
    requirement: 'always',
    doc: doc(
      disclaimer(),
      p(
        'This Cookie Policy explains how we use cookies and similar technologies on this site, and the choices you have.'
      ),
      h('What are cookies'),
      p(
        'Cookies are small text files stored on your device. Some are essential for the site to work; others help us remember your preferences or understand how the site is used.'
      ),
      h('Categories we use'),
      ul([
        'Strictly necessary — required for core functionality such as signing in and keeping your cart. These cannot be switched off.',
        'Preferences — remember choices such as light or dark mode.',
        'Analytics — help us understand how the site is used so we can improve it.',
        'Marketing — used to deliver and measure relevant offers.',
      ]),
      h('Managing your choices'),
      p(
        'Where non-essential cookies are used, you can manage your preferences through the cookie banner or the "Manage cookies" link in the footer. You can also control cookies through your browser settings.'
      ),
      h('Contact'),
      p('Questions about our use of cookies? Contact us and we will be glad to help.')
    ),
  },
  {
    legalKind: 'returns',
    defaultSlug: 'returns-policy',
    title: 'Return Policy',
    templateVersion: 1,
    requirement: 'commerce',
    doc: doc(
      disclaimer(),
      p('We want you to be happy with your purchase. This policy explains how returns work.'),
      h('Return window'),
      p(
        'You may request a return within the period stated here (for example, 30 days of delivery). Items should be unused and in their original condition and packaging unless they arrived damaged or defective.'
      ),
      h('How to start a return'),
      ul([
        'Contact us with your order number and the items you would like to return.',
        'We will provide return instructions and, where applicable, a return label.',
        'Pack the items securely and send them back using the instructions provided.',
      ]),
      h('Non-returnable items'),
      p(
        'Some items may not be eligible for return — for example, perishable goods, personalized items, or final-sale products. We will note any exceptions at checkout.'
      ),
      h('Refunds'),
      p('Once we receive and inspect your return, refunds are issued per our Refund Policy.')
    ),
  },
  {
    legalKind: 'shipping',
    defaultSlug: 'shipping-policy',
    title: 'Shipping Policy',
    templateVersion: 1,
    requirement: 'commerce',
    doc: doc(
      disclaimer(),
      p('This policy explains how and when we ship orders.'),
      h('Processing time'),
      p(
        'Orders are typically processed within the timeframe stated here (for example, 1–2 business days) before they ship. Processing may take longer during busy periods.'
      ),
      h('Shipping methods and rates'),
      p(
        'Available shipping methods, estimated delivery times, and rates are shown at checkout based on your destination and order.'
      ),
      h('Tracking'),
      p('When your order ships, we will send a confirmation with tracking where available.'),
      h('Delays, lost, or damaged shipments'),
      p(
        'We are not responsible for carrier delays, but we will help you resolve issues with lost or damaged shipments — contact us with your order number.'
      )
    ),
  },
  {
    legalKind: 'refund',
    defaultSlug: 'refund-policy',
    title: 'Refund Policy',
    templateVersion: 1,
    requirement: 'optional',
    doc: doc(
      disclaimer(),
      p('This policy explains when and how refunds are issued.'),
      h('Eligibility'),
      p(
        'Refunds are issued for eligible returns and for orders that cannot be fulfilled, in accordance with our Return Policy.'
      ),
      h('How refunds are issued'),
      ul([
        'Refunds are made to your original payment method unless otherwise agreed.',
        'Once approved, refunds are typically processed within the timeframe stated here.',
        'Your bank or card issuer may take additional time to post the refund.',
      ]),
      h('Shipping costs'),
      p(
        'Original shipping charges may be non-refundable except where an item arrived damaged, defective, or incorrect.'
      ),
      h('Contact'),
      p('Questions about a refund? Contact us with your order number and we will help.')
    ),
  },
] as const;

/** All known legal kinds, in catalog order. */
export const LEGAL_KINDS: readonly LegalKind[] = LEGAL_TEMPLATES.map((t) => t.legalKind);

export function getLegalTemplate(kind: LegalKind): LegalTemplate | undefined {
  return LEGAL_TEMPLATES.find((t) => t.legalKind === kind);
}

/** The kinds that count as "required" for a tenant — always-required plus the
 *  commerce-conditional ones when the commerce module is enabled. Drives the
 *  dashboard checklist's complete/missing math. */
export function requiredLegalKinds(opts: { commerceEnabled: boolean }): LegalKind[] {
  return LEGAL_TEMPLATES.filter(
    (t) => t.requirement === 'always' || (t.requirement === 'commerce' && opts.commerceEnabled)
  ).map((t) => t.legalKind);
}

/** Build the CMS `page` entry body for a template (shape `{ title, body: doc }`,
 *  matching what the storefront PageView + dashboard editor expect). */
export function legalEntryBody(t: LegalTemplate): { title: string; body: LegalDoc } {
  return { title: t.title, body: t.doc };
}
