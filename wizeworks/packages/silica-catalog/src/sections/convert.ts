// Getting in touch — the bands that ask for something, and the reassurance around them.
//
// The gap these close: the shelf had one centred CTA band. A site needs several
// different asks — a quote request with real fields, a callback with two, a newsletter
// sign-up, a booking prompt — and they are not interchangeable. Asking for a phone
// number to send a newsletter loses the sign-up; asking for an email address to quote
// a kitchen loses the job.
//
// EVERY FORM HERE IS A REAL `<form>` with the `form` behaviour, so a submit reaches the
// host's action handler and lands in the tenant's Form submissions inbox — not a
// decorative arrangement of inputs that swallows an enquiry silently. Every field is
// LABELLED, because a placeholder disappears the moment someone types and a form whose
// labels vanish is a form people abandon.

import { action, behave, el, type Node } from '@wizeworks/silicaui-html';

import {
  actions,
  body,
  card,
  cardTitle,
  caption,
  gridThree,
  primaryAction,
  section,
  sectionAlt,
  sectionHead,
  CARD,
} from './_shell';
import { boundContactAction, boundPhoneLine } from './_contact-fields';

/** A labelled text field. The label wraps the control, so the pair needs no `id` —
 *  which matters because two of these blocks on one page would otherwise emit
 *  duplicate ids, and a duplicate id is a finding the pre-publish check reports. */
function field(label: string, name: string, type = 'text', placeholder = ''): Node {
  return el('label', 'flex flex-col gap-2', {
    children: [
      el('span', 'text-base font-medium text-base-content', { text: label }),
      el('input', 'input input-bordered w-full', {
        attrs: { type, name, placeholder, required: true },
      }),
    ],
  });
}

/** A labelled multi-line field. */
function textField(label: string, name: string, placeholder = ''): Node {
  return el('label', 'flex flex-col gap-2', {
    children: [
      el('span', 'text-base font-medium text-base-content', { text: label }),
      el('textarea', 'textarea textarea-bordered min-h-32 w-full', {
        attrs: { name, placeholder },
      }),
    ],
  });
}

/** Wrap a set of fields in a submitting form. */
function form(children: Node[], submitLabel: string): Node {
  return action(
    behave(
      el('form', 'flex flex-col gap-5', {
        children: [
          ...children,
          el('button', 'btn btn-primary btn-lg', { attrs: { type: 'submit' }, text: submitLabel }),
        ],
      }),
      { type: 'form' }
    ),
    'submit'
  );
}

/** The full enquiry form — name, how to reach them, and room to explain. */
export function enquiryForm(): Node {
  return section([
    el('div', 'grid grid-cols-1 gap-10 @3xl:grid-cols-2', {
      children: [
        el('div', 'flex flex-col gap-4', {
          children: [
            el('h2', 'text-3xl font-semibold text-base-content', { text: 'Tell us what you need' }),
            body(
              'A real person reads every one of these and replies, usually the same day. There is no ' +
                'obligation and we will not add you to anything.'
            ),
            // Bound, and gone when there is no phone. As a plain caption this
            // read "Or call (555) 123-4567, Monday to Friday, 8am to 5pm." —
            // an invented number AND invented hours, in prose that looks like
            // the business wrote it (issue 265). The hours had nothing to bind
            // to, so they are not claimed at all.
            boundPhoneLine(
              'text-sm text-base-content',
              'Or call ',
              ' if that is quicker.',
              '(555) 123-4567'
            ),
          ],
        }),
        form(
          [
            field('Your name', 'name'),
            field('Email address', 'email', 'email'),
            field('Phone number', 'phone', 'tel'),
            textField(
              'What are you thinking of?',
              'message',
              'A rough idea is plenty to start with.'
            ),
          ],
          'Send this'
        ),
      ],
    }),
  ]);
}

/** Two fields and a button — the lowest-friction ask on the shelf. Use where a page
 *  has already done the persuading. */
export function callbackForm(): Node {
  return sectionAlt([
    sectionNarrowInner([
      el('h2', 'text-3xl font-semibold text-base-content', { text: 'Ask us to call you' }),
      body('Leave a number and a good time. No sales script, no follow-up if you say no.'),
      form([field('Your name', 'name'), field('Phone number', 'phone', 'tel')], 'Call me back'),
    ]),
  ]);
}

