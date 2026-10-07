import type { PigglesGroup } from '@piggles/brand';
import type { MascotPoseId } from '@piggles/mascot';
import { APP_COUNT, numberWord } from '@piggles/config';

// One app window, an ordinary Thursday scrolling through it. Each beat lights an
// app in the rail, moves the clock, changes the mascot's pose and opens a window
// that STAYS, so by the last beat the desk is full: the claim, shown.

// Poses follow where the beat happens, not where she sits: the day starts and
// ends at the desk, the middle goes wherever the work goes (a counter, a shelf).
// Six laptops at this size read as one picture that never changes.

export interface Row {
  label: string;
  sub: string;
  /** Right-hand side: a badge, or a figure to shout. */
  badge?: { text: string; tone: 'module' | 'success' | 'warning' };
  figure?: string;
}

export interface Beat {
  /** Minutes past midnight. The clock lands exactly here. */
  at: number;
  when: string;
  /** Apps this beat lights in the rail. First one is the hot one. */
  lights: string[];
  group: PigglesGroup;
  pose: MascotPoseId;
  heading: string;
  body: string;
  window: { title: string; rows: Row[] };
  /** Position on the desk. Literal Tailwind classes so they generate. */
  place: string;
}

// Two staggered columns, not an overlapping cascade: a window covering another
// window's words is a defect, not charm.
export const BEATS: Beat[] = [
  {
    at: 460,
    when: '07:40 · Bookings',
    lights: ['bookings'],
    group: 'people',
    pose: 'calendar-desk',
    heading: 'It booked itself while you were asleep.',
    body: 'Somebody found your site at half eleven last night and took a place. No email to read, no diary to copy it into.',
    place: 'left-[33%] top-[3%] w-[26%]',
    window: {
      title: 'Bookings',
      rows: [
        {
          label: 'Wreath workshop',
          sub: 'Saturday · 10:00',
          badge: { text: '6 of 8', tone: 'module' },
        },
        {
          label: 'Two seats taken',
          sub: 'Booked online · 23:14',
          badge: { text: 'New', tone: 'success' },
        },
      ],
    },
  },
  {
    at: 545,
    when: '09:05 · Customers',
    lights: ['customers', 'messages'],
    group: 'people',
    pose: 'front-counter',
    heading: 'You know who they are before they finish the sentence.',
    body: 'Every order, message and booking they have ever made is on the same card. Not in a separate system you pay separately for.',
    place: 'left-[65%] top-[17%] w-[28%]',
    window: {
      title: 'Customers',
      rows: [
        {
          label: 'Regular customer',
          sub: '4 orders · 2 workshops',
          badge: { text: 'Repeat', tone: 'module' },
        },
        {
          label: 'Last message',
          sub: '“Same again for the shop window?”',
          badge: { text: 'Reply', tone: 'warning' },
        },
      ],
    },
  },
  {
    at: 680,
    when: '11:20 · Sell & Stock',
    lights: ['sell', 'stock'],
    group: 'sell',
    pose: 'retail-shop',
    heading: 'Sell one. The shelf count moves on its own.',
    body: 'You didn’t type it anywhere. Selling and counting are not two products here, so they cannot disagree with each other.',
    place: 'left-[36%] top-[32%] w-[27%]',
    window: {
      title: 'Sell → Stock',
      rows: [
        {
          label: 'Order taken',
          sub: '3 × hand-tied bouquet',
          badge: { text: 'Paid', tone: 'success' },
        },
        { label: 'Left on the shelf', sub: 'Was 14', figure: '11' },
        {
          label: 'Ribbon, 25mm',
          sub: 'Below your reorder point',
          badge: { text: 'Reorder', tone: 'warning' },
        },
      ],
    },
  },
  {
    at: 825,
    when: '13:45 · Invoices',
    lights: ['invoices'],
    group: 'money',
    pose: 'reports-desk',
    heading: 'The invoice already knew what the job was.',
    body: 'It was the booking half an hour ago. You added a line and sent it. Nothing was copied from one screen into another.',
    place: 'left-[68%] top-[43%] w-[26%]',
    window: {
      title: 'Invoices',
      rows: [
        {
          label: 'INV-2214',
          sub: 'From Saturday’s workshop',
          badge: { text: 'Sent', tone: 'success' },
        },
        { label: 'Due', sub: 'Card or bank transfer', figure: '$340' },
      ],
    },
  },
  {
    at: 930,
    when: '15:30 · My Site',
    lights: ['site'],
    group: 'web',
    pose: 'desktop-computer',
    heading: 'Your website is not a different company.',
    body: 'It is the same products, the same prices and the same calendar you have been looking at all day. Change one, it changes everywhere.',
    place: 'left-[34%] top-[63%] w-[25%]',
    window: {
      title: 'My Site',
      rows: [
        {
          label: 'Spring arrivals',
          sub: 'New page · live now',
          badge: { text: 'Published', tone: 'success' },
        },
        {
          label: 'Workshop page',
          sub: 'Shows 2 seats left',
          badge: { text: 'Auto', tone: 'module' },
        },
      ],
    },
  },
  {
    at: 1070,
    when: '17:50 · That’s the day',
    lights: ['money'],
    group: 'money',
    pose: 'desk-celebrate',
    // Filled in below from the rail's own count, so the claim survives a check.
    heading: '',
    body: '',
    place: 'left-[64%] top-[69%] w-[28%]',
    window: {
      title: 'Money',
      rows: [
        { label: 'Taken today', sub: 'Shop, site and workshop', figure: '$1,286' },
        { label: 'Still owed', sub: '1 invoice out', badge: { text: '$340', tone: 'warning' } },
      ],
    },
  },
];

// The closing beat is COUNTED from `lights`, never typed: a visitor can count the
// rail, and the hand-typed "eight and seven" once added to fifteen of sixteen.
const DAY_LIT = new Set(BEATS.flatMap((b) => b.lights)).size;
const DAY_REST = APP_COUNT - DAY_LIT;
const CLOSING = BEATS[BEATS.length - 1];
if (CLOSING) {
  const lit = numberWord(DAY_LIT);
  CLOSING.heading = `${lit.charAt(0).toUpperCase() + lit.slice(1)} apps before six o’clock. You opened one.`;
  CLOSING.body = `The other ${numberWord(DAY_REST)} were there the whole time: content, suppliers, staff, automations, the rest. Not an upgrade. Not an add-on. Just not needed today.`;
}
