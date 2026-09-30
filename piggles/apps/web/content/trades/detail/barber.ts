import type { TradePage } from '../types';

export const BARBER_DETAIL: Pick<TradePage, 'replaces' | 'inDepth' | 'switching' | 'cost'> = {
  replaces: [
    {
      today: 'a paper appointment book at the front desk',
      instead: 'bookings',
      why: 'Clients book your real open times from their own phone, and a slot taken online cannot be written in again at the desk, so two people never turn up for the same 3:30.',
    },
    {
      today: 'texting reminders by hand the night before',
      instead: 'bookings',
      why: 'Every confirmation and reminder goes out on its own, so your evening is not spent thumbing out "see you at 10" twenty times.',
    },
    {
      today: 'a notes app on your own phone for how everyone likes it cut',
      instead: 'customers',
      why: 'The note lives on the client’s record, next to every visit and everything they bought, where the barber on the next chair can read it too.',
    },
    {
      today: 'a spreadsheet of who to send the next offer to',
      instead: 'customers',
      why: 'A group built from a rule, such as everyone who bought beard oil in the last 90 days, keeps itself current, and a hand-picked list covers the regulars no rule describes. Both are ready to write to.',
    },
    {
      today: 'a photo of the rota going round a group chat',
      instead: 'team',
      why: 'Publish the week’s schedule once and every barber sees their own shifts under their own sign-in, with approved time off already blocked out.',
    },
  ],
  inDepth: [
    {
      app: 'bookings',
      heading: 'A diary that knows who is in and how long a skin fade takes.',
      body: 'Open times are worked out from your hours, who is working, how long each service takes and what is already booked. You stop keeping a calendar in step by hand, and clients stop seeing times that were never really free.',
      points: [
        'Every service has its own length, so a beard trim and a full cut with a hot towel take the time they really take instead of the same thirty-minute block.',
        'The regular who comes every three weeks on a Friday can have a repeating appointment, booked once and held every time.',
        'Holidays and one-off closures are entered once, so nobody books into the week you are shut for the new floor.',
        'A regular who texts asking for next week gets a link that shows your real open times and puts the appointment straight on his record, with no back-and-forth.',
        'If you open a second shop later, each address has its own chairs and its own barbers, so a client books the branch they actually walk into.',
      ],
    },
    {
      app: 'customers',
      heading: 'Every regular, remembered by the whole shop.',
      body: 'A barbershop runs on remembering people. Customers keeps that memory where everybody behind the chairs can reach it, so a client who sees a different barber on a Saturday still gets asked about the new job instead of being asked his name.',
      points: [
        'Every booking, every product bought, every email and every note is on one record, a tab each, with bookings first because that is the history you check before he sits down.',
        'The same client entered twice under two spellings of his name is found and merged, and both histories join up rather than one being lost.',
        'When somebody is unhappy with a cut, the complaint goes to one named person with a time it should be answered by, so it does not age into a bad review.',
        'You can build a simple report as a sentence, such as new clients over the last 30 days, and put it on the board that opens first every morning.',
        'Groups are set by a rule rather than a list, so "bought in the last 90 days" stays accurate as people come and go.',
      ],
    },
    {
      app: 'messages',
      heading: 'Stay in touch without handing out your own phone number.',
      body: 'Messages is email and website chat that already knows who it is talking to. The shop talks to clients from the shop’s own address, and your personal phone goes back to being your personal phone.',
      points: [
        'Emails go out as you@yourshop rather than as a platform with your name in brackets, and the setup checks the details that decide whether they land in the inbox or the spam folder.',
        'A note to everybody when a new barber starts or your summer hours change goes to a group that keeps itself current, and you can see who received it and who opened it.',
        'First-time clients can be added to a short welcome when they book: a thank-you after the first cut, then a nudge to come back. An automation can take them out the moment they book again.',
        'When you answer website chat during the day, it opens beside the queue, and if the person has bought pomade or a gift card from you before, their orders are already on screen.',
        'Anyone who unsubscribes stops getting your marketing emails everywhere, for good, without you keeping a list of exceptions.',
        'The chat report shows how many conversations started and were resolved over the last 30 days and how fast the first reply went out, so you know whether evening questions are waiting too long.',
      ],
    },
  ],
  switching: [
    {
      title: 'Bring your client list across',
      body: 'Export your clients from the app you use now, or from any spreadsheet, and drop the file into Move in. Piggles guesses what each column means, you correct anything it got wrong, and you see what will be created before a single record is saved.',
    },
    {
      title: 'Add upcoming appointments by hand',
      body: 'Future appointments do not come across from a file today. Enter the next few weeks yourself, or send your regulars the booking link and let them put themselves into your real open times. Any row from your client file that could not be read is listed with its row number, so you can fix it and drop it in again.',
    },
    {
      title: 'Let the old book run out',
      body: 'Keep the old book for the appointments already in it and take every new booking in Piggles. Once the last of those old appointments has passed, there is one diary, and everything in it is somewhere the whole shop can see.',
    },
  ],
  cost: {
    heading: 'Three chairs, one price, every app.',
    body: '$99 a month covers bookings, clients, email, your website and every other app, sixteen in all. There is no charge per appointment and no charge for the reminders that keep the chairs full.',
    points: [
      'One business, one location, one main website and three people with their own sign-in are included.',
      'Bookings are unlimited, so a Saturday with forty cuts costs the same as a quiet Tuesday.',
      'Booking confirmations and reminders do not count toward the 5,000 emails a month included for your own news and offers.',
      '10,000 client records and 10 GB of storage are included. If you outgrow either, or need a fourth seat, add it in one tap with the price on the button and remove it the same way.',
      'Deposits and card payments go through the payment provider you connect, straight into your own account.',
      'If you reach a limit, the diary stays open and every booked appointment still happens. Only new additions of that one kind wait until you add room.',
    ],
  },
};
