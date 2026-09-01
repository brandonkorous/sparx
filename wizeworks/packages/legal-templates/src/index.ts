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
  /**
   * Facts this starter STATES that the platform cannot know, written as the owner
   * would read them back.
   *
   * Three of these templates put a NUMBER in the prose — a return window, a
   * processing time, a refund time — and a number on a published policy page is
   * indistinguishable from a decision. A shop that posts twice a week ships a page
   * promising one to two business days, and the page is the one that governs when
   * a customer disputes it.
   *
   * The numbers stay, because a policy page with a blank in it is worse than one
   * with a sensible default, and because issue 267 settled that NOTHING in this
   * body may address the owner — a shopper reads it. So the warning lives where
   * only the owner sees it: the checklist reads this list and says which
   * sentences are still guesses (issue 375).
   *
   * Absent means the starter asserts nothing specific about how this business
   * works — privacy, terms and cookies describe the platform's own behavior.
   */
  assumes?: readonly string[];
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

/**
 * The starter-text warning is NOT in the body, and must not go back into it.
 *
 * It used to be, prepended to all six templates, reasoned about as content that
 * "has two audiences". It does — and the second one is the problem: a shopper who
 * opens a clothing label's privacy page to decide whether to hand over an address
 * and a card read, in the shop's own voice, "This is starter wording, not legal
 * advice … take your own advice on it before you publish this page." One click of
 * Publish and that shipped, because it is content and content publishes (issue
 * 267).
 *
 * The owner still gets told, twice, where only the owner can see it: the Legal
 * pages surface badges every unreviewed page "Needs review" and says the same
 * sentence in its own words, and the content editor now says it above the body.
 * The structured signal is the entry's `legal_disclaimer_ack_at` column, which is
 * what "reviewed" has always meant.
 */

// ─── the catalog ─────────────────────────────────────────────────────────────

export const LEGAL_TEMPLATES: readonly LegalTemplate[] = [
  {
    legalKind: 'privacy',
    defaultSlug: 'privacy-policy',
    title: 'Privacy Policy',
    templateVersion: 4,
    requirement: 'always',
    doc: doc(
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
    templateVersion: 4,
    requirement: 'always',
    doc: doc(
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
    templateVersion: 4,
    requirement: 'always',
    doc: doc(
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
    templateVersion: 4,
    requirement: 'commerce',
    doc: doc(
      p('We want you to be happy with your purchase. This policy explains how returns work.'),
      h('Return window'),
      p(
        'You may request a return within 30 days of delivery. Items should be unused and in their original condition and packaging unless they arrived damaged or defective.'
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
    assumes: [
      'that returns are accepted for 30 days after delivery',
      'that items must come back unused and in their original packaging',
      'that any non-returnable item is pointed out at checkout',
    ],
  },
  {
    legalKind: 'shipping',
    defaultSlug: 'shipping-policy',
    title: 'Shipping Policy',
    templateVersion: 4,
    // OPTIONAL, not 'commerce'. Selling is not shipping: a bakery taking
    // collection orders, a restaurant booking tables and a seller of downloads
    // all have commerce switched on and post nothing, and forcing this on them
    // made the checklist unreachable — it demanded a policy for something the
    // business does not do, so "5 of 5 ready" could never honestly be true.
    // Businesses that DO ship are prompted by evidence instead: see
    // shipsButHasNoShippingPolicy() below, which fires on a signal that they
    // ship rather than on the mere presence of a shop.
    requirement: 'optional',
    doc: doc(
      p('This policy explains how and when we ship orders.'),
      h('Processing time'),
      p(
        'Orders are usually processed within one to two business days before they ship. Processing may take longer during busy periods.'
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
    assumes: [
      'that you pack and send an order within one to two working days',
      'that tracking is sent when an order ships',
    ],
  },
  {
    legalKind: 'refund',
    defaultSlug: 'refund-policy',
    title: 'Refund Policy',
    templateVersion: 4,
    requirement: 'optional',
    doc: doc(
      p('This policy explains when and how refunds are issued.'),
      h('Eligibility'),
      p(
        'Refunds are issued for eligible returns and for orders that cannot be fulfilled, in accordance with our Return Policy.'
      ),
      h('How refunds are issued'),
      ul([
        'Refunds are made to your original payment method unless otherwise agreed.',
        'Once approved, refunds are usually processed within five to ten business days.',
        'Your bank or card issuer may take additional time to post the refund.',
      ]),
      h('Shipping costs'),
      p(
        'Original shipping charges may be non-refundable except where an item arrived damaged, defective, or incorrect.'
      ),
      h('Contact'),
      p('Questions about a refund? Contact us with your order number and we will help.')
    ),
    assumes: [
      'that a refund is paid within five to ten working days of being approved',
      'that you keep the original delivery charge unless something arrived wrong',
    ],
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
