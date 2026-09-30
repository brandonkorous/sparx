import type { TradePage } from '../types';

// Tailor depth: what it replaces, the three leaned-on apps, moving over, and cost.
// Measurements live in a record the tailor designs, which no import fills today.

export const TAILOR_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a notebook of measurements',
      instead: 'customers',
      why: 'Measurements go on a record you designed, linked to the client, so a second suit two years later starts from the first one instead of a smudged page.',
    },
    {
      today: 'a paper diary for fittings',
      instead: 'bookings',
      why: 'A fitting booked in Bookings reminds the client before the day and lets her move it herself, so a missed fitting stops being the first you hear of a problem.',
    },
    {
      today: 'an invoicing app that knows nothing about the job',
      instead: 'invoices',
      why: 'The invoice sits on the same client record as the measurements and the fittings, and the deposit and the balance are recorded against the same document.',
    },
    {
      today: 'a spreadsheet of what each job cost in cloth and trimmings',
      instead: 'money',
      why: 'The cloth and the lining are charged to the job they were for, so what a suit made after its costs is a screen rather than an evening’s arithmetic.',
    },
    {
      today: 'a printed quote the client signs and photographs',
      instead: 'invoices',
      why: 'Send the quote for signature and the signed copy stays attached to her record, where you will find it when the question comes up at the second fitting.',
    },
  ],
  inDepth: [
    {
      app: 'bookings',
      heading: 'Fittings in the right order, with time to do them properly.',
      body: 'A tailor’s calendar is not a row of equal slots. A first fitting takes longer than a hem, a wedding suit needs two fittings before a date that cannot move, and Saturday keeps its own hours.',
      points: [
        'Each service has its own length, so a first fitting books a longer slot than a trouser alteration without you working it out.',
        'A fitting that needs the fitting room cannot be booked while somebody else is already in there.',
        'Saturday hours, holidays and a week away are set once and respected by every booking after that.',
        'Clients get a reminder before each fitting with a link to move it themselves, which cuts the no-shows that push a deadline back.',
        'Bespoke work can take a deposit when the fitting is booked, under a cancellation policy that applies to everybody the same way.',
        'When somebody cancels, the next person on the waiting list is offered the slot instead of it going empty.',
      ],
    },
    {
      app: 'customers',
      heading: 'Her measurements from two years ago, still there when she comes back.',
      body: 'Measurements are the most valuable thing a tailor keeps and usually the worst kept. Customers holds them on a record you shaped yourself, linked to the person, beside every job you have ever made for her.',
      points: [
        'Create a measurement record with your own fields, from chest and inseam to posture notes, and link each set to the client.',
        'Because a measurement set is its own record, a client can have more than one, so the set from two years ago sits beside today’s.',
        'Every job sits on a board with stages you named, a value and a due date, so the wedding suit due in May is not buried under this week’s hems.',
        'A task with a date on the job, such as calling when the cloth arrives, makes the follow-up a thing that exists rather than an intention.',
        'Connect your mailbox and every email with a client lands on her record without anybody copying it across.',
        'Won and lost quotes are counted, so you can see which kinds of work you actually win and price the rest accordingly.',
      ],
    },
    {
      app: 'invoices',
      heading: 'The deposit, the balance and the awkward bit, handled.',
      body: 'Bespoke work is paid in parts: a deposit when the cloth is ordered and the balance at collection. Invoices keeps both against one job, so you never have to remember who has paid what, or bring it up in person.',
      points: [
        'Quotes, estimates, invoices and receipts carry your logo, your terms and your wording, all from one set of templates.',
        'The quote she accepts becomes the invoice without retyping a line, and the two stay linked.',
        'Send her a link to pay whatever is still owed. Paid through Stripe, each payment records itself against the right invoice.',
        'An overdue balance shows how long it has been waiting, and a firm, polite reminder goes out without you writing it each time.',
        'Every invoice shows what has been paid and what is left, and the total you are owed sits at the top of the list before you read a single row.',
        'Steps named your way (estimate, work order, invoice, receipt) keep a bespoke job as one document, from the price she agreed to the receipt at collection.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring your client list across.',
      body: 'If names, phone numbers and emails are in a spreadsheet or another app’s export, open “Move in from somewhere else” in your console and drop the file in. Piggles guesses which column is which, shows what will happen to every row before anything is saved, and brings a notes column across as each client’s note.',
    },
    {
      title: 'Enter measurements by hand, one client at a time.',
      body: 'Your measurement record is yours to design, and it does not fill itself from an import today. Type each set in as the client next comes through the door. For most regulars that is when you would measure again anyway.',
    },
    {
      title: 'Move over the jobs that are still open.',
      body: 'Open jobs, upcoming fittings and unpaid balances are typed in by hand: each job on the board at its stage, each fitting in the book, each balance as an invoice. Finished work can stay in the old notebook, where it was already safe.',
    },
  ],
  cost: {
    heading: 'What a one-person workroom pays, and what could change it.',
    body: '$99 a month, flat. Bookings, invoices, client records, your website and email are all included, and bookings and invoices are unlimited, so wedding season costs the same as January. Try it free for 14 days without a card.',
    points: [
      'Three people are included, so an apprentice or somebody at the counter gets their own sign-in with no change to the bill.',
      'One location and one website on your own address are included, with the security certificate handled for you.',
      'Room for 10,000 client records and 10 GB of storage for fabric photos and signed documents is included.',
      'Up to 5,000 marketing emails a month are included, and booking emails do not count toward that.',
      'Deposits and balances paid online go through the payment provider you connect, which charges its own fees under your agreement with them.',
      'More people, storage or email can be added in one tap with the price shown first, and removed just as easily.',
    ],
  },
};
