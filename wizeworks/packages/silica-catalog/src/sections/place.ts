// Where you are, when you are open, and how to reach you.
//
// The gap these close: a shop, a restaurant, a clinic, a salon and a garage all live
// or die on "are you open now and where are you", and the shelf had a contact form.
// A form is the wrong answer to both questions — somebody standing in the street
// wants an address and a phone number, not a text box and a wait.
//
// The address is authored as a real `<address>` with a `tel:` link, because on a phone
// the useful thing about a phone number is that you can press it.

import { el, type Node } from '@wizeworks/silicaui-html';

import {
  actions,
  body,
  card,
  cardTitle,
  caption,
  gridThree,
  picture,
  primaryAction,
  secondaryAction,
  section,
  sectionAlt,
  sectionHead,
  CARD,
} from './_shell';

/** Opening hours as a table, so "Thursday" stays attached to its hours however the
 *  column narrows — and so a screen reader announces the pair rather than fourteen
 *  loose words. */
export function openingHours(): Node {
  const day = (name: string, hours: string, closed = false): Node =>
    el('tr', '', {
      children: [
        el(
          'th',
          'border-t border-base-300 py-3 pr-6 text-left text-base font-medium text-base-content',
          {
            text: name,
          }
        ),
        el('td', 'border-t border-base-300 py-3 text-base text-base-content', {
          text: closed ? 'Closed' : hours,
        }),
      ],
    });
  return section([
    sectionHead('Opening hours'),
    el('table', 'w-full max-w-md border-collapse', {
      children: [
        el('tbody', '', {
          children: [
            day('Monday', '8am – 5pm'),
            day('Tuesday', '8am – 5pm'),
            day('Wednesday', '8am – 5pm'),
            day('Thursday', '8am – 7pm'),
            day('Friday', '8am – 5pm'),
            day('Saturday', '9am – 1pm'),
            day('Sunday', '', true),
          ],
        }),
      ],
    }),
    caption('Bank holidays vary — call ahead if you are making a special trip.'),
  ]);
}

/** One location: address, phone, and the two actions somebody standing outside
 *  actually wants. */
export function findUs(): Node {
  return section([
    el('div', 'grid grid-cols-1 gap-10 @3xl:grid-cols-2', {
      children: [
        picture('The workshop on Mill Lane', 'wide'),
        el('div', 'flex flex-col gap-5', {
          children: [
            el('h2', 'text-3xl font-semibold text-base-content', { text: 'Find us' }),
            el('address', 'flex flex-col gap-1 text-base not-italic text-base-content', {
              children: [
                el('span', '', { text: 'The Old Mill, Mill Lane' }),
                el('span', '', { text: 'Ashford, Kent' }),
                el('span', '', { text: 'TN23 1QX' }),
              ],
            }),
            el('div', 'flex flex-col gap-2', {
              children: [
                el('a', 'text-base font-semibold text-base-content', {
                  attrs: { href: 'tel:+441233000000' },
                  text: '01233 000000',
                }),
                el('a', 'text-base font-semibold text-base-content', {
                  attrs: { href: 'mailto:hello@example.com' },
                  text: 'hello@example.com',
                }),
              ],
            }),
            actions([
              primaryAction('Get directions'),
              secondaryAction('Call us', 'tel:+441233000000'),
            ]),
          ],
        }),
      ],
    }),
  ]);
}

/** Several branches — each with its own address, hours line and phone number. */
export function locationCards(): Node {
  const place = (name: string, line1: string, line2: string, hours: string, tel: string): Node =>
    card(CARD, [
      cardTitle(name),
      el('address', 'flex flex-col gap-1 text-base not-italic text-base-content', {
        children: [el('span', '', { text: line1 }), el('span', '', { text: line2 })],
      }),
      body(hours),
      el('a', 'text-base font-semibold text-base-content', {
        attrs: { href: `tel:${tel.replace(/\s/g, '')}` },
        text: tel,
      }),
    ]);
  return sectionAlt([
    sectionHead('Where to find us'),
    gridThree([
      place(
        'Ashford',
        'The Old Mill, Mill Lane',
        'TN23 1QX',
        'Mon–Fri 8–5, Sat 9–1',
        '01233 000000'
      ),
      place('Canterbury', '14 Northgate', 'CT1 1BA', 'Mon–Sat 9–5', '01227 000000'),
      place('Maidstone', 'Unit 6, Wharf Road', 'ME15 6RT', 'Mon–Fri 8–5', '01622 000000'),
    ]),
  ]);
}