/** The narrow inner column used by the short forms. Inline rather than exported from
 *  the shell because it exists only to keep these two blocks the same width. */
function sectionNarrowInner(children: Node[]): Node {
  return el('div', 'mx-auto flex w-full max-w-xl flex-col gap-5', { children });
}

/** A newsletter sign-up. ONE field, and it says what will actually arrive — the two
 *  things that decide whether anybody types into it. */
export function newsletterSignup(): Node {
  return section([
    sectionNarrowInner([
      el('h2', 'text-3xl font-semibold text-base-content', { text: 'One email a month' }),
      body('What we made, what we learned, and anything we got wrong. Unsubscribe in one click.'),
      form([field('Email address', 'email', 'email')], 'Sign me up'),
      caption('We never pass your address to anyone, and we do not email more than monthly.'),
    ]),
  ]);
}

/** A booking prompt — for a business whose next step is a time in a diary rather than
 *  a conversation. */
export function bookingPrompt(): Node {
  return sectionAlt([
    el('div', 'flex flex-col items-start gap-5', {
      children: [
        el('h2', 'text-3xl font-semibold text-base-content @3xl:text-4xl', {
          text: 'Pick a time that suits you',
        }),
        el('p', 'max-w-2xl text-lg text-base-content', {
          text: 'Choose a slot and it is confirmed straight away. Change or cancel it yourself up to 24 hours before.',
        }),
        actions([
          primaryAction('See available times', '/book'),
          // Bound, never a literal: this shipped `tel:+15551234567`, so a visitor
          // tapping "Call instead" on a phone dialled a stranger (issue 268). The
          // button goes when the business has typed no number.
          boundContactAction('phone', 'btn btn-neutral btn-outline btn-lg', 'Call instead'),
        ]),
      ],
    }),
  ]);
}

/** A quote request with the qualifying questions built in — the form for a business
 *  that needs to know the shape of a job before it can answer at all. */
export function quoteRequest(): Node {
  return section([
    sectionHead(
      'Get a written quote',
      'Four questions, then a fixed price within two working days.'
    ),
    el('div', 'grid grid-cols-1 gap-10 @3xl:grid-cols-3', {
      children: [
        el('div', '@3xl:col-span-2', {
          children: [
            form(
              [
                field('Your name', 'name'),
                field('Email address', 'email', 'email'),
                field('Where is the work?', 'location', 'text', 'Town or ZIP code is enough'),
                textField(
                  'What needs doing?',
                  'message',
                  'Rooms, rough sizes, anything you already know.'
                ),
              ],
              'Send my request'
            ),
          ],
        }),
        el('div', 'flex flex-col gap-6', {
          children: [
            card(CARD, [
              cardTitle('No charge'),
              body('The visit, the measuring and the quote are all free.'),
            ]),
            card(CARD, [
              cardTitle('No pressure'),
              body('The price holds for sixty days. Decide whenever you like.'),
            ]),
          ],
        }),
      ],
    }),
  ]);
}

/** The closing band — a last, plain ask at the bottom of a page. Full-width primary
 *  surface, because it is the one element on the page allowed to shout. */
export function closingCta(): Node {
  return el('section', 'bg-primary text-primary-content @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-6', {
        children: [
          el('h2', 'text-center text-3xl font-semibold @3xl:text-4xl', {
            text: 'Ready when you are',
          }),
          el('p', 'max-w-xl text-center text-lg', {
            text: 'Tell us roughly what you need and we will tell you honestly whether we are the right people for it.',
          }),
          actions([
            el('a', 'btn btn-neutral btn-lg', {
              attrs: { href: '/contact' },
              text: 'Get in touch',
            }),
          ]),
        ],
      }),
    ],
  });
}

/** Three reassurances in a row, for directly above a form. Short enough that they get
 *  read, which is the only thing that matters this close to an ask. */
export function reassuranceRow(): Node {
  return section([
    gridThree([
      card(CARD, [
        cardTitle('Free to ask'),
        body('No charge for a visit, a measure-up or a quote.'),
      ]),
      card(CARD, [cardTitle('Fixed prices'), body('The quote is the invoice. It does not move.')]),
      card(CARD, [cardTitle('Ten-year guarantee'), body('If it fails, we come back and fix it.')]),
    ]),
  ]);
}
