import type { AppChapter } from '../types';

// Home fronts the whole platform module: the Home screen itself, Pulse (what
// happened, what needs you, what is running), and the settings that are facts
// about the business rather than about one app. Chapters follow a morning: what
// needs me, what happened, who am I on paper, and the very first hour.
//
// VERIFIED 2026-09-30 against piggles/apps/workbench/surfaces/home.tsx and
// home/signals.ts (the seven things Home counts, and the three site offers),
// lib/console/home-data.ts (real counts only, polled each minute, shared with
// the side bar), surfaces/pulse (activity feed, Needs your attention, running
// jobs), surfaces/notifications/data.ts (nine kinds, three ways, three email
// rhythms), business-details, industry, sites, domains, security, sample-data,
// migration, feedback, first-run.tsx and lib/workbench/persistence.ts.
// DELIBERATELY ABSENT: any revenue, cost or week-on-week figure (Home counts
// queues, it does not report takings), forecasting of stock or late invoices,
// and moving or hiding what is on Home (it is fixed, and apps you have not
// added simply have no line).

export const HOME_CHAPTERS: AppChapter[] = [
  {
    heading: 'What needs you, in sentences rather than charts.',
    body: 'Nobody opens their business software at eight in the morning to ask how the business is doing. They ask what needs them. Home answers in plain lines, “3 orders are waiting to go out”, with the number as the loudest thing on the line and the line itself the way in. When nothing is waiting, it says that too, and gets out of your way.',
    does: [
      {
        title: 'Seven things it keeps an eye on',
        body: 'Orders waiting to go out, people waiting for a chat reply, people who wrote to you from your website, bookings to confirm, late invoices, things that have sold out, and things running low.',
      },
      {
        title: 'The line is the way in',
        body: 'Tap a line and the list behind it opens. The sold-out line, for one, opens the stock list narrowed to just the sold-out items, not every product you own.',
      },
      {
        title: 'Only the apps you use',
        body: 'An app you have not added has no line on Home at all. Not a zero, not a grayed-out box.',
      },
      {
        title: 'No comforting zeros',
        body: 'Every number is a real count. If one could not be fetched, Home says so on a line of its own rather than showing a zero that reads exactly like good news.',
      },
      {
        title: 'Everything clear is one sentence',
        body: 'The things with nothing waiting are gathered into a single quiet line, such as “everything is sent and nothing is late”, instead of seven green ticks to read.',
      },
      {
        title: 'Current without refreshing',
        body: 'The counts check themselves about once a minute, and the same numbers sit beside each app in the side bar, so the two can never disagree.',
      },
      {
        title: 'Start something from here',
        body: 'Add a product, send an invoice, add a customer, or go straight to working on your site, one tap each.',
      },
      {
        title: 'When your site could be better',
        body: 'Home tells you if the design you started from has been refreshed, if your live site is behind the version you saved, or if example words and products are still showing after you went live.',
      },
    ],
  },
  {
    heading: 'What happened, what is waiting, what is still going.',
    body: 'Pulse is the longer view. It keeps a running record of everything that has happened in the business, the notices addressed to you personally, and the long jobs working in the background, so “did that import finish?” and “who changed this price?” both have somewhere to be answered.',
    does: [
      {
        title: 'Everything that happened, newest first',
        body: 'Orders, published pages, imports and changes, each marked with the app it belongs to. A run of identical changes is folded into one line with a count, so one big edit does not bury the rest.',
      },
      {
        title: 'Who did it',
        body: 'You, a named teammate, a customer, another piece of software you connected, or an AI assistant you gave access to. Each is named for what it is.',
      },
      {
        title: 'Notices that wait for you',
        body: 'A payment that failed, stock running low, a reply from the Piggles team. They stay until you have dealt with them, and you can look back through every one, read or not.',
      },
      {
        title: 'The bell for the short version',
        body: 'The newest unread notices sit behind the bell at the top of the window, and opening one takes you to the thing it is about.',
      },
      {
        title: 'Long jobs you can watch',
        body: 'Imports and syncs show their progress while they run, and recent runs stay listed with what finished, what failed and why. A job that fails silently is how a day of work goes missing.',
      },
    ],
  },
  {
    heading: 'And the settings that are about your business, not your website.',
    body: 'Every product has a settings screen nobody can find. Home is where yours are, because they are not really settings. They are facts about your business that everything else reads: your name and address on an invoice, which trade you are in, where your sites live, how you want to hear about things, and who is allowed in.',
    does: [
      {
        title: 'Your business details, used everywhere',
        body: 'Name, type of business, company number, address, phone and support email, your tax number if you are registered, and your usual currency and time zone. Written once, then used on your invoices and documents.',
      },
      {
        title: 'What kind of business you are',
        body: 'Pick your trade and the wording you see changes to match, with a starting setup built for it: example categories, sensible defaults and a little content to build on. It never removes anything you already made.',
      },
      {
        title: 'Every site you run',
        body: 'One list of the sites this business owns, each with its own name and web address, which one is the main one, and a visitor count that needs no cookie banner.',
      },
      {
        title: 'Each site shows only what it needs',
        body: 'Switch off anything one site has no use for and it stays available on the others. Delete a site and its pages go with it, while its orders and customers stay with the business.',
      },
      {
        title: 'Web addresses, connected and kept working',
        body: 'Every site starts with a free piggles.site address. Connect a domain you own by adding the records listed, and the security certificate is issued and renewed on its own.',
      },
      {
        title: 'Told about the right things',
        body: 'For each of nine kinds of news, from orders to sign-ins, choose email and the bell, the bell only, or nothing. Email can arrive as it happens, once a day or once a week, and your choices affect nobody else.',
      },
      {
        title: 'Signing in, and who is signed in',
        body: 'Your password, two-step sign-in with a code from your phone, every device currently signed in with the ability to sign one out, and a record of what people have done in the account.',
      },
    ],
  },
  {
    heading: 'The first hour, and moving in.',
    body: 'Two things almost nothing does well: the very beginning, and bringing years of records across from somewhere else. A new account arrives already furnished, so you can see what a working business looks like before you have typed anything, and moving in shows you exactly what will happen before a single record is written.',
    does: [
      {
        title: 'Three first jobs, then it leaves',
        body: 'Add the first thing you sell, add someone you work with, and send your first invoice, for whichever of those apps you use. Each is ticked off by what you have actually done, and the list disappears for good once they are.',
      },
      {
        title: 'A business that already has things in it',
        body: 'Practice records for the apps you use (products, customers, orders, bookings) so you are learning on something that looks real.',
      },
      {
        title: 'And one button to clear them out',
        body: 'Removing the practice data deletes every sample record and touches none of your own, and tells you how many of each kind went.',
      },
      {
        title: 'Bring your old business with you',
        body: 'Drop in the export your old platform made and it is read on your own computer first. A few platforms can connect with a read-only key instead, and nothing about that key is kept afterward.',
      },
      {
        title: 'A practice run before the real one',
        body: 'Try an import with nothing saved, see exactly what would come across, then run it for real. Bringing the same file in twice updates what is there rather than doubling it.',
      },
      {
        title: 'Every move on record',
        body: 'Past moves are kept with exactly what landed, so “did the orders ever come across?” has an answer months later.',
      },
      {
        title: 'What you told us',
        body: 'Report a problem or ask for something from inside the console, and follow the conversation about it afterward.',
      },
    ],
  },
];