/** A service-area statement — for a business that travels rather than one you visit.
 *  The list is plain text on purpose: a map image of a coverage area is a picture
 *  nobody can search and a screen reader cannot read. */
export function serviceArea(): Node {
  return section([
    sectionHead(
      'Where we work',
      'We cover these towns as standard. Further afield, ask — we often can.'
    ),
    el('ul', 'grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4', {
      children: [
        'Ashford',
        'Canterbury',
        'Faversham',
        'Folkestone',
        'Maidstone',
        'Sittingbourne',
        'Tenterden',
        'Whitstable',
      ].map((town) =>
        el('li', 'rounded-box border border-base-300 px-4 py-3 text-base text-base-content', {
          text: town,
        })
      ),
    }),
    caption('Outside these? Call us — a longer trip is usually still worth it for a bigger job.'),
  ]);
}

/** A menu or price list — a restaurant's dishes, a salon's treatments, a garage's
 *  fixed-price jobs. One list, priced, with the description doing the selling. */
export function priceList(): Node {
  const item = (name: string, description: string, price: string): Node =>
    el(
      'li',
      'flex flex-col gap-2 border-t border-base-300 py-5 @2xl:flex-row @2xl:items-baseline @2xl:justify-between @2xl:gap-8',
      {
        children: [
          el('div', 'flex flex-col gap-1', {
            children: [
              el('h3', 'text-lg font-semibold text-base-content', { text: name }),
              el('p', 'text-base text-base-content', { text: description }),
            ],
          }),
          el('p', 'text-lg font-semibold text-base-content', { text: price }),
        ],
      }
    );
  return section([
    sectionHead('What we charge', 'Fixed prices, published. No "from", no "call for a price".'),
    el('ul', 'flex flex-col', {
      children: [
        item(
          'Measure and quote',
          'A visit, full measurements, and a written itemised price.',
          'Free'
        ),
        item(
          'Single door, made and hung',
          'Solid oak, finished, fitted, old one taken away.',
          '$420'
        ),
        item(
          'Fitted wardrobe, per metre',
          'Made to your ceiling height, painted to your color.',
          '$680'
        ),
        item(
          'Kitchen, small',
          'Up to eight units, worktop included, three weeks on site.',
          'From $9,400'
        ),
      ],
    }),
    caption('Prices include VAT and delivery within 50 miles.'),
  ]);
}

/** A menu grouped into courses — the restaurant shape, where the grouping is the
 *  whole navigation. */
export function menuSections(): Node {
  const dish = (name: string, description: string, price: string): Node =>
    el('li', 'flex items-baseline justify-between gap-6 border-t border-base-300 py-4', {
      children: [
        el('div', 'flex flex-col gap-1', {
          children: [
            el('p', 'text-base font-semibold text-base-content', { text: name }),
            el('p', 'text-base text-base-content', { text: description }),
          ],
        }),
        el('p', 'text-base font-semibold text-base-content', { text: price }),
      ],
    });
  const course = (title: string, dishes: Node[]): Node =>
    el('div', 'flex flex-col gap-2', {
      children: [
        el('h3', 'text-2xl font-semibold text-base-content', { text: title }),
        el('ul', 'flex flex-col', { children: dishes }),
      ],
    });
  return sectionAlt([
    sectionHead('Today’s menu', 'Written every morning. If it is on here, we have it.'),
    el('div', 'grid grid-cols-1 gap-10 @3xl:grid-cols-2', {
      children: [
        course('To start', [
          dish('Soda bread and cultured butter', 'Baked at six this morning', '$5'),
          dish('Smoked mackerel', 'Beetroot, horseradish, dill', '$9'),
          dish('Roast squash', 'Sage, hazelnut, aged cheese', '$8'),
        ]),
        course('Mains', [
          dish('Braised shin of beef', 'Mash, greens, red wine', '$22'),
          dish('Whole plaice', 'Brown butter, capers, new potatoes', '$24'),
          dish('Barley and root vegetables', 'Slow-cooked, herb oil', '$17'),
        ]),
      ],
    }),
    caption('Please tell us about any allergies — everything is cooked to order.'),
  ]);
}
