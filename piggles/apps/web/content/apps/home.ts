import type { AppMarketing } from './types';
import { HOME_CHAPTERS } from './chapters/home';

// Home is the dashboard AND the place the business itself is set up. It fronts
// the whole platform module, so its panel holds your business details, your
// sites, your domains, notifications, sign-in security, guided setup, practice
// data and the background-job feed.
//
// This page described only the dashboard. Twelve of Home's sixteen screens had
// no sentence anywhere on the site, which made the app look like a widget board
// and left a reader wondering where the settings for their actual business were.
//
// All six bullets rewritten 2026-09-30, because none of the six described the
// screen that ships (see chapters/home.ts for what was checked). Home counts
// seven queues; it has no weekly takings or cost figure, no forecast of stock or
// of invoices about to go late, no unassigned-booking signal, and nothing on it
// can be moved or removed.

export const HOME: AppMarketing = {
  heading: 'Start the day knowing what actually needs you.',
  lede: 'Home is the first screen you see and usually the only one you need before the doors open. It greets you, counts what is waiting on you in plain sentences, and takes you straight to each thing with one tap. Behind it sit the record of everything that happened and the settings that describe your business.',
  alsoKnownAs: ['dashboard', 'business intelligence', 'KPI reporting'],
  does: [
    {
      title: 'What is waiting on you',
      body: 'Orders to send, chats and website messages to answer, bookings to confirm, late invoices, and stock that has sold out or is running low, each as one plain sentence.',
    },
    {
      title: 'One tap to the thing itself',
      body: 'Every line opens the list it counted from. The sold-out line opens on just the sold-out items, and the website messages line on just the new ones.',
    },
    {
      title: 'Numbers you can believe',
      body: 'Every count is real. If one cannot be fetched, Home says so instead of showing a zero that looks like good news.',
    },
    {
      title: 'Everything that happened',
      body: 'A running record of orders, published pages, imports and changes, newest first, with who did each one.',
    },
    {
      title: 'Pick up where you left off',
      body: 'The screens you had open are still open when you come back, arranged the way you left them on that device, separately for each site you run.',
    },
    {
      title: 'Only what you use',
      body: 'An app you have not added has no line on Home, so a bakery and a workshop do not start the day looking at the same thing.',
    },
  ],
  chapters: HOME_CHAPTERS,
  worksWith: ['money', 'stock', 'bookings'],
};
