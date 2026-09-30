import type { TradePage } from '../types';

// The deeper half of /for/workshop. Every capability below is one content/apps/*.ts
// already states. `switching` was checked against the console's Move in screen
// (piggles/apps/workbench/surfaces/migration): customers, products, stock levels,
// suppliers and open jobs import from a spreadsheet; custom records, recipes and
// already-sent quotes or invoices do not, and the copy says so.

export const WORKSHOP_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'quotes typed up in a word processor and saved as files',
      instead: 'invoices',
      why: 'A quote written there has to be retyped as an invoice, and the two never know about each other. Here the accepted quote becomes the invoice, and the deposit and the balance both land on it.',
    },
    {
      today: 'a notebook of what is left on the rack',
      instead: 'stock',
      why: 'A notebook cannot tell you how fast you really get through a material or how long your supplier really takes to deliver it. Stock can, and it says so while there is still time to order.',
    },
    {
      today: 'a shoebox of material receipts, sorted at tax time',
      instead: 'money',
      why: 'Costs recorded against the job that caused them add up to a profit figure. Costs in a shoebox add up to a long weekend in April.',
    },
    {
      today: 'hours added up from memory at the end of the week',
      instead: 'team',
      why: 'People clock in and out, so the week’s hours come from the clock rather than from memory, and the approved hours reach Money as wages.',
    },
    {
      today: 'a sticky note reminding you to chase a quote',
      instead: 'automations',
      why: 'The note falls off the monitor. The nudge goes out on the day you chose either way, and stays quiet if they already said yes.',
    },
    {
      today: 'a spreadsheet of commissions, measurements and deadlines',
      instead: 'customers',
      why: 'Your own kind of record, with the fields you always write down, sits beside the customer it belongs to and has its own place in the navigation.',
    },
  ],
  inDepth: [
    {
      app: 'invoices',
      heading: 'The price you gave is the price that gets billed.',
      body: 'A commission is paid in pieces: a deposit to start, sometimes a payment partway through, the balance on delivery. Invoices keeps all of it on one document tied to the quote it came from, so what is still owed is never a sum you work out on the back of an envelope.',
      points: [
        'Quotes and invoices carry your logo, your terms and your wording, from one set of templates you set up once.',
        'An accepted quote turns into an invoice without retyping a line, and the two stay linked, so you can always see what was promised next to what was billed.',
        'Send a link to pay whatever is still owed, deposit or balance. Paid through Stripe, each payment records itself against the right invoice.',
        'A quote can go out for signature, and the signed copy stays attached to the record for the day somebody remembers the job differently.',
        'Overdue invoices are listed by how late they are, and a reminder goes out that is firm and polite without you drafting it.',
        'A line can carry what the walnut cost you and your markup, or one of your saved markup rules, so the margin is on your screen before the quote leaves.',
      ],
    },
    {
      app: 'stock',
      heading: 'The rack, counted the way you actually buy and use it.',
      body: 'Materials in a workshop are awkward. You buy by the board, the sheet or the gallon and use them by the foot, the cut or the coat. Stock is built for that, and for things made out of other things, so the count on the screen matches the count on the rack.',
      points: [
        'Units convert, so a board bought whole and used by the foot is one material with one honest count rather than two lists that disagree.',
        'A recipe says what goes into a piece you build, shows how many you could make from what is on hand, and uses up the parts when you record the build.',
        'Freight and handling are spread across a delivery, so a board costs what it took to get it into your shop, not just the price on the supplier’s invoice.',
        'Reorder points come from how fast you really use a material and how long your supplier really takes, not a number somebody typed in during the first week.',
        'Racks, shelves and bins each hold their own count, so “we have hinges” also tells your helper which drawer to open.',
        'Counting one corner on a schedule keeps the record honest without losing a day to a full stocktake, and every correction is approved by a person.',
      ],
    },
    {
      app: 'money',
      heading: 'Find out what the job made, not just what it charged.',
      body: 'Turnover says you were busy. Money says whether you were paid for it. Because the sales, the materials and the costs already live in Piggles, profit on a commission is a screen you open rather than an evening with a calculator.',
      points: [
        'One lumber bill can be split across the three commissions it was for, and a subcontractor’s bill charged to the job that needed it, so every finished piece has a real figure beside it.',
        'Every job is listed with what it made after its materials and the costs you charged to it, worst first, so you see which kinds of work are worth taking on again and which only look good in photographs.',
        'Costs that come round every month, like rent, insurance and the van, are recorded once and stay in the picture without being retyped.',
        'What customers owe you is sorted by how old it is, and what you owe your lumber yard shows when it falls due.',
        'Once your helper’s hours are approved in My Team, they arrive here as wages on their own, so the people you pay are in the profit figure without a second entry.',
        'Your accountant gets the numbers without a year of retyping, handed over as a spreadsheet of your spending with every column labeled and their account codes on each line.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring the lists you already keep.',
      body: 'Open Move in, drop in the spreadsheet of customers or materials you already have, and say what each column means. Piggles shows what will happen to every row before anything is saved, and any row it cannot take is listed with its row number from your file, so you fix it in the spreadsheet and try again. Stock counts can carry the shelf, the reorder level and what each piece cost you. Jobs you are still quoting can come in the same way, with what each is worth and how far along it is.',
    },
    {
      title: 'Type in the parts that only live in your head.',
      body: 'Some things have no file to import, and it is better to know that now. Your commission record (the fields for measurements, wood, finish and the date needed) is set up by hand, once. So are the recipes for pieces made of other parts. Quotes and invoices already sent from your old tool stay there: let the paid ones rest, and raise the open ones again here.',
    },
    {
      title: 'Run the next job on it from quote to delivery.',
      body: 'Profit by job only knows the costs recorded against that job, so the cleanest switch is one commission run entirely on Piggles: quote, materials, costs and invoice. Your old jobs stay where they are. From that first one on, every piece that leaves the bench has a real figure beside it.',
    },
  ],
  cost: {
    heading: 'One price, and it does not climb because a job got bigger.',
    body: 'Piggles is $99 a month, flat, with all sixteen apps included. For a workshop that means quotes, invoices, stock, the website, timesheets and your money figures on one bill. The price changes only if the business needs more room, never because you used another app.',
    points: [
      'The $99 covers one business, one location, one website on your own domain, and three people with their own sign-ins.',
      'Products, orders and invoices are unlimited, so a hundred materials or a thousand quotes cost the same as ten.',
      'Room for 10,000 customer records, 10 GB of storage for photos of finished pieces and drawings, and 5,000 email sends a month. Order and booking emails do not count toward the sends.',
      'A second unit across town is an added location, and a fourth person at the bench is an added seat. Each is added in one tap with the price on the button, and removed the same way.',
      'Reaching a limit switches nothing off. Your site stays up, and only new additions of that one kind pause until you add room.',
      'The first 14 days are free with no card, long enough to quote and invoice a real job before you decide.',
    ],
  },
};
