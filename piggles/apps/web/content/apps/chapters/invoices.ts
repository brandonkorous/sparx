import type { AppChapter } from '../types';

// Invoices fronts three registered screens (the list, workflows, print
// templates), but the document editor behind the list carries most of the app:
// stages, priced lines, payments, signatures, sending. The chapters follow the
// life of one document rather than the screens.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/invoicing,
// api-rest /v1/invoicing/*, crm-schemas builtins/invoicing.ts and the
// automation-actions invoicing seeds. DELIBERATELY ABSENT, because none of them
// exists in this app today: credit notes, customer statements and write-offs
// (a write-off is a wholesale-invoice action, which Sell describes). The
// payment link names only the gateways whose adapter returns a real link;
// automatic recording of a paid link is Stripe only, and says so.

export const INVOICES_CHAPTERS: AppChapter[] = [
  {
    heading: 'One document, from the price to the receipt.',
    body: 'Most work does not start as an invoice. It starts as a price somebody has to agree to, becomes a job, and only then turns into a bill. Invoices keeps that as one document moving through steps you name yourself, so the estimate, the go-ahead and the invoice are one record rather than three copies that slowly stop agreeing. Two ways of working come ready to use: a plain invoice, and an estimate that becomes a work order, then an invoice, then a receipt.',
    does: [
      {
        title: 'Steps in your own words',
        body: 'Estimate, Approved, Work order, Invoice, or whatever your customers call them. The name printed on the paper is the one you chose.',
      },
      {
        title: 'Each step knows what it means',
        body: 'Decide whether arriving at a step gives the document its number, locks it against changes, or keeps a permanent copy. The screen spells out what each choice does before you save it.',
      },
      {
        title: 'Numbered at the right moment',
        body: 'An estimate can start EST- and an invoice INV-. The invoice number arrives when it becomes a bill, not when you first started typing.',
      },
      {
        title: 'A copy of what they agreed to',
        body: 'When a price is approved or an invoice is issued, an exact copy is kept. Change the job later and the approved version still prints the way it stood.',
      },
      {
        title: 'A quote is not a bill',
        body: 'A quote has a date it is good until and nothing owing on it, so it never inflates what you are owed. An invoice has a due date and counts the days late.',
      },
      {
        title: 'From yes to an order',
        body: 'Once a customer approves, turn the approved price into an order for your team to fill, without retyping a line.',
      },
      {
        title: 'Called off, and still on file',
        body: 'A canceled invoice keeps its number and its history, marked as not owed, so there is always a record of what happened to it.',
      },
    ],
  },
  {
    heading: 'Lines that add up, and show their working.',
    body: 'An invoice is only as trustworthy as its lines. A line here can come straight from what you sell, be time at your rate, materials, a fee, delivery, or work you paid somebody else to do and are passing on. Each one can carry what it cost you as well as what you charge, so the margin is on your screen before the document leaves.',
    does: [
      {
        title: 'Pick from what you already sell',
        body: 'Choose a product and its description and price come with it. Or type a line from scratch for the one-off job.',
      },
      {
        title: 'Cost in, price out',
        body: 'Enter what something cost you and a markup, or pick one of your saved markup rules, and the price works itself out the same way every time.',
      },
      {
        title: 'Passing on what you paid for',
        body: 'Delivery and work you had somebody else do can go on at cost, or with your margin added, and the line says which.',
      },
      {
        title: 'Discounts where they belong',
        body: 'Take money off the line it applies to rather than fudging the total, so the customer sees what was reduced and by how much.',
      },
      {
        title: 'Tax only where it applies',
        body: 'Mark each line taxable or not. Services and fees start untaxed, products and materials start taxed, and you can change any of them.',
      },
      {
        title: 'Every figure they will add up',
        body: 'Subtotal, discount, tax, delivery, any surcharge, what was already paid, and what is left. Nothing on the total arrives unexplained.',
      },
      {
        title: 'See it the way they will',
        body: 'A live preview beside the editor shows the finished document on your own letterhead while you type.',
      },
    ],
  },
  {
    heading: 'Getting it to them, and getting a yes in writing.',
    body: 'A bill nobody received cannot be paid, and an approval nobody wrote down is an argument waiting to happen. Invoices emails the document from the screen you wrote it on, with every line inside the message so it reads properly on a phone, and asks for a signature when a job needs one.',
    does: [
      {
        title: 'Sent from where you wrote it',
        body: 'One button emails it: who it is from, the number, each line, the total, what is still owed, the due date and your note.',
      },
      {
        title: 'A due date that is fair',
        body: 'For customers on agreed payment terms, the clock starts the day the invoice is sent to them, not the day you drafted it. A date you set by hand always wins.',
      },
      {
        title: 'Sent, or still sitting here',
        body: 'Every unpaid invoice shows whether it has actually gone out, so a bill nobody sent cannot hide among the late ones.',
      },
      {
        title: 'Signed on their own phone',
        body: 'Send a link to sign. They sign or decline on their own screen, and a copy of exactly what they agreed to is kept with the date.',
      },
      {
        title: 'Whether they have looked',
        body: 'See when they opened the signing link and when it stops working, so three days later you know whether to nudge or wait.',
      },
      {
        title: 'One live request at a time',
        body: 'Asking again cancels the earlier link, so two different versions of the same document can never both be signed.',
      },
      {
        title: 'Paper when you need it',
        body: 'Print it or save it as a PDF, including any earlier version that was kept along the way.',
      },
    ],
  },
  {
    heading: 'What you are owed, and who is late.',
    body: 'The question an invoice list really answers is how much money is out there and how much of it is late. That figure sits at the top, counted across every open invoice rather than just the rows on screen. The chasing that nobody enjoys happens on its own, politely and on time, without you writing the same email every week.',
    does: [
      {
        title: 'The number that matters, first',
        body: 'What you are owed and how much of it is overdue, above the list, before you have read a single row.',
      },
      {
        title: 'Late only, biggest first',
        body: 'Filter to late, unpaid, part paid or not sent, sort by balance or due date, and save the view you check every Monday.',
      },
      {
        title: 'Payments, however they arrive',
        body: 'Cash, card, check, bank transfer, wire or account credit, with a reference to find it by later. A part payment leaves the rest showing as owed.',
      },
      {
        title: 'Deposits and refunds on the same record',
        body: 'Money taken up front comes off the balance. A refund is its own entry rather than an edit, so the history reads like a ledger.',
      },
      {
        title: 'A link to pay online',
        body: 'Create a payment link for whatever is still owed, through the payment provider you connected, and send it however suits you. Paid through Stripe, it records itself against the right invoice.',
      },
      {
        title: 'Reminders that go out on their own',
        body: 'A friendly note three days before it is due, then notices at 7, 14 and 30 days late. They stop once it is paid, and never go out for an invoice you have not sent.',
      },
      {
        title: 'A receipt when it clears',
        body: 'Paid in full, and the customer is emailed a receipt automatically.',
      },
    ],
    connects: ['Stripe', 'PayPal', 'Square'],
  },
  {
    heading: 'Paper that looks like it came from you.',
    body: 'An invoice is often the only document from you that a customer keeps. Print templates decide what goes on it and in what order, from blocks with plain names, and what the page says about who sent it stays true even after you change your details.',
    does: [
      {
        title: 'Built from blocks with plain names',
        body: 'The top of the page, who it is for, what they are paying for, the amounts, payments received. Reorder them, and leave out the ones you do not need.',
      },
      {
        title: 'Your own words on every one',
        body: 'Add your terms, a heading, a line of text, your logo or a scanned signature, and a line across the page to separate the parts.',
      },
      {
        title: 'Try it before it counts',
        body: 'Work on a template and preview it against a real document before you publish it, then choose which one is your default.',
      },
      {
        title: 'Who sent it, as of that day',
        body: 'Your trading name, legal name and address are fixed onto a document when it is issued, so renaming the business later does not rewrite bills customers already hold.',
      },
      {
        title: 'A tax number only when you have one',
        body: 'Your tax registration number prints when your business is registered, and stays off the page when it is not.',
      },
      {
        title: 'Two businesses, two letterheads',
        body: 'Run more than one business from one account and each invoice wears the letterhead of the business that raised it.',
      },
    ],
  },
];
