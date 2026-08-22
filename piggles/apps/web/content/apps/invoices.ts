import type { AppMarketing } from './types';

export const INVOICES: AppMarketing = {
  heading: 'Send the bill. Find out who has paid.',
  lede: 'Invoices produces the document, sends it, records the payment and tells you who is late — for a single job, a monthly account or a quote that turned into work.',
  alsoKnownAs: ['invoicing', 'billing', 'accounts receivable', 'quotes and estimates'],
  does: [
    {
      title: 'Documents that look like your business',
      body: 'Your logo, your terms, your wording. Quotes, invoices, credit notes and receipts from one template set.',
    },
    {
      title: 'Quote first, invoice after',
      body: 'Turn an accepted quote into an invoice without retyping any of it, and keep the link between the two.',
    },
    {
      title: 'Take payment from the document',
      body: 'The customer opens the invoice and pays it. The payment records itself against the right one.',
    },
    {
      title: 'Chasing, without the awkward part',
      body: 'See what is overdue and by how long, and send a reminder that is firm and polite without you writing it each time.',
    },
    {
      title: 'Accounts, not just one-offs',
      body: 'Statements, part payments, credit notes and write-offs for customers who pay on terms.',
    },
    {
      title: 'Signed where it needs to be',
      body: 'Send a document for signature and keep the signed copy attached to the record.',
    },
  ],
  worksWith: ['money', 'customers', 'sell'],
};
