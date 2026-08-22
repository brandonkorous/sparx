import type { AppMarketing } from './types';

export const CONNECTIONS: AppMarketing = {
  heading: 'Piggles and the other things you already use.',
  lede: 'Connections links Piggles to the software you are not giving up — the accounting package, the payment provider, the marketplace, the calendar — and lets modern AI assistants work with your business data under your control.',
  alsoKnownAs: ['integrations', 'API', 'webhooks', 'MCP', 'AI assistant'],
  does: [
    {
      title: 'The usual suspects',
      body: 'Accounting, payments, shipping, marketplaces, social accounts and calendars, connected by signing in rather than by pasting keys.',
    },
    {
      title: 'Tell other software what happened',
      body: 'Send an alert to another system the moment an order is placed or a booking is made, and see whether it arrived.',
    },
    {
      title: 'Work with an AI assistant',
      body: 'Connect the assistant you already use and ask it about your own business — what sold, what is low, who has not paid.',
    },
    {
      title: 'Your key, your choice',
      body: 'AI features run on an account you connect, so nothing is sent anywhere you did not agree to. Piggles never quietly uses your data to run somebody else’s model.',
    },
    {
      title: 'Bring your history with you',
      body: 'Import products, customers and past orders from a spreadsheet or another system, with a preview before anything is written.',
    },
    {
      title: 'A real way out',
      body: 'A documented interface for anything bespoke, and a full export whenever you want one.',
    },
  ],
  chapters: [
    {
      heading: 'Nothing here asks you to abandon what works.',
      body: 'Nobody changes their accountant because they changed their website. Connections is how Piggles fits around the things you already pay for and already trust — you sign in to the service, Piggles keeps the connection, and the two stay in step without you being the integration.',
      does: [
        {
          title: 'Connected by signing in',
          body: 'The ordinary case is a sign-in, not a page of keys pasted out of a support article. Where a service only offers keys, the fields say what each one is and where to find it.',
        },
        {
          title: 'It says when something breaks',
          body: 'A connection whose access has expired or been revoked is reported as broken rather than quietly failing, which is how a fortnight of orders goes missing from an accounting package.',
        },
        {
          title: 'One place for all of them',
          body: 'Every connection — payment, marketplace, social, accounting, AI — in one panel, so "what is this business plugged into" is a question with an answer.',
        },
      ],
      // Only categories with named services verified elsewhere on this site.
      // Shipping and sales-tax connections exist too and are deliberately
      // described rather than listed, because the specific providers are not
      // confirmed here — see the accuracy rule on `connects` in ./types.ts.
      connects: [
        'Stripe',
        'PayPal',
        'Square',
        'QuickBooks Online',
        'Xero',
        'Amazon',
        'eBay',
        'Etsy',
        'Meta (Instagram & Facebook)',
        'TikTok Shop',
      ],
    },
    {
      heading: 'Ask your own assistant about your own business.',
      body: 'This is the part worth understanding, because two things sound the same and point in opposite directions. One is Piggles using an AI account you own to write and summarise for you. The other is you pointing the assistant you already use at Piggles, so you can ask it what sold last week and have it answer from your real figures. Both run on a credential you control, and Piggles never runs AI on an account of its own.',
      does: [
        {
          title: 'Point your assistant at your business',
          body: 'Connect the AI app you already use and ask it real questions — what sold, what is running low, who has not paid, what is booked tomorrow. It reads your actual data rather than guessing.',
        },
        {
          title: 'You decide what it may touch',
          body: 'What a connected assistant is allowed to see and do is set by you, per area. Reading your bookings and changing your prices are different permissions.',
        },
        {
          title: 'Tell it how to sound',
          body: 'Standing instructions — your tone, your terms, the things you never say — so what it writes for you reads like your business rather than like software.',
        },
        {
          title: 'Your account, your bill, your data',
          body: 'Any AI feature runs on a provider account you connect yourself. Nothing is sent anywhere you did not agree to, and nothing you hold here trains anybody’s model.',
        },
        {
          title: 'For the apps that cannot sign in',
          body: 'Issue a key for a script or a bespoke tool, see what it has been doing, and revoke it in one action.',
        },
      ],
      connects: ['Claude', 'ChatGPT', 'Copilot', 'Anthropic', 'OpenAI'],
    },
    {
      heading: 'Getting in is easy. Getting out has to be too.',
      body: 'Software that is hard to leave is software that has stopped having to earn you. Everything you put into Piggles can come back out in a form something else can read, and everything you have elsewhere can come in with a preview before a single record is written.',
      does: [
        {
          title: 'Bring it in, with a look first',
          body: 'Products, customers, stock and past orders from a spreadsheet or another system — with what will happen shown, row by row, before anything is written.',
        },
        {
          title: 'Tell other systems as it happens',
          body: 'Send a message to another system the moment an order is placed, a booking is made or stock moves — with delivery attempts visible, so a silent failure is not possible.',
        },
        {
          title: 'A documented interface',
          body: 'Everything the screens do is available to your own tools, because every feature here was built on the same interface before it had a screen.',
        },
        {
          title: 'Take it all with you',
          body: 'A full export, whenever you want one, without asking anybody.',
        },
      ],
    },
  ],
  worksWith: ['money', 'sell', 'team'],
};
