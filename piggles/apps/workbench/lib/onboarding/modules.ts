// The module switchboard — the catalog the onboarding "switch on what you use"
// surface is built from, plus the dependency graph that keeps a selection honest.
//
// Client-safe by construction (no server import): flipping a switch recomputes the
// selection in the browser with no round-trip. The API enforces the authoritative
// graph (b2b→commerce, the bundled rules) on save; this file is the user-intended
// set the UI drives from.
//
// THERE ARE NO PRICES HERE, and there must not be. Every app is in the one flat
// plan (RULE #2) and the console never knows a price. This file carried `price`
// and `elsewhere` per module, and the onboarding summary added them into a
// running total with a "you save $N vs elsewhere" line — a per-module bill, on
// the surface that introduces a product whose whole promise is that there is no
// such thing. It was inherited wholesale and it contradicted the marketing site
// on the same account.
//
// A row carries NO color of its own. The workbench's module-hue mechanism is
// `ModuleScope` (data-module ⇒ --color-module), so a row that wants a module's
// accent wraps in <ModuleScope module={m.key}> and its children read `bg-module` /
// `text-module`. A `colorVar` field used to sit here holding
// `var(--color-module-<key>)` per entry; nothing ever read it, and duplicating the
// palette in TS is exactly the drift the tokens exist to prevent.
//
// Switching one on changes the WORKSPACE, not the bill — so this list is about
// what somebody wants on screen, never about what they are buying.
//
// AND IT SPEAKS PIGGLES, which it did not. This whole catalog arrived from sparx
// and kept sparx's words on a screen a Piggles owner meets before anything else:
// rows called CMS, CRM and AI · MCP; sentences about a typed API, headless SDKs,
// TTFB, JSON-LD and WMS; and a `replaces` line naming thirteen other companies by
// name, which shipped artifacts do not do (root CLAUDE.md). It read as a developer
// pitch because it was one (persona issue 362).
//
// The names are the ones the rail already uses, from `@piggles/config`'s APPS,
// EXCEPT where one app fronts several capabilities: "Sell" covers commerce, trade
// and dropshipping, and this board has a row for each, so the two that are not the
// app itself are named for what they do. `replaces` says what an owner stops paying
// for, without naming who they stop paying.

export interface SwitchboardModule {
  /** Module slug — also the brand color key (`--color-module-<key>`). */
  key: string;
  name: string;
  desc: string;
  long: string;
  feats: string[];
  replaces: string;
  /** The less common ones, grouped under their own divider so the everyday apps
   *  read as a short list. A GROUPING, not a tier — they cost nothing extra and
   *  nothing here is withheld. */
  addon?: boolean;
}

