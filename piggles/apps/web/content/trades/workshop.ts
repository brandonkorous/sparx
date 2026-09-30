import type { TradePage } from './types';
import { WORKSHOP_DETAIL } from './detail/workshop';

export const WORKSHOP: TradePage = {
  slug: 'workshop',
  pose: 'workshop',
  group: 'web',
  name: 'A workshop',
  plural: 'Workshops',
  shape:
    'You take commissions, you keep materials, and you quote before you build. Knowing what a job actually cost you is the difference between busy and paid.',
  leans: ['invoices', 'stock', 'money'],
  ...WORKSHOP_DETAIL,
  heading: 'Quote it, build it, and find out what it actually made you.',
  lede: 'A workshop runs on commissions, a rack of materials and a price you gave before the first cut. Piggles keeps the quote, the materials and the invoice pointing at the same job, with the hours logged against it too, so when a piece leaves the bench you know whether you were busy or paid.',
  searchTerms: [
    'workshop management software',
    'job costing software for small business',
    'quoting and invoicing software',
    'custom furniture business software',
    'woodworking business software',
    'fabrication shop software',
    'commission tracking app for makers',
    'inventory and invoicing for makers',
  ],
  problems: [
    {
      title: 'The quote was a guess, and nobody checked it afterward.',
      body: 'You priced the dining table in March from memory of the last one. It was delivered in May. Whether the walnut, the finish and the extra Saturday were covered is something you find out at tax time, if you find out at all.',
    },
    {
      title: 'The materials live in your head and a notebook.',
      body: 'You buy lumber by the board and use it by the foot. The offcuts were never counted, and you discover you are out of the hinge you always use on the morning you need six of them.',
    },
    {
      title: 'Quotes go out and go quiet.',
      body: 'A quote sits in your sent folder. Following up was never anybody’s job, so nobody does, and the customer who was ready to say yes hires the shop that called back.',
    },
    {
      title: 'You tried a spreadsheet, and then three more.',
      body: 'One for quotes, one for materials, an invoicing app, and a notes app for measurements. Each one is fine by itself. None of them know it is the same job, so the numbers never meet and the question you actually care about never gets answered.',
    },
  ],
  turn: 'A commission is one thing, so it should be one record: the quote, the materials, the hours and the bill all pointing at the same job.',
  week: [
    {
      when: 'Monday, 7am',
      body: 'Coffee, then Home. It counts what is waiting on you in plain sentences: somebody on your website’s chat waiting for a reply, an invoice that has gone late, and the finish you use on everything running low before you reach for an empty can.',
      app: 'home',
    },
    {
      when: 'Monday, 10am',
      body: 'The weekend inquiry becomes a card on your board of work you are trying to win, with what it is worth and a follow-up date on you. The measurements go on the record too, in a commission record you set up with your own fields: dimensions, wood, finish, date needed.',
      app: 'customers',
    },
    {
      when: 'Tuesday, 2pm',
      body: 'You send the quote with your logo and your terms. When they accept, it turns into an invoice without retyping a line, and you send a link to pay the deposit. Part payments land against the same invoice, so the balance on it is always the real balance.',
      app: 'invoices',
    },
    {
      when: 'Wednesday, 8am',
      body: 'Stock says the walnut will run short at the rate you actually use it, measured against how long your supplier actually takes. The order goes in. When the delivery arrives, the freight is spread across the boards, so a board costs what it cost to get it into your shop.',
      app: 'stock',
    },
    {
      when: 'Thursday, all day',
      body: 'Your helper clocks in and out, so their hours are a timesheet you approve rather than a total scribbled at the bottom of the week. Their account only shows what their job needs. Your margins stay yours.',
      app: 'team',
    },
    {
      when: 'Friday, 9am',
      body: 'Last week’s cabinet quote has gone quiet. An automation you switched on sends a polite nudge after five days, checks first that they have not already said yes, and does nothing if they have. Every run is listed, so you can see exactly who it wrote to.',
      app: 'automations',
    },
    {
      when: 'Saturday, 10am',
      body: 'The table is delivered. Money shows what the job made after the materials and the other costs you charged to it. If it came in thin, you know before you quote the next one like it.',
      app: 'money',
    },
  ],
  firstHour: [
    'Look around the practice records first. The account arrives with sample customers, products and orders so you can learn on something that looks real.',
    'Enter your business name, address and logo once. From then on they are what appears on every quote, invoice and receipt.',
    'Set up a commission record with the fields you always write down: measurements, materials, finish and the date somebody is depending on.',
    'Add the ten materials you use most, with the unit you buy them in and the unit you measure them in.',
    'Send one real quote, turn it into an invoice, then press the button that clears the practice records. It removes every sample and touches none of yours.',
  ],
  questions: [
    {
      q: 'What does it cost, and what costs extra?',
      a: 'Piggles is $99 a month, flat, with all sixteen apps included: quotes and invoices, stock, the website, bookings, money and the rest. That covers one business, one location, one website and three people with their own sign-ins. If you need more room later (more storage, more email, more customer records, more people) you add it. No app is ever an upgrade. The first 14 days are free and you do not enter a card.',
    },
    {
      q: 'My work is custom. Will software built for shops fit it?',
      a: 'Nothing here assumes a shelf of identical things. A commission can be its own kind of record with your own fields. Stock has units that convert, so lumber bought by the board and measured by the foot is one material, and a piece made of other things (a cabinet from boards, hinges and finish) can be set up as a recipe, so you can see how many you could build and what the parts cost.',
    },
    {
      q: 'Will it actually tell me if a job lost money?',
      a: 'Yes, as long as the costs are in it. Materials, subcontractors and other costs can be charged to the job they were for, and material costs include the freight it took to get them to you. Approved hours from My Team arrive in Money as wages in the overall profit figure rather than on each job, so price your time into the quote as well.',
    },
    {
      q: 'I already have quotes, customers and a materials list somewhere. Do I start over?',
      a: 'No. Bring customers, products and stock in from a spreadsheet or another system, and see what will happen row by row before anything is written. Your accountant can stay too: Money hands them a spreadsheet of your spending with every column labeled and their account codes on each line.',
    },
    {
      q: 'Can I use it from the shop floor?',
      a: 'The parts you do standing up are built for a phone. Stock has a stripped-back mode for scanning a delivery in or counting a shelf with one hand free, your website reflows to fit a small screen, and the invoice email puts every line inside the message so it reads properly on a customer’s phone.',
    },
    {
      q: 'What happens when I take on a second person or a second unit?',
      a: 'Three people are included, each with their own sign-in and only the access their job needs. More people or another location are added when you need them. Products, orders and invoices are unlimited, so getting busier never pushes you onto a bigger plan. There is only one plan.',
    },
  ],
};
