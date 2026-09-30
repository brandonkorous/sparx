import type { AppChapter } from '../types';

// Connections covers four things a person means by "linking Piggles to my other
// tools": the services they already pay for, the AI assistant they already use,
// the AI account Piggles writes with, and getting records in and out.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/integrations
// (the one list, test mode, Test connection, pause, disconnect, admins only),
// wizeworks/packages/payments/src/catalog.ts and provider-shippo (connected by
// pasting keys, no platform setup needed), surfaces/ai-connections, surfaces/ai
// (overview, instructions, permissions), surfaces/cms/webhook-* (the "Tell other
// software" screen and its events), and surfaces/migration.
//
// `connects` NAMES ONLY WHAT A PIGGLES CUSTOMER CAN CONNECT TODAY. Removed on
// this pass: QuickBooks Online and Xero (the adapters exist, but connecting
// needs an app registered with each vendor that no deploy has, so the product
// itself shows them as not switched on; the spreadsheet export is the working
// answer and lives on the Money page), and Amazon, eBay, Etsy, Meta and TikTok
// Shop (every marketplace waits on a partner approval, per docs/106, and the
// product shows each as not ready). EasyPost, TaxJar and Avalara are registered
// as coming soon. Social accounts and calendars also depend on setup at our end,
// so they are described, not named. sparx Pay and the sparx shipping service are
// sparx products and are never named here.

