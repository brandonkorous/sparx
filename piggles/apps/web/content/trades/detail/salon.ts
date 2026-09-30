import type { TradePage } from '../types';

// Salon depth: what it replaces, the three leaned-on apps, moving over, and cost.
// Import facts come from the console's "Move in" screen: client lists come across,
// services and appointments do not.

export const SALON_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a booking app that charges per stylist',
      instead: 'bookings',
      why: 'Bookings is in the flat price however many chairs you fill, and it already knows who is working, because the schedule lives in the same place as the book.',
    },
    {
      today: 'a group chat for the rota and who is off',
      instead: 'team',
      why: 'The schedule is published in My Team and time off is requested and approved there, so the answer to “am I in on Thursday” is on everybody’s phone instead of forty messages up.',
    },
    {
      today: 'a spreadsheet of hours for the wages',
      instead: 'money',
      why: 'Once hours are approved in My Team they arrive in Money as wages, so the people you pay sit beside the takings and the week’s result is what you actually kept.',
    },
    {
      today: 'a notebook of color formulas at the desk',
      instead: 'customers',
      why: 'The formula lives on the client’s record, where any stylist can open it, including on the day the person who wrote it is off.',
    },
    {
      today: 'a separate email tool for the monthly newsletter',
      instead: 'messages',
      why: 'Messages sends from your salon’s own address to groups that keep themselves current, and the emails each client opened and clicked show on her record.',
    },
    {
      today: 'a website that still shows last year’s prices',
      instead: 'site',
      why: 'You change the price list yourself in My Site, on a Tuesday afternoon between clients, and it reads properly on the phone where clients actually look at it.',
    },
  ],
  inDepth: [
    {
      app: 'bookings',
      heading: 'The book fills itself, and only with appointments that can really happen.',
      body: 'A salon book is harder than most. Services run different lengths, not every stylist does every service, and Saturday keeps its own hours. Bookings works all of that out before a client is ever shown a time.',
      points: [
        'A client choosing a long color service is only offered times when a stylist who does color is in and free for the whole appointment.',
        'Buffers between appointments give a stylist time to clean down and reset the chair, so back to back never means rushed.',
        'A regular who comes every six weeks can be booked as a repeating appointment, so the next visit is in the book before she leaves.',
        'Holidays, a one-off closure for a training day and shorter Saturday hours are set once and respected by every booking after that.',
        'From a client’s record you can send a link that shows your real availability and puts the appointment straight back on her record.',
        'A late cancellation on a long service is covered by the deposit and the policy you set, applied the same way for every client.',
      ],
    },
    {
      app: 'team',
      heading: 'Your stylists see their day. They do not see your bank balance.',
      body: 'Most salons run on a small team with very different jobs: the owner, senior stylists, a junior and somebody on the desk on Saturdays. My Team gives each of them their own way in, and only the parts their job needs.',
      points: [
        'Everyone signs in as themselves, so there is no shared password under the desk and no guessing who moved an appointment.',
        'Ready-made roles cover the usual cases, and you can adjust one person when your senior stylist also runs the desk on Saturdays.',
        'Timesheets record the hours each person actually worked against their shift, and Piggles hands the hours and rates to whoever runs your payroll.',
        'A license or certificate is kept with its expiry date and raised while there is still time to renew it.',
        'Significant changes are logged with a name and a time, so a canceled appointment nobody remembers canceling has an answer.',
        'When a stylist leaves, her access is revoked in one action and her clients’ history stays with the salon.',
      ],
    },
    {
      app: 'customers',
      heading: 'Every client’s formula, where every stylist can find it.',
      body: 'The notebook at the desk only worked when its author was in. Customers keeps everything you know about a client on one record that anybody on the team can open, from the desk or from a phone at the chair.',
      points: [
        'Set up your own kind of record for color formulas, with the fields you actually write down, and link each one to the client it belongs to.',
        'Every visit, product bought, email and note is on one record, a tab each with bookings first, so a new junior can read a regular’s history in a minute.',
        'Groups such as everyone who bought the color-care range keep themselves current, ready for a note from Messages.',
        'The same client booked twice under two spellings is found, and merging keeps both histories instead of losing one.',
        'A complaint about a cut is assigned to a person, with a time it should be answered by, so it does not sit unread in the salon inbox.',
        'Answers you give every week, like whether you do bridal hair, are saved once and dropped into a reply instead of retyped.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring your client list across first.',
      body: 'Open “Move in from somewhere else” in your console and drop in the export from your old booking app, or your own spreadsheet. Piggles reads it on your own computer, guesses which column is the name, the phone and the email, and shows what will happen to every row before anything is saved. A notes column comes across as each client’s note, so a formula written there arrives with her.',
    },
    {
      title: 'Set up services and stylists by hand.',
      body: 'Services, their lengths and prices, who does which, and each stylist’s hours do not come across in an import today, so you type them in. It is the part worth doing carefully, because it is exactly what the book is worked out from.',
    },
    {
      title: 'Copy the appointments already booked, then switch.',
      body: 'Upcoming appointments are also typed in by hand. Pick a quieter week, copy across what is already in the old book, stop taking new bookings there, and point the booking link on your website and social pages at the new one.',
    },
  ],
  cost: {
    heading: 'One price for the salon, however full Saturday gets.',
    body: '$99 a month, flat. Bookings, the staff schedule, client records, your website and email are all included, and appointments are unlimited, so a fully booked December costs the same as a quiet February. Try it free for 14 days without a card.',
    points: [
      'Three people are included, each with their own sign-in. A bigger team adds more people in one tap, with the price on the button before you commit, and removes them just as easily.',
      'One location and one website on your own address are included, with the security certificate handled. A second salon can be added as another location any time.',
      'Room for 10,000 client records and 10 GB of photos and files is included. Most businesses never come near either.',
      'Up to 5,000 marketing emails a month are included, and booking confirmations and reminders do not count toward that.',
      'Deposits go through the payment provider you connect, which charges its own fees under your own agreement with them.',
      'If you ever reach a limit, nothing already in the book is touched. Only new additions of that one kind pause until you add room.',
    ],
  },
};