export const SWITCHBOARD_MODULES: SwitchboardModule[] = [
  {
    key: 'builder',
    name: 'My Site',
    desc: 'Your pages, your look, your address',
    long: 'The website itself. Start from a design that already looks finished, change the words and pictures by clicking on them, and point your own web address at it when you are ready. It loads quickly wherever somebody is, and the security certificate is arranged for you.',
    feats: [
      'Pages you edit by clicking on them',
      'Designs that already look finished',
      'Your own web address, set up for you',
      'Fast wherever your visitor happens to be',
    ],
    replaces: 'a website builder and a separate hosting bill',
  },
  {
    key: 'commerce',
    name: 'Sell',
    desc: 'Basket, checkout, orders',
    long: 'Everything it takes to take money: what you sell, how many you have left, the basket, the checkout, tax and postage. One checkout page rather than four, because every extra step is somebody deciding not to bother.',
    feats: [
      'Sizes and colors, with what is left of each',
      'Card, wallet and pay-later at the checkout',
      'Tax worked out for you',
      'Postage prices and labels',
    ],
    replaces: 'a shop platform plus the add-ons it needs for tax and postage',
  },
  {
    key: 'cms',
    name: 'Content',
    desc: 'Writing, pictures, being found',
    long: 'A proper place to write. Journal entries, guides, anything with words in it, with every version kept so you can always go back to one. Pictures are tidied and resized for you, and each piece is checked for how easily people will find it.',
    feats: [
      'Write it, save it, go back to any version',
      'One library for every picture and file',
      'Pictures resized and tidied for you',
      'Each page checked for how findable it is',
    ],
    replaces: 'a separate writing tool and somewhere to keep your pictures',
  },
  {
    key: 'crm',
    name: 'Customers',
    desc: 'Who they are, and what they did',
    long: 'One record for each person, holding all of it: what they bought, what you sent them, what they asked you. Nothing to keep in step and no duplicates, because it is the same place everything else here works from.',
    feats: [
      'One record per person, never two',
      'Groups that keep themselves up to date',
      'Where each sale has got to',
      'Everything they have ever done, in order',
    ],
    replaces: 'a customer database and the work of keeping it in step',
  },
  {
    key: 'email',
    name: 'Messages',
    desc: 'Receipts, reminders, and what you write',
    long: 'Both kinds of email. The ones that go out on their own, like a receipt or a booking reminder, and the ones you write to everybody. Sent from your own address, with the fiddly technical setup done for you so they arrive rather than land in spam.',
    feats: [
      'Receipts and reminders that send themselves',
      'Write to everybody, or to one group',
      'Sent from your own address',
      'Never charged by the email',
    ],
    replaces: 'a mailing-list service and a separate receipts service',
  },
  {
    key: 'b2b',
    name: 'Trade customers',
    desc: 'Wholesale, accounts, paying later',
    long: 'For selling to other businesses rather than to people. Their own prices, buying on account and paying later, purchase orders at the checkout, and quotes you send back. Part of the same shop, not a second one.',
    feats: [
      'Different prices for different accounts',
      'Pay in 15, 30, 60 or 90 days',
      'Purchase orders at the checkout',
      'Quotes you send, and they accept',
    ],
    replaces: 'a wholesale add-on, or a second shop for trade',
  },
  {
    key: 'ai',
    name: 'Connections',
    desc: 'Let an AI assistant help',
    long: 'Connect the AI assistant you already use and let it read and change your own business, in plain English. You say what it is allowed near, everything it does is written down, and you can cut it off in one press.',
    feats: [
      'Works with the assistants people already use',
      'Ask in plain English, get real answers',
      'You choose what it is allowed near',
      'Everything written down, and cut off in one press',
    ],
    replaces: 'wiring your tools together by hand',
  },
  {
    key: 'scheduling',
    name: 'Bookings',
    desc: 'Appointments, classes, tables',
    long: 'Taking bookings for anything that happens at a time: appointments, group classes, tables, hire. Two people can never end up in the same slot, you can ask for a deposit, and the reminders go out on their own.',
    feats: [
      'Appointments, classes, tables and hire',
      'Two bookings can never take one slot',
      'Deposits, and a charge for not turning up',
      'Reminders by email and text',
    ],
    replaces: 'a booking service and the diary juggling around it',
  },
  {
    key: 'dropship',
    name: 'Dropshipping',
    desc: 'Sell without holding the stock',
    long: 'Sell things you never touch. Your suppliers keep you up to date on what they have, each order goes to whoever should send it, and your markup is worked out on every line.',
    feats: [
      'Suppliers connected however they work',
      'Your own markup, set per supplier',
      'Each order sent to the right supplier',
      'Stock numbers that keep themselves current',
    ],
    replaces: 'a dropshipping add-on and the spreadsheet behind it',
  },
  {
    key: 'invoicing',
    name: 'Invoices',
    desc: 'Quotes, invoices, what you are owed',
    long: 'Write a quote line by line, turn it into an invoice, and follow it through the stages you name yourself. Parts with your markup on, hours at your rate, deposits and part payments, and a running total of what is still outstanding. Comes with Sell or Trade customers.',
    feats: [
      'Quotes that turn into invoices',
      'Parts, hours, and one-off charges',
      'Deposits, and paying in parts',
      'What you are owed, and how late it is',
    ],
    replaces: 'a separate invoicing service',
    addon: true,
  },
  {
    key: 'inventory',
    name: 'Stock',
    desc: 'What you have, and where it is',
    long: 'A real stock system underneath what you sell. Counts for each place you keep things, with every movement written down so any number can be explained, batches and serial numbers, and a nudge before you run out. Comes with Sell or Trade customers.',
    feats: [
      'Counts for each place you keep stock',
      'Every change written down, and who made it',
      'Batches, serial numbers and use-by dates',
      'A nudge before you run out',
    ],
    replaces: 'a stock system bolted onto your shop',
    addon: true,
  },
  {
    key: 'chat',
    name: 'Live chat',
    desc: 'A chat box, and who answers it',
    // No marketplace sentence. sparx.market is a sparx PRODUCT, not a Piggles
    // capability, and the fork inherited the copy naming it — piggles/CLAUDE.md
    // RULE #0. Renaming it would offer a listing nobody can sign up for.
    long: 'A chat box on every page, in your own colors. It answers questions about your things and your policies out of what you have already written, and hands you anything it cannot answer itself.',
    feats: [
      'A chat box in your own colors',
      'Answers taken from your own pages',
      'One inbox for whatever it hands over',
      'You are told wherever you happen to be',
    ],
    replaces: 'a live chat service',
    addon: true,
  },
];

export const MODULE_BY_KEY: Record<string, SwitchboardModule> = Object.fromEntries(
  SWITCHBOARD_MODULES.map((m) => [m.key, m])
);