export const CONNECTIONS_CHAPTERS: AppChapter[] = [
  {
    heading: 'Nothing here asks you to abandon what works.',
    body: 'Nobody changes their accountant because they changed their website. Connections is how Piggles fits around the things you already pay for and already trust. You connect a service once, Piggles keeps the connection, and the two stay in step without you being the go-between.',
    does: [
      {
        title: 'Paste, with directions',
        body: 'Most services connect by pasting a few details from your account with them. Every box says what it is and where to find it, and anything secret is checked and stored encrypted.',
      },
      {
        title: 'Try it in test mode first',
        body: 'Where the other service offers a practice setup, connect to that first and see it work before real money or real orders are involved.',
      },
      {
        title: 'Test it whenever you like',
        body: 'A delivery connection can be checked again with one button, which says what went wrong if it fails and shows when it was last checked.',
      },
      {
        title: 'It says when something breaks',
        body: 'Every connection reads Connected, Paused, Needs setup or Not working, in the list and on its own page, rather than quietly failing for two weeks.',
      },
      {
        title: 'Pause without losing it',
        body: 'Switch a delivery connection off and back on with its details intact, or remove any connection entirely. Your account with the other service is never touched.',
      },
      {
        title: 'One place for all of them',
        body: 'Payments, delivery, sales tax, places you sell, social accounts, suppliers and AI in one list, filtered to what is connected, what you can add, or what is not ready yet.',
      },
      {
        title: 'Honest about what is not ready',
        body: 'A service that cannot be connected yet is labeled as such, with the reason, instead of offering a button that fails.',
      },
      {
        title: 'Only the right people',
        body: 'Connecting and disconnecting a service is limited to the admins on your team.',
      },
    ],
    connects: ['Stripe', 'PayPal', 'Square', 'Authorize.net', '1stPayGateway', 'Shippo'],
  },
  {
    heading: 'Ask your own assistant about your own business.',
    body: 'Two things sound the same here and point in opposite directions. This one is you pointing the AI app you already use at Piggles, so you can ask it what sold last week and have it answer from your real records. It reaches only what you allow, and you can see everything it did.',
    does: [
      {
        title: 'Point your assistant at your business',
        body: 'Paste one address into your AI app. It sends you to sign in and approve, and nothing reaches your business until you do. Then ask it real questions: what sold, what is running low, who has not paid.',
      },
      {
        title: 'You decide what it may touch',
        body: 'Every tool a connected assistant could use is listed, and any of them can be switched off. Reading your bookings and changing your prices are separate switches.',
      },
      {
        title: 'See what it has been doing',
        body: 'How many requests it made over 30 days, how many worked as asked, what it reaches for most, and its latest actions, which also appear in your business record marked as an AI assistant.',
      },
      {
        title: 'Remove an app in one step',
        body: 'Every connected assistant is listed, and taking one away stops it reaching your business straight away.',
      },
      {
        title: 'For the apps that cannot sign in',
        body: 'Make a key for a script or a tool, name it, pick only the permissions it needs (never more than your own), and set when it expires. It is shown once, shows when it was last used, and can be revoked in one action.',
      },
    ],
    connects: ['Claude', 'ChatGPT', 'Copilot'],
  },
  {
    heading: 'Writing help, on an account you already pay for.',
    body: 'This is the other direction: Piggles using an AI account you own to write for you, such as product descriptions, email drafts and social posts. It only ever runs on a credential you connect, the work is billed to your provider rather than to us, and Piggles never runs AI on an account of its own.',
    does: [
      {
        title: 'Your account, your bill',
        body: 'Connect Anthropic or OpenAI with a key from their site. It is checked before it is saved, and the bill for what it does goes to them, not to Piggles.',
      },
      {
        title: 'You can see it is working',
        body: 'The connected account shows the last four characters of its key and when it was last checked. Check it again, replace the key or disconnect it from the same place.',
      },
      {
        title: 'Tell it how to sound',
        body: 'Write standing instructions (your tone, your terms, the things you never say) so what it writes for you reads like your business rather than like software.',
      },
      {
        title: 'One for each job',
        body: 'Separate instructions for product descriptions, email drafts, social posts, search wording, notes about customers, ready answers to common questions, and your chat’s personality.',
      },
      {
        title: 'Gaps it fills in each time',
        body: 'Leave a blank in an instruction, such as the product’s name, with a note on what belongs there, and it is filled in fresh every time the instruction is used.',
      },
      {
        title: 'A starting set to edit',
        body: 'Begin from a ready-made set of instructions and change any of them, or write your own from scratch. Turn one off and it is kept, just not followed.',
      },
      {
        title: 'Nothing sent without your say',
        body: 'Nothing is sent anywhere you did not agree to, and nothing you hold in Piggles is used to train anybody’s model.',
      },
    ],
    connects: ['Anthropic', 'OpenAI'],
  },
  {
    heading: 'Getting in is easy. Getting out has to be too.',
    body: 'Software that is hard to leave is software that has stopped having to earn you. Everything you have elsewhere can come in with a look first, and what happens in Piggles can be passed to your other tools the moment it happens, with a record of whether it arrived.',
    does: [
      {
        title: 'Bring it in, with a look first',
        body: 'Products, customers, stock and past orders from a spreadsheet or the export your old platform made, with what will happen shown before anything is written.',
      },
      {
        title: 'Straight from the old platform',
        body: 'A few platforms connect with a read-only key instead of an export, so your records are fetched for you. Nothing about the key is kept afterward.',
      },
      {
        title: 'A practice run first',
        body: 'Run an import with nothing saved and see exactly what would land. Bringing the same file in twice updates what is there rather than doubling it.',
      },
      {
        title: 'Tell other software as it happens',
        body: 'Send a message to another tool’s web address when an order is paid, a form is filled in, a page is published or stock runs low. Choose the events, and pause it any time.',
      },
      {
        title: 'Choose exactly what it hears',
        body: 'Pick from paid orders and failed payments, forms, pages and files, stock levels and counts, and supplier deliveries, each described in plain words rather than code.',
      },
      {
        title: 'Proof it arrived',
        body: 'The latest attempts are listed with whether each one got through, and a failed one is tried again, so a failure is something you can see rather than something you discover.',
      },
      {
        title: 'Your records, as spreadsheets',
        body: 'Customers, products, stock, orders, invoices, bookings, articles, spending, team hours and form replies each download as a spreadsheet from the list they live on.',
      },
    ],
  },
];
