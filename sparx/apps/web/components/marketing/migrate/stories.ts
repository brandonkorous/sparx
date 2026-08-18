// One story per platform somebody is leaving.
//
// These pages exist because the person reading them has that platform open in the
// next tab, is annoyed about something specific, and is trying to find out whether
// leaving is a week of their life. Generic switching copy answers none of that.
//
// So each story is written for ONE audience with ONE grievance, and the beats go in
// the order the reader is already thinking in:
//
//   promise      the week you are dreading is an afternoon
//   recognition  the specific thing that made you open this tab
//   the turn     why the answer is a different SHAPE of product, not a cheaper one
//   consequences what that actually changes about your week
//   honesty      what does not come across, said before you find out
//   resolution   here is the file, here is the button
//
// What the page does NOT contain is a list of what we import. That is computed from
// `@wizeworks/migration`'s registry at render time, so a page can only ever claim an
// entity an adapter genuinely maps. The prose here and the capability there cannot
// drift, and the reason that rule exists is that this route previously advertised
// four importers that did not exist.

export interface Beat {
  title: string;
  body: string;
}

export interface MigrateStory {
  /** Matches the vendor slug in `@wizeworks/migration`. */
  slug: string;
  /** How they spell their own name. */
  name: string;
  /** What they ARE, in the reader's words — used in running prose. */
  noun: string;

  seoTitle: string;
  seoDescription: string;
  keywords: string[];

  /** The promise. One sentence, and it is about them, not us. */
  headline: string;
  lede: string;

  /** Recognition — the reason this tab is open. Two or three, escalating. */
  painTitle: string;
  pains: Beat[];

  /** The turn. Why the fix is a different shape, not a cheaper version. */
  turnTitle: string;
  turnBody: string;

  /** What changes about their week once it has moved. */
  consequences: string[];

  /** Said out loud, before they find out. */
  limits: string[];

  /** How long it really takes. */
  effort: string;
}

