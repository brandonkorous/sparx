// Getting in touch — the bands that ask for something, and the reassurance around them.
//
// The gap these close: the shelf had one centred CTA band. A site needs several
// different asks — a quote request with real fields, a callback with two, a newsletter
// sign-up, a booking prompt — and they are not interchangeable. Asking for a phone
// number to send a newsletter loses the sign-up; asking for an email address to quote
// a kitchen loses the job.
//
// EVERY FORM HERE IS A REAL `<form>` with the `form` behavior, routed to a host action
// the storefront actually listens for — the three that carry a message reach the
// tenant's Form submissions inbox, the sign-up reaches the email list.
//
// That sentence used to be here as an ASSERTION and it was false for as long as it
// stood: the shared `form()` helper shipped the ref `'submit'`, which the storefront
// routes nowhere, so every one of these forms swallowed every enquiry sent through it
// and settled to `success` anyway (issue 350). An unroutable ref is not an error
// anywhere in the chain, which is why a comment could go on claiming the opposite. The
// helper takes the destination as an argument now and a test sweeps the whole library
// for a form that reaches nothing.
//
// Every field is LABELLED, because a placeholder disappears the moment someone types
// and a form whose labels vanish is a form people abandon. And every form carries a
// VISIBLE status line, because the behavior's default one is a 1x1px clipped live
// region that tells a sighted visitor nothing (issue 351).

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

/** Where a submitted form is delivered. The `form` behavior does the whole client
 *  half and then hands this ref to the host's `onAction`; the host is a chain of
 *  `if (ref === …)` branches, and **a ref it does not recognise is not an error** — the
 *  handler simply returns, the promise resolves, and the behavior settles the form to
 *  `success`. So a wrong ref does not fail loudly: it discards the message and thanks
 *  the visitor for it (issue 350, where every form in this file shipped `'submit'`).
 *
 *  `contact` reaches the Form submissions inbox; `email-signup` adds the address to the
 *  email list. Routed in `apps/site/components/silica-behaviors.tsx`, and `contact` is
 *  the contract named by `@wizeworks/builder-schemas`' `SILICA_FORM_ACTION` — spelled
 *  out rather than imported because this package sits UNDER both of them. */
type FormAction = 'contact' | 'email-signup';

/** The line under the button that tells the visitor what happened.
 *
 *  The `form` behavior settles every submit into its `status` part, and a form that
 *  authors none gets one BUILT for it: a 1x1px `clip-path: inset(50%)` live region,
 *  announced to a screen reader and rendered to literally nobody else. So a sighted
 *  visitor pressed Send, watched the button depress, saw their own text still sitting
 *  in the boxes, and had no way to tell a delivered message from a lost one — which is
 *  how one enquiry becomes three (issue 351). The buy box hit the same thing and fixed
 *  it the same way (`buyStatus` in `commerce.ts`).
 *
 *  `empty:hidden` keeps it out of the form's `gap-5` at rest: the behavior writes
 *  `textContent`, so before a submit the element is `:empty`.
 *
 *  ONE element carries both outcomes, so the WORDS have to do the distinguishing — the
 *  behavior writes success and failure into the same node, and there is no
 *  state-conditional class to author (nothing in silicaui emits CSS for
 *  `data-sui-state`, and an arbitrary-value variant is exactly what the vocabulary
 *  check bans). Hence a specific, concrete success sentence per form rather than the
 *  built-in "Submitted."
 *
 *  Authored through `attrs` rather than `part()` because silicaui's `BehaviorRole`
 *  union does not list `status`; the runtime reads the attribute by name. */
function formStatus(): Node {
  return el('p', 'text-base text-base-content empty:hidden', {
    attrs: { 'data-sui-part': 'status', 'aria-live': 'polite' },
  });
}

/** Wrap a set of fields in a submitting form. */
function form(
  children: Node[],
  submitLabel: string,
  success: string,
  to: FormAction = 'contact'
): Node {
  return action(
    behave(
      el('form', 'flex flex-col gap-5', {
        attrs: { 'data-success-message': success },
        children: [
          ...children,
          el('button', 'btn btn-primary btn-lg', { attrs: { type: 'submit' }, text: submitLabel }),
          formStatus(),
        ],
      }),
      { type: 'form' }
    ),
    to
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
            //
            // `text-base`, not `text-sm`. This slot is the OTHER WAY TO REACH THE
            // BUSINESS, sitting beside the form — and whatever an owner rewrites it
            // to, it stays that. One rewrote it to her studio address and opening
            // hours, which made the only place her site says where to physically go
            // the smallest sentence on the page (issue 342's neighbour, 344). This
            // file's own header sets the floor: `text-sm` is for genuine captions
            // and metadata, and an alternative route to a business is neither.
            boundPhoneLine(
              'text-base text-base-content',
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
          'Send this',
          'Thank you. Your message is with us and we will get back to you.'
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
      form(
        [field('Your name', 'name'), field('Phone number', 'phone', 'tel')],
        'Call me back',
        'Thank you. We have your number and will call you back.'
      ),
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
      form(
        [field('Email address', 'email', 'email')],
        'Sign me up',
        'Thank you. You are on the list.',
        'email-signup'
      ),
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
              'Send my request',
              'Thank you. Your request is with us and your quote will follow.'
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
