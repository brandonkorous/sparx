/**
 * Example businesses — the marketing site's shared, app-wide fixture set.
 *
 * sparx is industry-agnostic, so NO marketing surface anchors on one vertical
 * (see the rotation rule in `.claude/agents/marketing-designer.md` and the
 * `feedback-industry-agnostic-no-diesel` memory). Any page that shows
 * customer-like example data — a receipt, a checkout, a CRM record, an invoice
 * — pulls from THIS list and crossfades through it via `<Cycle>`
 * (components/marketing/cycle.tsx). One source of truth, every vertical
 * represented, nothing hard-coded per page.
 *
 * Each entry is a COMPLETE, internally-coherent fixture: its own customer,
 * products, and a real order whose subtotal + shipping + tax === total, so any
 * surface renders a believable scene without faking math. Keep every entry the
 * same SHAPE (two products each) so rotating surfaces never reflow as they
 * crossfade. The spread is deliberate — home goods, grocery, pet, coffee, and a
 * B2B/wholesale account — so no single industry reads as "what sparx is for."
 */

export interface ExampleProduct {
  name: string;
  sku: string;
  qty: number;
  /** formatted USD line total, e.g. '$432.00'. */
  price: string;
}

export interface ExampleBusiness {
  /** short vertical label — for clarity + aria, not usually shown. */
  vertical: string;
  /** store/brand name, e.g. 'Flax & Fern'. */
  name: string;
  /** primary domain, e.g. 'flaxandfern.com'. */
  domain: string;
  customer: {
    name: string;
    email: string;
    address: string;
  };
  order: {
    number: string;
    products: ExampleProduct[];
    subtotal: string;
    shipping: { label: string; value: string };
    tax: { label: string; value: string };
    total: string;
    /** payment method(s), e.g. 'Apple Pay · Stripe'. */
    paidWith: string;
  };
}

export const EXAMPLE_BUSINESSES: ExampleBusiness[] = [
  {
    vertical: 'home goods',
    name: 'Flax & Fern',
    domain: 'flaxandfern.com',
    customer: { name: 'Dana Ruiz', email: 'dana.ruiz@gmail.com', address: '412 Maple Ave' },
    order: {
      number: 'Order #1042',
      products: [
        { name: 'Linen Bedding Set', sku: 'SKU LBS-2', qty: 2, price: '$432.00' },
        { name: 'Down Pillow', sku: 'SKU DP-1', qty: 1, price: '$54.00' },
      ],
      subtotal: '$486.00',
      shipping: { label: 'Shipping · UPS Ground', value: '$14.50' },
      tax: { label: 'Tax · auto-calculated', value: '$38.88' },
      total: '$539.38',
      paidWith: 'Apple Pay · Stripe',
    },
  },
  {
    vertical: 'grocery',
    name: 'Hudson Farm Stand',
    domain: 'hudsonfarmstand.com',
    customer: { name: 'Marcus Lee', email: 'marcus@hudsonfarm.co', address: '88 Orchard Ln' },
    order: {
      number: 'Order #1043',
      products: [
        { name: 'Organic Strawberries', sku: 'SKU STR-FL', qty: 4, price: '$72.00' },
        { name: 'Raw Honey, 16oz', sku: 'SKU HNY-16', qty: 2, price: '$28.00' },
      ],
      subtotal: '$100.00',
      shipping: { label: 'Shipping · Local pickup', value: '$0.00' },
      tax: { label: 'Tax · exempt (grocery)', value: '$0.00' },
      total: '$100.00',
      paidWith: 'Link · Stripe',
    },
  },
  {
    vertical: 'pet',
    name: 'Waggle Pet Co',
    domain: 'wagglepetco.com',
    customer: { name: 'Priya Nair', email: 'priya@waggle.shop', address: '23 Birch St' },
    order: {
      number: 'Order #1044',
      products: [
        { name: 'Leather Dog Collar', sku: 'SKU DOG-CLR', qty: 1, price: '$38.00' },
        { name: 'Engraved Name Tag', sku: 'SKU TAG-EN', qty: 1, price: '$14.00' },
      ],
      subtotal: '$52.00',
      shipping: { label: 'Shipping · USPS First Class', value: '$4.95' },
      tax: { label: 'Tax · auto-calculated', value: '$4.16' },
      total: '$61.11',
      paidWith: 'Apple Pay · Stripe',
    },
  },
  {
    vertical: 'coffee',
    name: 'North Loop Roasters',
    domain: 'northlooproasters.com',
    customer: { name: 'Sam Carter', email: 'sam.carter@gmail.com', address: '17 Cedar Ct' },
    order: {
      number: 'Order #1045',
      products: [
        { name: 'Whole-Bean Sampler', sku: 'SKU WBS-3', qty: 3, price: '$54.00' },
        { name: 'Pour-Over Kit', sku: 'SKU POK-1', qty: 1, price: '$42.00' },
      ],
      subtotal: '$96.00',
      shipping: { label: 'Shipping · USPS Priority', value: '$8.75' },
      tax: { label: 'Tax · auto-calculated', value: '$7.68' },
      total: '$112.43',
      paidWith: 'Google Pay · Stripe',
    },
  },
  {
    vertical: 'b2b wholesale',
    name: 'Atlas Supply Co',
    domain: 'atlassupply.co',
    customer: {
      name: 'Reyes Fabrication',
      email: 'orders@reyesfab.com',
      address: '90 Foundry Rd',
    },
    order: {
      number: 'Order #1046',
      products: [
        { name: 'Hydraulic Hose Kit', sku: 'SKU HHK-08', qty: 6, price: '$390.00' },
        { name: 'Bearing Set', sku: 'SKU BRG-32', qty: 4, price: '$120.00' },
      ],
      subtotal: '$510.00',
      shipping: { label: 'Shipping · Freight (LTL)', value: '$48.00' },
      tax: { label: 'Tax · resale exempt', value: '$0.00' },
      total: '$558.00',
      paidWith: 'ACH · Stripe',
    },
  },
];