export const MIGRATE_STORIES: MigrateStory[] = [
  {
    slug: 'shopify',
    name: 'Shopify',
    noun: 'store',
    seoTitle: 'Move from Shopify to sparx',
    seoDescription:
      'Bring your Shopify products, variants, customers, orders, stock levels and discount codes across with the export files Shopify already makes. Most catalogues land in an afternoon.',
    keywords: [
      'shopify alternative',
      'migrate from shopify',
      'shopify import',
      'leave shopify',
      'shopify to sparx',
    ],
    headline: 'Your Shopify store, without the app bill',
    lede: 'Products, variants, customers, orders, stock by location and discount codes — from the export files Shopify already makes for you. No developer, no agency, no CSV surgery.',
    painTitle: 'You did not choose eleven subscriptions. They accumulated.',
    pains: [
      {
        title: 'Every gap is an app, and every app is another monthly bill',
        body: 'Reviews. Bundles. Wholesale pricing. Subscriptions. A proper stock count. Each one arrived to solve a real problem, and each one arrived with its own login, its own invoice and its own idea of what a customer is. Nobody decided to spend four hundred a month on plugins; it happened one reasonable decision at a time.',
      },
      {
        title: 'Your customer list lives in four places and agrees with itself in none',
        body: 'Shopify has one version of a customer. Your email tool has another. Your helpdesk has a third. When someone emails asking about an order, finding out who they are takes longer than answering them.',
      },
      {
        title: 'The things you actually need are the things that cost extra',
        body: 'B2B pricing, purchase orders, real stock across two locations, a CRM that knows what someone bought — these are not exotic requests. They are what running a business looks like after year two, and on Shopify each one is a different vendor.',
      },
    ],
    turnTitle: 'The problem was never Shopify. It was buying a business in pieces.',
    turnBody:
      'sparx is the store, the stock, the customers, the email and the site as one system that shares one database. A customer record already knows what they bought, what they asked, and what they owe — not because an app syncs it overnight, but because there is nothing to sync. That is why the app bill goes away rather than getting cheaper: there is nothing left to bolt on.',
    consequences: [
      'One invoice instead of eleven, and modules you can switch off when you stop using them.',
      'Stock that is right across every location, because one ledger writes it.',
      'A customer record that shows orders, emails and support in one place with no integration in the middle.',
      'B2B pricing, purchase orders and multi-location stock included rather than quoted.',
    ],
    limits: [
      'Collections, pages and blog posts have no native Shopify CSV export — those come from the live connection instead, or you can rebuild them in the builder.',
      'Your theme does not come with you. You choose a new one, and your content drops into it.',
      'Draft orders, gift card balances and app-specific data (subscription plans, loyalty points) stay behind.',
    ],
    effort:
      'A catalogue of a few thousand products and its customers usually lands in an afternoon. Orders and stock add another hour.',
  },

  {
    slug: 'woocommerce',
    name: 'WooCommerce',
    noun: 'store',
    seoTitle: 'Move from WooCommerce to sparx',
    seoDescription:
      'Bring your WooCommerce products and variations, customers, categories, posts, pages and media across from the exports WooCommerce and WordPress already make.',
    keywords: [
      'woocommerce alternative',
      'migrate from woocommerce',
      'woocommerce import',
      'leave wordpress ecommerce',
    ],
    headline: 'Stop being your own systems administrator',
    lede: 'Your products with their variations, your customers, and the whole WordPress side — posts, pages, categories, media and every old link — from the two exports you already have.',
    painTitle: 'You wanted a shop. You got a maintenance schedule.',
    pains: [
      {
        title: 'An update broke checkout, and you found out from a customer',
        body: 'Twenty-odd plugins, each on its own release cycle, each written by someone who has never met the other nineteen. The store works until a Tuesday morning when it does not, and the only way to know is that somebody could not pay you.',
      },
      {
        title: 'Nobody owns the whole thing',
        body: 'Hosting is one company. The theme is one developer. Payments are a plugin. Backups are another plugin, and you are fairly sure they are running. When something breaks, the first hour goes on working out whose problem it is.',
      },
      {
        title: 'Security is now your job, and you did not apply for it',
        body: 'Every plugin is a way in. Every abandoned plugin is a way in that nobody is watching. You are running a shop, not a server, and the difference stopped being obvious some time ago.',
      },
    ],
    turnTitle: 'The flexibility was real. So was the cost of maintaining it.',
    turnBody:
      'WordPress can be anything, which is why it needs twenty plugins to be a shop. sparx is already a shop, a CRM, a stock system and a publishing platform, built together and updated together by the people who made all of it. Nothing to patch on a Tuesday, and nothing to work out whose fault it is.',
    consequences: [
      'Updates happen to us, not to you, and checkout does not go down because a plugin author retired.',
      'Your posts, pages, categories and media come across with their old URLs redirected, so search rankings survive the move.',
      'One place to log in, one company responsible, and backups you do not have to verify.',
      'Hosting, SSL and the CDN are simply part of it.',
    ],
    limits: [
      'Comments do not come across — we have nowhere to put them, and most people leaving are leaving comment spam behind too.',
      'Menus are rebuilt in the builder, where navigation is a layout decision rather than a database table.',
      'Theme settings, widgets and page-builder layouts are meaningless off WordPress. Your writing comes; the shell is rebuilt.',
    ],
    effort:
      'Two files and about an hour for a shop with a few hundred products and a decade of posts. The redirects are automatic.',
  },

  {
    slug: 'bigcommerce',
    name: 'BigCommerce',
    noun: 'store',
    seoTitle: 'Move from BigCommerce to sparx',
    seoDescription:
      'Bring your BigCommerce products, variants, categories, customers and orders across from the CSV exports BigCommerce already makes.',
    keywords: [
      'bigcommerce alternative',
      'migrate from bigcommerce',
      'bigcommerce import',
      'bigcommerce sales threshold',
    ],
    headline: 'Growing should not move you into a more expensive plan',
    lede: 'Products with their variants and option sets, categories, customers and order history — from the CSV exports in your BigCommerce dashboard.',
    painTitle: 'A good year costs you money in a way that makes no sense.',
    pains: [
      {
        title: 'Your plan is priced on how much you sell',
        body: 'Cross a sales threshold and the bill goes up, for exactly the same software you were using the day before. You did not get more product. You got a better year, and an invoice that treats it as a problem.',
      },
      {
        title: 'The features you grew into are on the tier above the one you are on',
        body: 'Abandoned cart, faceted search, customer groups, price lists. Each is a real thing a growing shop needs, and each is the reason to move up a plan rather than something you simply have.',
      },
      {
        title: 'It is still only the shop',
        body: 'BigCommerce sells well and knows nothing about the rest of the business — the quotes, the trade accounts, the mailing list, the stock in the second unit.',
      },
    ],
    turnTitle: 'Pay for capability, not for succeeding.',
    turnBody:
      'sparx charges per module you switch on, not per pound you take. A record year costs exactly what a quiet one does. And the modules are not just commerce — the CRM, the stock system, the email and the site are the same product, so the shop stops being an island.',
    consequences: [
      'Your bill is the same in December as it is in February.',
      'Trade pricing, price lists and customer groups are the B2B module, not a tier.',
      'One place for a customer, whether they bought online, on a quote or over the phone.',
    ],
    limits: [
      'Option sets become product options, and complex option RULES (surcharge this combination, hide that one) do not come across — they are re-created where you need them.',
      'Blog posts and web pages are rebuilt in the builder; BigCommerce has no export for them.',
      'Gift certificate balances stay behind.',
    ],
    effort: 'Three files, most of an afternoon for a catalogue with real variant depth.',
  },

  {
    slug: 'magento',
    name: 'Adobe Commerce',
    noun: 'store',
    seoTitle: 'Move from Adobe Commerce (Magento) to sparx',
    seoDescription:
      'Bring your Magento catalogue — configurable products unpacked into real variants — plus customers and multi-source stock, from the standard data-transfer exports.',
    keywords: [
      'magento alternative',
      'adobe commerce alternative',
      'migrate from magento',
      'magento import',
    ],
    headline: 'You should not need a developer to change a price',
    lede: 'Your catalogue with configurable products unpacked into real variants, your customers, and stock across every source — from System → Data Transfer → Export.',
    painTitle: 'Everything is possible, and nothing is quick.',
    pains: [
      {
        title: 'Every change is a ticket',
        body: 'A new attribute, a shipping rule, a landing page. On paper you can do anything; in practice you file a request and wait, because the person who understands the install is not you and is not cheap.',
      },
      {
        title: 'The platform costs less than keeping it running',
        body: 'Hosting sized for Magento, a developer on retainer, an agency for upgrades, and an upgrade cycle that is itself a project. The licence was never the number that mattered.',
      },
      {
        title: 'It was built for a bigger company than yours',
        body: 'Multi-source inventory, complex catalogue rules, staged content. Serious capability, and a serious ongoing cost to operate, aimed at a team with people whose whole job this is.',
      },
    ],
    turnTitle: 'Enterprise capability, without the enterprise operating model.',
    turnBody:
      'sparx keeps what you actually use from Magento — real variants, multi-location stock, trade pricing, price lists, a proper API — and removes the part where using it requires someone else. The person who prices the products changes the prices.',
    consequences: [
      'Configurable products arrive as real variants with their options, not as a pile of orphan simple products.',
      'Stock arrives per source, so a two-warehouse catalogue stays a two-warehouse catalogue.',
      'An API and an MCP server, so anything you did automate keeps being automatable.',
      'No hosting to size, no upgrade project, no retainer.',
    ],
    limits: [
      'Per-store-view rows are skipped — you get the default view, which is the catalogue your shop is actually built on.',
      'Catalogue price rules, cart price rules and custom EAV attributes with their own logic do not come across.',
      'Your theme and any custom modules stay behind.',
    ],
    effort:
      'A large catalogue takes an afternoon. The configurable-product unpacking is the part that would otherwise take a fortnight.',
  },

  {
    slug: 'squarespace',
    name: 'Squarespace',
    noun: 'site',
    seoTitle: 'Move from Squarespace to sparx',
    seoDescription:
      'Bring your Squarespace products, orders, contacts, pages and blog posts across — with the old URLs redirected so your search rankings survive.',
    keywords: [
      'squarespace alternative',
      'migrate from squarespace',
      'squarespace export',
      'leave squarespace',
    ],
    headline: 'You have outgrown the website, not the taste',
    lede: 'Products with their options, orders, contacts, and every page and post you have written — with the old addresses redirected so nothing you have earned in search is lost.',
    painTitle: 'It was the right choice for the business you had then.',
    pains: [
      {
        title: 'Selling is the part that keeps hitting a wall',
        body: 'No real stock across locations, no trade pricing, no purchase orders, no way to tell a customer what they ordered last spring. The shop is a feature of the website rather than the other way round.',
      },
      {
        title: 'Everything past the website is somewhere else',
        body: 'The mailing list is Mailchimp. The invoices are somewhere else again. The customer who bought twice and emailed three times is four records in four places.',
      },
      {
        title: 'Your writing is trapped in the design',
        body: "Years of posts inside a system where moving them out is somebody else's weekend project.",
      },
    ],
    turnTitle: 'Keep the site. Add the business underneath it.',
    turnBody:
      'sparx builds sites too — but the site sits on top of a real commerce engine, a real CRM and a real stock system, so the shop can grow without you moving house again. Your writing comes with you, and so do your rankings.',
    consequences: [
      'Every post and page arrives with its old URL redirected to its new one, automatically.',
      'Products keep their options and their photos.',
      'Contacts become customers who remember what they bought.',
      'The next thing you need — trade pricing, a second location, invoicing — is a switch rather than a move.',
    ],
    limits: [
      'The design does not come across. You pick a new theme, and your content drops into it.',
      'Gallery blocks, custom code injections and Squarespace-specific blocks are rebuilt in the builder.',
      'Member areas and scheduling data stay behind.',
    ],
    effort: 'Two exports, and most sites are across in an evening.',
  },

  {
    slug: 'wix',
    name: 'Wix',
    noun: 'site',
    seoTitle: 'Move from Wix to sparx',
    seoDescription:
      'Bring your Wix products with their variants and correct prices, your contacts and your orders across from the CSV exports in your Wix dashboard.',
    keywords: ['wix alternative', 'migrate from wix', 'wix export', 'leave wix', 'wix lock in'],
    headline: 'Getting out of Wix is the hard part. Not any more.',
    lede: 'Products with their variants priced correctly, contacts with their subscription state, and your orders — from the three exports Wix does let you take.',
    painTitle: 'The easiest platform to start on is the hardest one to leave.',
    pains: [
      {
        title: 'Your site is not portable, and you found that out late',
        body: 'There is no export for the site itself. Whatever you built lives where you built it, which is a fine deal right up until the day you want a different arrangement.',
      },
      {
        title: 'The editor that made it easy is now in the way',
        body: 'Dragging boxes was perfect for eight pages. At eighty, with a shop attached, it is a slow way to make small changes and there is no faster way underneath it.',
      },
      {
        title: 'The shop stops where a real shop starts',
        body: 'No stock across locations, no trade accounts, no purchase orders, no customer history worth the name. Fine for a first hundred orders; thin at a thousand.',
      },
    ],
    turnTitle: 'A builder with a business underneath it.',
    turnBody:
      'sparx has a visual builder too — the difference is what it is sitting on. Commerce, CRM, stock, email and CMS are the same product sharing one database, so the site is the front of a business rather than the whole of it. And your data is yours: everything here exports.',
    consequences: [
      'Variant prices arrive correct, surcharges included — most importers read a Wix variant priced at parent-plus-four as free.',
      'Contacts keep their labels and their subscription state, so your mailing list stays legal.',
      'What you build here can always be taken away again, in the same shape it went in.',
    ],
    limits: [
      'The site design does not come across — Wix has no export for it. You choose a theme and rebuild the pages, which is usually an evening.',
      'Wix Bookings, Wix Blog posts and members areas stay behind.',
    ],
    effort:
      'The data is across in an hour. Rebuilding the pages is the real work, and it is a single evening for most sites.',
  },

  {
    slug: 'webflow',
    name: 'Webflow',
    noun: 'site',
    seoTitle: 'Move from Webflow to sparx',
    seoDescription:
      'Bring your Webflow CMS collections and ecommerce products across — including the custom fields that make a collection worth having.',
    keywords: [
      'webflow alternative',
      'migrate from webflow',
      'webflow cms export',
      'webflow ecommerce alternative',
    ],
    headline: 'A beautiful site is not a business',
    lede: 'Your CMS collections with every custom field intact, and your products — from the CSV exports Webflow makes per collection.',
    painTitle: 'The site is excellent. Everything behind it is missing.',
    pains: [
      {
        title: 'The CMS has limits you keep bumping into',
        body: 'Item caps, collection caps, reference-field caps. You design around them, which is a strange way to spend design time.',
      },
      {
        title: 'Commerce is bolted on, and it shows',
        body: 'No stock across locations, no trade pricing, no purchase orders, no customer record beyond an email address and an order.',
      },
      {
        title: 'There is no CRM, so there is a spreadsheet',
        body: 'Enquiries go to an inbox. Deals live in a spreadsheet. The person who filled in the form and the person who bought are, as far as the system is concerned, strangers.',
      },
    ],
    turnTitle: 'Keep designing. Stop stitching.',
    turnBody:
      'sparx has a real visual builder, and behind it the commerce, CRM, stock and email that Webflow expects you to buy elsewhere and wire together. The form that captures an enquiry writes to the same place the order does.',
    consequences: [
      'Custom collection fields come across as custom properties rather than being dropped — a Case Studies collection is not a blog post with three fields missing.',
      'The enquiry, the quote and the order are the same customer, automatically.',
      'No item caps.',
    ],
    limits: [
      'Interactions, animations and the visual design do not transfer. The structure and the content do.',
      'One CSV per collection, so a site with six collections is six files.',
    ],
    effort: 'One file per collection, a few minutes each.',
  },

  {
    slug: 'etsy',
    name: 'Etsy',
    noun: 'shop',
    seoTitle: 'Move from Etsy to your own shop',
    seoDescription:
      'Bring your Etsy listings, variations, sold orders and — crucially — your buyers across, reconstructed from the only file Etsy gives you.',
    keywords: [
      'etsy alternative',
      'sell off etsy',
      'own website instead of etsy',
      'etsy fees',
      'etsy export',
    ],
    headline: 'Own the customer, not just the listing',
    lede: 'Listings with their variations, sold orders, and a real buyer list rebuilt from your orders file — the customer list Etsy never gives you.',
    painTitle: 'You built the shop. They kept the relationship.',
    pains: [
      {
        title: 'The fees are a percentage of everything, forever',
        body: 'Listing, transaction, payment processing, and advertising you did not always ask for. On a good month the platform is your largest single cost, and it grows precisely as fast as you do.',
      },
      {
        title: 'You cannot email the people who bought from you',
        body: "They are Etsy's customers who happened to buy your work. There is no list, no way to tell them about a new collection, and no way to bring them back except paying to be seen again.",
      },
      {
        title: 'Your shop sits next to twelve near-copies of it',
        body: 'Search puts you beside people undercutting you, and the only lever is to spend more on ads inside the platform that is already taking a cut.',
      },
    ],
    turnTitle: 'Keep selling there. Stop only selling there.',
    turnBody:
      'This is not usually a switch — it is adding a shop you own beside the one you rent. The difference is that on your own site the buyer is yours: you can email them, they can find you directly, and a repeat order costs you nothing in commission.',
    consequences: [
      'A real customer list, rebuilt from your sold-orders file — the thing Etsy has never given you.',
      'Email built in, so a new collection is an email rather than an ad spend.',
      'Every repeat order is worth roughly a tenth more, because nobody takes a cut of it.',
    ],
    limits: [
      'Etsy reports stock per LISTING, not per variation, so quantities need a once-over after the move. Everything else lands as-is.',
      'Reviews stay on Etsy — they are theirs.',
      'Digital download files are re-uploaded once.',
    ],
    effort:
      'Two files from Shop Manager → Download Data. Under an hour for most shops, including the buyer list.',
  },

  {
    slug: 'square',
    name: 'Square',
    noun: 'shop',
    seoTitle: 'Move from Square to sparx',
    seoDescription:
      'Bring your Square item library, per-location stock counts and customer directory across — the best inventory export of any platform, imported properly.',
    keywords: [
      'square online alternative',
      'migrate from square',
      'square item library export',
      'weebly alternative',
    ],
    headline: 'Great at the counter. Thin everywhere else.',
    lede: 'Your item library with its variations, stock counted per location, and your customer directory — from the exports in your Square dashboard.',
    painTitle: 'The till is excellent. The rest is an afterthought.',
    pains: [
      {
        title: 'Square Online is a website attached to a POS',
        body: 'It works, and it stops at exactly the point where a proper online shop starts: no trade pricing, no purchase orders, no real reordering, no CRM.',
      },
      {
        title: 'You know what sold, not why or to whom',
        body: 'The customer directory holds names and emails. It does not hold the conversation, the quote, the complaint or the reason they stopped coming in.',
      },
      {
        title: 'Buying stock is still a spreadsheet',
        body: 'Square tells you what is low. It does not turn that into a purchase order, track what is on its way, or cost it when it lands.',
      },
    ],
    turnTitle: 'Keep the till. Put a real business behind it.',
    turnBody:
      'sparx takes the thing Square does best — stock counted honestly, per location — and puts a full commerce, purchasing and CRM system around it. Your three shops stay three shops, with three real counts.',
    consequences: [
      'Stock arrives per location, not merged into one number you then have to re-count.',
      'Unit costs come across, so margin reporting works on day one.',
      'Reordering becomes purchase orders with expected dates and landed costs.',
    ],
    limits: [
      'Square Online site pages are rebuilt in the builder.',
      'Modifiers and modifier sets become product options where they map cleanly; complex per-location pricing is re-created.',
      'Loyalty balances and gift card balances stay behind.',
    ],
    effort:
      'One item library export covers both the catalogue and the stock. Most shops are across in under an hour.',
  },

  {
    slug: 'bigcartel',
    name: 'Big Cartel',
    noun: 'shop',
    seoTitle: 'Move from Big Cartel to sparx',
    seoDescription:
      'Bring your Big Cartel products, options and orders across. Built for makers who have outgrown a five-product shop.',
    keywords: [
      'big cartel alternative',
      'migrate from big cartel',
      'big cartel export',
      'artist shop platform',
    ],
    headline: 'You have outgrown a five-product shop',
    lede: 'Your products with their options, and your order history — from the exports in your Big Cartel admin.',
    painTitle: 'It was perfect at twelve products. You have ninety.',
    pains: [
      {
        title: 'There is no reporting worth the name',
        body: 'What sold, roughly. Not what makes money, not what is about to run out, not who buys twice.',
      },
      {
        title: 'Stock is a number, not a system',
        body: 'One count, one place, no history of how it got there and no way to tell it apart from what is at the studio versus what is at the merch table.',
      },
      {
        title: 'Your buyers are a list of order emails',
        body: 'The person who has bought six times looks exactly like the person who bought once, because nothing is keeping score.',
      },
    ],
    turnTitle: 'The same simplicity, with room above it.',
    turnBody:
      'sparx starts as simple as you need — switch on commerce and nothing else, and it is a shop. The difference is what happens when you need the next thing: stock across two places, a mailing list, wholesale pricing for the shop that wants to stock you. It is a switch rather than a move.',
    consequences: [
      'Options become real product options with their own stock and prices.',
      'Repeat buyers are visible as repeat buyers.',
      'Wholesale is a module away when the first shop asks for a trade price.',
    ],
    limits: [
      'Your theme is rebuilt — Big Cartel themes are theirs.',
      'Discount codes are re-created; the export does not include them.',
    ],
    effort: 'Two files, half an hour.',
  },

  {
    slug: 'godaddy',
    name: 'GoDaddy',
    noun: 'site',
    seoTitle: 'Move from GoDaddy Websites + Marketing to sparx',
    seoDescription:
      'Bring your GoDaddy products and contact list across, including subscription state, from the exports in Websites + Marketing.',
    keywords: [
      'godaddy website builder alternative',
      'migrate from godaddy',
      'godaddy online store export',
    ],
    headline: 'A bundle is not a system',
    lede: 'Your products and your contact list, with subscription state intact — from the exports in Websites + Marketing.',
    painTitle: 'It came with the domain. That was the whole reasoning.',
    pains: [
      {
        title: 'Everything is basic, on purpose',
        body: 'The site builder, the store, the email tool. Each is the simplest version of itself, which is fine until one of them is the thing your business runs on.',
      },
      {
        title: 'There is no depth to grow into',
        body: 'No variants worth the name, no stock across locations, no CRM, no trade pricing. When you need one of those, you are not upgrading — you are leaving.',
      },
      {
        title: 'The upsells never stop',
        body: 'SEO tools, more email sends, a better plan. Each one a separate line on a renewal notice you have stopped reading.',
      },
    ],
    turnTitle: 'Move once, to something with a ceiling you will not reach.',
    turnBody:
      'sparx is the same one-login simplicity, built so that the next thing you need is already inside it. Turn on what you use, pay for that, and leave the rest switched off until it matters.',
    consequences: [
      'Your contact list keeps its subscription state, so nobody gets emailed who should not be.',
      'Products become products with real variants when you need them.',
      'The domain comes too — bring it, or buy a new one here.',
    ],
    limits: [
      'GoDaddy flattens variants into a single text field, so only the first option axis is recoverable. The rest are added once, here.',
      'The site design is rebuilt in the builder.',
    ],
    effort: 'Two files, under an hour.',
  },

  {
    slug: 'wordpress',
    name: 'WordPress',
    noun: 'site',
    seoTitle: 'Move from WordPress to sparx',
    seoDescription:
      'Bring every post, page, category, image and old URL across from one WordPress export — including the SEO titles your plugin owns.',
    keywords: [
      'wordpress alternative',
      'migrate from wordpress',
      'wordpress export xml',
      'wxr import',
      'leave wordpress',
    ],
    headline: 'Ten years of writing, moved in an hour',
    lede: 'Every post, page, category, image and old URL — from the single export file under Tools → Export. Your SEO titles come too.',
    painTitle: 'The writing is the asset. The platform is the liability.',
    pains: [
      {
        title: 'Five plugins are doing what should be one product',
        body: 'SEO, forms, caching, backups, security. Each an extra thing to update, an extra thing to break, and an extra place for something to go wrong on a weekend.',
      },
      {
        title: 'You are one abandoned plugin from a bad month',
        body: 'Every plugin is a door. The ones nobody maintains any more are doors nobody is watching, and you would not necessarily know which those are.',
      },
      {
        title: 'The moment you want to sell something, it starts again',
        body: 'A shop is another plugin, with another set of extensions, and the whole cycle repeats with money in it.',
      },
    ],
    turnTitle: 'Your writing is portable. The maintenance is not worth keeping.',
    turnBody:
      'sparx is a publishing platform with commerce, CRM, email and stock already in it — built and updated together. The part of WordPress you actually value is the archive, and the archive moves in one file.',
    consequences: [
      'Every old URL is redirected to its new one automatically, so a decade of links and rankings survive.',
      'Yoast and Rank Math titles and descriptions come across — most importers drop them, and you only notice in the traffic.',
      'Drafts stay drafts, published stays published, and the dates are the real dates.',
      'Nothing to update, ever.',
    ],
    limits: [
      'Comments do not come across.',
      'Menus and widgets are rebuilt in the builder.',
      'Shortcodes from plugins render as text and are cleaned up where they appear.',
    ],
    effort: 'One file. A thousand posts takes about twenty minutes, images included.',
  },

  {
    slug: 'ghost',
    name: 'Ghost',
    noun: 'publication',
    seoTitle: 'Move from Ghost to sparx',
    seoDescription:
      'Bring your Ghost posts, pages, tags and members across from the JSON backup and the members CSV.',
    keywords: ['ghost alternative', 'migrate from ghost', 'ghost export json', 'ghost members'],
    headline: 'Publishing is solved. The business around it is not.',
    lede: 'Posts and pages with their tags intact, and your members list — from the JSON backup and the members export.',
    painTitle: 'You write. Then everything else needs a different tool.',
    pains: [
      {
        title: 'Selling anything means leaving',
        body: 'A book, a workshop, a print, a consulting hour. Ghost is not a shop and does not pretend to be, so anything you sell lives somewhere else with its own customer list.',
      },
      {
        title: 'Your members and your customers are different people to the software',
        body: 'The person on the paid tier and the person who bought the book are two records, and nothing tells you they are one human being.',
      },
      {
        title: 'The site is the publication and nothing more',
        body: 'No landing pages worth the name, no CRM, no way to run the part of the business that is not writing.',
      },
    ],
    turnTitle: 'Keep the writing. Add the rest of what you do.',
    turnBody:
      'sparx publishes as well as Ghost does and then keeps going: the shop, the customers, the email and the site are the same system. The subscriber who buys the book is one record, because there is only one place records live.',
    consequences: [
      'Tags survive — most CMS migrations flatten taxonomy, and you find out later.',
      'Members become customers who can also buy things.',
      'Selling a course, a print or an hour is a switch, not a second platform.',
    ],
    limits: [
      'Stripe subscription state stays with Stripe; paid members come across as members, and billing is re-connected here.',
      'Ghost themes do not transfer.',
      'Newsletters already sent stay in Ghost.',
    ],
    effort: 'Two files, under half an hour.',
  },

  {
    slug: 'substack',
    name: 'Substack',
    noun: 'newsletter',
    seoTitle: 'Move from Substack to sparx',
    seoDescription:
      'Bring your Substack posts and subscribers across, with paid and free clearly marked — and stop paying a tenth of your revenue.',
    keywords: [
      'substack alternative',
      'migrate from substack',
      'substack export',
      'substack 10 percent',
      'own your newsletter',
    ],
    headline: 'Ten per cent of everything, forever',
    lede: 'Your posts and your subscriber list, with paid and free clearly marked — from the export under Settings.',
    painTitle: 'The maths gets worse exactly as it goes well.',
    pains: [
      {
        title: 'The cut is a percentage, so success costs more',
        body: 'Ten per cent of subscription revenue, plus payment processing. At a hundred subscribers it is a rounding error. At three thousand it is a salary.',
      },
      {
        title: 'It is their site, with your name on it',
        body: "The design, the URL structure, the recommendations pointing readers at other people's newsletters. You are a tenant with good furniture.",
      },
      {
        title: 'You can only ever do one thing',
        body: 'It is a newsletter. Not a shop, not a course, not a members area, not a business — and every one of those is where a newsletter that works eventually goes.',
      },
    ],
    turnTitle: 'Keep the readers. Keep the money.',
    turnBody:
      'sparx sends the newsletter, hosts the site, takes the payments and runs the shop, for a flat monthly fee that does not care how well you are doing. The same list, on infrastructure you own.',
    consequences: [
      'Paid and free subscribers arrive tagged as such, so you can mail them differently from day one.',
      'A flat fee instead of a percentage — at three thousand paid subscribers that is most of a salary back.',
      'Sell a book, a course or a workshop to the same list, without a second platform.',
    ],
    limits: [
      "Substack's posts.csv is an index — the writing is in HTML files beside it. Drop the whole export folder so the bodies come too.",
      'Paid posts arrive as drafts rather than public, so migration day does not put your paywalled archive on the open web.',
      'Stripe billing is re-connected here; existing subscriptions do not transfer automatically.',
    ],
    effort:
      'The subscriber list is minutes. The archive depends on how much you have written — usually under an hour.',
  },

  {
    slug: 'framer',
    name: 'Framer',
    noun: 'site',
    seoTitle: 'Move from Framer to sparx',
    seoDescription:
      'Bring your Framer CMS collections across with every custom field intact, from the per-collection CSV export.',
    keywords: ['framer alternative', 'migrate from framer', 'framer cms export'],
    headline: 'The prettiest site in the world still needs a business behind it',
    lede: 'Your CMS collections with every custom field intact — one CSV per collection.',
    painTitle: 'You designed a site. You needed a system.',
    pains: [
      {
        title: 'The CMS is for content, not for records',
        body: 'It renders a list beautifully. It does not know who bought, who asked, or what is in stock.',
      },
      {
        title: 'Anything transactional lives elsewhere',
        body: 'Payments, enquiries, email, invoices — four other tools, four other logins, four other bills.',
      },
      {
        title: 'Nothing joins up',
        body: 'The visitor who filled in the form and the customer who paid are unrelated as far as the software is concerned.',
      },
    ],
    turnTitle: 'Design the front. Keep the back.',
    turnBody:
      'sparx has a visual builder for the front and a real commerce, CRM and email system behind it. The enquiry becomes a customer becomes an order, in one place, with nothing wired between them.',
    consequences: [
      'Custom fields land as custom properties rather than being dropped.',
      'Forms write to the CRM instead of an inbox.',
      'One bill instead of five.',
    ],
    limits: [
      "Framer's design and interactions do not transfer — the content and its structure do.",
      'One export per collection.',
    ],
    effort: 'A few minutes per collection.',
  },

  {
    slug: 'hubspot',
    name: 'HubSpot',
    noun: 'CRM',
    seoTitle: 'Move from HubSpot to sparx',
    seoDescription:
      'Bring your HubSpot contacts, companies, deals and tickets across — with your pipeline stages rebuilt exactly as you had them.',
    keywords: [
      'hubspot alternative',
      'migrate from hubspot',
      'hubspot export',
      'hubspot too expensive',
      'hubspot contact tiers',
    ],
    headline: 'Your pipeline, rebuilt exactly as you had it',
    lede: "Contacts, companies, deals and tickets — with your own stage names, in your own order, not mapped onto somebody else's idea of a sales process.",
    painTitle: 'The bill grew faster than the team did.',
    pains: [
      {
        title: 'You pay per seat, and per contact, and per tier',
        body: 'Adding a person costs money. Adding contacts costs money. The feature you need is on the tier above. Three separate meters, all pointing up.',
      },
      {
        title: 'Marketing contacts are a billing concept you have to manage',
        body: 'You are now doing database hygiene to control an invoice, which is a strange use of a Tuesday.',
      },
      {
        title: 'It does not know what anyone bought',
        body: 'The CRM and the shop are different systems, so the customer record shows every email you sent and none of the money they spent.',
      },
    ],
    turnTitle: 'A CRM that can see the orders.',
    turnBody:
      "sparx's CRM sits on the same database as commerce, invoicing and email. A contact record shows the deal, the quote, the order, the invoice and the support ticket — not because five systems sync, but because there is one system. And it is priced per module, not per person and per contact.",
    consequences: [
      'Your stage names come across exactly — fourteen stages stay fourteen stages, in your order.',
      'Closed Won and Closed Lost are typed as won and lost, so forecasting is right immediately.',
      'Contacts, companies, deals and tickets stay connected to each other.',
      'No per-seat charge, so everyone who should be in it is in it.',
    ],
    limits: [
      'Workflows, sequences and marketing emails are rebuilt here — the export does not include them.',
      'Deal owners who do not have an account here yet land unassigned rather than being invited automatically.',
      'Meeting links, forms and landing pages are re-created.',
    ],
    effort: 'Four exports, about an hour for a CRM with real history.',
  },

  {
    slug: 'salesforce',
    name: 'Salesforce',
    noun: 'CRM',
    seoTitle: 'Move from Salesforce to sparx',
    seoDescription:
      'Bring your Salesforce accounts, contacts, leads, opportunities and cases across from standard list-view exports.',
    keywords: [
      'salesforce alternative',
      'migrate from salesforce',
      'salesforce export',
      'salesforce too complex for small business',
    ],
    headline: 'Built for a company with a Salesforce administrator',
    lede: 'Accounts, contacts, leads, opportunities and cases — from the list-view exports you already know how to make.',
    painTitle: 'You are paying for capability you cannot reach.',
    pains: [
      {
        title: 'Nothing changes without somebody who knows the system',
        body: 'A field, a rule, a report. Either you learn a platform for a living or you pay somebody who has.',
      },
      {
        title: 'The licences are the small part',
        body: 'The consultant, the admin, the integrations, the annual review. The seat price was never the number that mattered.',
      },
      {
        title: 'Most of it is switched off',
        body: 'You use accounts, contacts, opportunities and maybe cases. You are paying for a platform sized for a sales floor of two hundred.',
      },
    ],
    turnTitle: 'The parts you use, without the operating model.',
    turnBody:
      'sparx does accounts, contacts, deals with real pipelines, and support tickets — and joins them to the orders, invoices and email, which Salesforce charges extra to approximate. The person who runs the sales process configures the sales process.',
    consequences: [
      'Leads and contacts arrive as one kind of record with a lifecycle, which is what they always were.',
      'Opportunities keep their stage, amount and close date, and won/lost is read correctly.',
      'Cases become support tickets attached to the same customer.',
      'No admin, no consultant, no annual review.',
    ],
    limits: [
      'Custom objects, Apex, flows and validation rules do not come across.',
      'Reports and dashboards are rebuilt — the ones you actually look at, usually in an afternoon.',
      'Chatter and activity history stay behind.',
    ],
    effort: 'One export per object. Half a day for a CRM with years in it.',
  },

  {
    slug: 'pipedrive',
    name: 'Pipedrive',
    noun: 'CRM',
    seoTitle: 'Move from Pipedrive to sparx',
    seoDescription:
      'Bring your Pipedrive people, organisations and deals across — with won and lost read correctly from the status column.',
    keywords: ['pipedrive alternative', 'migrate from pipedrive', 'pipedrive export'],
    headline: 'Good at deals. Blind to everything else.',
    lede: 'People, organisations and deals, with pipelines and stages rebuilt as you had them and won/lost read exactly.',
    painTitle: 'The pipeline is fine. The rest of the business is invisible.',
    pains: [
      {
        title: 'It ends at the sale',
        body: 'Deal closes, and the software stops caring. The invoice, the delivery, the support and the repeat order all happen somewhere it cannot see.',
      },
      {
        title: 'Every gap is an add-on with its own price',
        body: 'Email campaigns, documents, projects, lead capture. Each a separate product, each another line.',
      },
      {
        title: 'Nobody can answer what a customer is worth',
        body: 'Deal value is what you hoped. Revenue is in the accounting system. Nothing connects the two.',
      },
    ],
    turnTitle: 'A pipeline that knows what happened next.',
    turnBody:
      'sparx joins deals to invoices, orders and support in one database. Closing a deal produces the quote, the invoice and the order, and the customer record shows all of it — so "what is this account actually worth" is a fact rather than an estimate.',
    consequences: [
      'Pipelines and stages arrive exactly as you had them.',
      'Won and lost come across correctly — Pipedrive is the only CRM on this list with a real status column, and we use it.',
      'The deal, the invoice and the order become one story on one record.',
    ],
    limits: [
      'Activities, emails and notes are not in the standard export.',
      'Custom fields come across as custom properties where they are named clearly.',
    ],
    effort: 'Three exports, under an hour.',
  },

  {
    slug: 'mailchimp',
    name: 'Mailchimp',
    noun: 'audience',
    seoTitle: 'Move from Mailchimp to sparx',
    seoDescription:
      'Bring your Mailchimp audience across with consent preserved — only confirmed opt-ins are imported as permission to email.',
    keywords: [
      'mailchimp alternative',
      'migrate from mailchimp',
      'mailchimp export audience',
      'mailchimp pricing contacts',
    ],
    headline: 'You are paying for people who unsubscribed',
    lede: 'Your audience, every merge field you added, and consent handled properly — from the audience export.',
    painTitle: 'The pricing is per contact, and contacts only ever accumulate.',
    pains: [
      {
        title: 'Unsubscribed and bounced addresses still count',
        body: 'You are being billed for people who have explicitly told you to stop emailing them. Managing that is a monthly chore whose only purpose is to lower an invoice.',
      },
      {
        title: 'The list has no idea who is a customer',
        body: 'Mailchimp knows an email address. It does not know they have spent four hundred pounds with you, or that they have an open support ticket, unless you pay to connect something that half-tells it.',
      },
      {
        title: 'Segmenting on behaviour means integrating on behaviour',
        body: '"Everyone who bought this and not that in the last ninety days" is a connector project, not a query.',
      },
    ],
    turnTitle: 'A list that is the customer list.',
    turnBody:
      'In sparx the mailing list and the customer database are the same records. Segmenting on what someone bought, what they spent or what they returned is a filter, not an integration — because the orders are in the same database as the addresses.',
    consequences: [
      'Only confirmed double opt-ins are imported as permission to email. Anything else lands without it, which is recoverable — the reverse is a complaint.',
      'Every merge field you added comes across as a custom property.',
      'Segment on orders, spend and support history without connecting anything.',
    ],
    limits: [
      'Campaigns, templates and automations are rebuilt here.',
      "Mailchimp's Address merge field is a single cell, so it is carried whole rather than split on guesswork.",
      'Open and click history stays with Mailchimp.',
    ],
    effort: 'One file, minutes.',
  },

  {
    slug: 'klaviyo',
    name: 'Klaviyo',
    noun: 'audience',
    seoTitle: 'Move from Klaviyo to sparx',
    seoDescription:
      'Bring your Klaviyo profiles across with email and SMS consent read exactly, plus lifetime value — from the profiles export.',
    keywords: [
      'klaviyo alternative',
      'migrate from klaviyo',
      'klaviyo export profiles',
      'klaviyo pricing',
    ],
    headline: 'Excellent email. Priced like a platform.',
    lede: 'Your profiles with email and SMS consent read exactly as Klaviyo recorded it, plus lifetime value — from the profiles export.',
    painTitle: 'It is the best email tool you can buy, and it is only an email tool.',
    pains: [
      {
        title: 'Priced per profile, and profiles never go down',
        body: 'Every browser who once gave you an address is billable forever, whether or not they ever opened anything.',
      },
      {
        title: 'It is a second copy of your customer list',
        body: 'Klaviyo has a version of every customer, kept roughly in step with the real one by a connector. Two databases, one truth, and a nightly opportunity to disagree.',
      },
      {
        title: 'It does nothing else',
        body: 'It sends email and SMS very well. The shop, the stock, the support and the invoicing are all elsewhere, all paid for separately.',
      },
    ],
    turnTitle: 'Stop keeping a second copy of your customers.',
    turnBody:
      'sparx sends the email from the same records that hold the orders. There is no sync, no lag and no second copy to reconcile — a flow that fires on "bought twice, not in ninety days" is reading the orders themselves.',
    consequences: [
      'Email and SMS consent come across separately and exactly — Klaviyo is the cleanest consent export of any platform on this list, and none of it is guessed.',
      'Lifetime value arrives with the profile.',
      'One record per customer, everywhere, forever.',
    ],
    limits: [
      'Flows, campaigns and templates are rebuilt here.',
      'Event and engagement history stays with Klaviyo.',
      'Predictive analytics values do not transfer.',
    ],
    effort: 'One file, minutes.',
  },
];

const BY_SLUG = new Map(MIGRATE_STORIES.map((story) => [story.slug, story]));

export function getStory(slug: string): MigrateStory | undefined {
  return BY_SLUG.get(slug);
}

export function storySlugs(): string[] {
  return MIGRATE_STORIES.map((story) => story.slug);
}
