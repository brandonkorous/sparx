// /switching: what "Move in from somewhere else" reads, from where.
//
// Mirrors wizeworks/packages/migration/src/vendors/*.ts as of 2026-09-30: one
// row per adapter, listing only the kinds of record that adapter maps, in the
// owner's words. The marketing app does not depend on that package, so this is a
// copy. When an adapter gains or loses a kind of record, this list changes in
// the same commit, because a promise that a blog will move is one a person
// plans a weekend around.

export interface Source {
  name: string;
  /** What comes across, in plain words. */
  brings: string[];
  /** A read-only key can be pasted instead of dropping files. */
  liveKey?: boolean;
}

export const SOURCE_GROUPS: { title: string; body: string; sources: Source[] }[] = [
  {
    title: 'Online shops',
    body: 'Products, customers and past orders, from the exports these platforms already make.',
    sources: [
      {
        name: 'Shopify',
        brings: [
          'products',
          'customers',
          'past orders',
          'stock per location',
          'discount codes',
          'redirects',
          'collections, pages and blog posts (with a key)',
        ],
        liveKey: true,
      },
      { name: 'Square', brings: ['item library', 'stock per location', 'customers'] },
      { name: 'WooCommerce', brings: ['products', 'customers', 'pages and posts'], liveKey: true },
      { name: 'BigCommerce', brings: ['products', 'customers', 'past orders'] },
      { name: 'Etsy', brings: ['listings', 'buyers', 'sold orders'] },
      { name: 'Big Cartel', brings: ['products', 'past orders'] },
      { name: 'Adobe Commerce', brings: ['products', 'customers', 'stock'] },
      { name: 'GoDaddy', brings: ['products', 'customers'] },
    ],
  },
  {
    title: 'Website builders and publishing',
    body: 'Pages and posts come across as your own content, ready to arrange. Your old design does not.',
    sources: [
      { name: 'WordPress', brings: ['pages and posts'], liveKey: true },
      {
        name: 'Squarespace',
        brings: ['products', 'past orders', 'contacts', 'pages and blog posts'],
      },
      { name: 'Wix', brings: ['products', 'contacts', 'past orders'] },
      { name: 'Webflow', brings: ['pages and posts', 'products'] },
      { name: 'Ghost', brings: ['posts', 'members'] },
      { name: 'Substack', brings: ['posts', 'subscribers'] },
      { name: 'Framer', brings: ['pages and posts'] },
    ],
  },
  {
    title: 'Customer lists and email',
    body: 'People, the companies they work for and the deals in progress, with their email consent exactly as it was.',
    sources: [
      {
        name: 'HubSpot',
        brings: ['contacts', 'companies', 'deals', 'tickets'],
        liveKey: true,
      },
      { name: 'Salesforce', brings: ['contacts', 'accounts', 'opportunities', 'cases'] },
      { name: 'Pipedrive', brings: ['people', 'organizations', 'deals'] },
      { name: 'Mailchimp', brings: ['audience'] },
      { name: 'Klaviyo', brings: ['profiles', 'lists'] },
    ],
  },
];

export const SWITCHING_QUESTIONS = [
  {
    q: 'Do I have to stop using my old software to try Piggles?',
    a: 'No. Moving in reads a copy of your records and changes nothing on the old platform. Many people run both for a week or two, then point their domain at Piggles when they are ready.',
  },
  {
    q: 'What if my platform is not on the list?',
    a: 'Export a spreadsheet from it. Move in guesses what each column means, lets you correct it, and counts how many rows will import before anything is saved.',
  },
  {
    q: 'Will my customers get emails because I moved?',
    a: 'No. Moving in sends nothing to your customers: no welcome emails and no order confirmations. Each person’s email consent comes across as it was, and someone who had not agreed to marketing is never subscribed by the move.',
  },
  {
    q: 'What happens to the key I paste in?',
    a: 'It is used to read your records, only for as long as the move takes, and nothing about it is kept afterward. Use a read-only key, and you can remove it on the old platform when you are done.',
  },
  {
    q: 'Can I run the same import twice?',
    a: 'Yes. Customers are matched by email address, products by their handle or code, orders by their number and posts by their address, so a second run brings in what is new instead of copying what came before. A customer with no email address cannot be matched, so check those after a second run.',
  },
  {
    q: 'What about my website design?',
    a: 'Designs do not move between platforms, anywhere. You pick a look in Piggles, set your colors and fonts, and arrange ready-made sections. Your pages and posts, where your platform exports them, come across as content ready to place.',
  },
];
