import type { TradePage } from '../types';

export const GARAGE_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a wall calendar with the bays written in marker',
      instead: 'bookings',
      why: 'Bookings knows how long each service takes, who is working and which bay is free, so the day fills up without anybody walking over to check the wall.',
    },
    {
      today: 'a carbon-copy estimate pad',
      instead: 'invoices',
      why: 'Quotes, estimates, invoices and receipts come from one set of templates with your logo and terms, so every piece of paper looks like it came from the same business.',
    },
    {
      today: 'a filing cabinet of old job cards',
      instead: 'customers',
      why: 'Every car has its own record linked to its owner, and each visit adds to it, so "what did we do last time" is a search instead of a rummage.',
    },
    {
      today: 'a notebook of who still owes for last month',
      instead: 'invoices',
      why: 'The overdue list shows who is late and by how long, trade customers on agreed terms get a due date counted from the day they receive the bill, and part payments are recorded the day they arrive.',
    },
    {
      today: 'a sheet of paper for the parts on order',
      instead: 'partners',
      why: 'Parts on order are purchase orders with a promised date. A part-delivery leaves the rest outstanding, and anything past its date is listed as late.',
    },
    {
      today: 'hours scribbled on the back of the job card',
      instead: 'team',
      why: 'Each mechanic clocks in and out, so the week’s labor is a timesheet you approve rather than a guess made at the end of the week.',
    },
  ],
  inDepth: [
    {
      app: 'bookings',
      heading: 'A day that fills itself, one bay at a time.',
      body: 'A garage books a lift, a person and a stretch of hours, not just a time. Bookings works all three out together, so the times a customer sees online are times you can actually deliver.',
      points: [
        'Each service has its own length, so an oil change and a timing belt take the time they really take and the rest of the day arranges itself around them.',
        'Buffers between jobs leave time to clear the bay and road-test a car before the next one rolls in.',
        'A business customer whose vans come in every twelve weeks can have a repeating booking, made once and held every time.',
        'Confirmations and reminders go out on their own, with a link the customer can use to move the booking rather than just not showing up.',
        'For big jobs with parts ordered in specially, you can take a deposit up front, with a cancellation rule applied the same way to everybody.',
        'When somebody cancels, the next person on the waiting list is offered the slot instead of the lift standing empty.',
      ],
    },
    {
      app: 'invoices',
      heading: 'Paperwork that matches the work, and money that turns up.',
      body: 'Invoices produces the document, sends it, records the payment and tells you who is late. It handles the one-off customer paying at pickup and the local business that runs an account with you in the same place.',
      points: [
        'When the customer approves a quote, an exact copy is kept, so if the job changes once the car is apart, the version they agreed to still prints the way it stood.',
        'Business customers, like a local delivery firm, pay on agreed terms, with the due date counted from the day they receive the bill and part payments recorded as they come in.',
        'The overdue list shows who is late and by how long, and a firm, polite reminder goes out without you writing it each time.',
        'Send a link to pay whatever is still owed, through the payment provider you connected. Paid through Stripe, it records itself against the right invoice.',
        'Every invoice sits on the owner’s record, so a warranty question next spring starts with the paperwork already in front of you.',
      ],
    },
    {
      app: 'customers',
      heading: 'Every car, every owner, every visit, kept.',
      body: 'A garage has records no ordinary contact list has a name for. Customers lets you keep the car as its own thing, linked to the person who brings it in and the business that pays for it, with the whole history in one place.',
      points: [
        'A delivery firm with six vans is one company with six vehicles and the drivers who bring them in, not six unrelated customers.',
        'Bigger jobs you are quoting for, like a clutch or an engine rebuild, sit on a board with their value and next step, so the follow-up call actually happens.',
        'A complaint about a repair goes to one named person with a time it should be answered by, so it is dealt with before it turns into a review.',
        'Connect your mailbox and emails from customers land on their record every few minutes, and a call made from their record is kept with who, when and how long, not typed up later.',
        'The same customer entered twice is found and merged, and both histories join up rather than one being lost.',
        'A group built from a rule keeps itself current, and a hand-picked list covers the customers no rule describes, both ready to write to about their next service.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring in customers, parts and suppliers',
      body: 'Drop your customer list, your parts list and your supplier list into Move in, from any spreadsheet or from the system you use now. Piggles guesses what each column means, you correct it, and you see exactly what will be created before anything is saved.',
    },
    {
      title: 'Type in the cars and the open jobs',
      body: 'Vehicle records do not come across from a file today, and neither do unpaid invoices or future bookings. Add each car as it comes in, and enter open jobs and next week’s bookings by hand. The history builds from the first visit on.',
    },
    {
      title: 'Fix what did not fit',
      body: 'Any row that could not be read is listed with its row number from your own file. Download the list, fix it next to your data and drop the file in again. Every past move is kept, so you can check what came across and when.',
    },
  ],
  cost: {
    heading: 'One price for the bays, the parts and the paperwork.',
    body: '$99 a month covers bookings, invoices, parts, your website and every other app, sixteen in all. Taking on more jobs never moves you to a bigger plan, because there is only one.',
    points: [
      'One business, one location, one main website and three people with their own sign-in, whether that is you and two mechanics or two mechanics and the front desk.',
      'Bookings, invoices, orders and the parts on your shelves are unlimited.',
      'Booking confirmations and reminders do not count toward the 5,000 emails a month included for your own announcements.',
      '10,000 customer records and 10 GB of storage for photos of damage, signed quotes and other documents are included.',
      'A fourth mechanic, more storage or a second location can be added in one tap with the price shown on the button, and removed the same way.',
      'Fourteen days free with no card needed. If you do not carry on, nothing is charged.',
    ],
  },
};
