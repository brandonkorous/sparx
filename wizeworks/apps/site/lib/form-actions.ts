// The form actions this site answers, and what a form says when it cannot.
//
// A silica <form> names its job in `data-sui-action`, and `SilicaBehaviors` does the
// job. A name it did not know fell through and returned, so the form settled to its
// success state and said "Submitted." while nothing happened. 47 designs ship their
// newsletter sign-up as `subscribe`, a name the site did not know: The Marrow Review's
// readers signed up, read "Submitted.", and never reached her list (persona P09).

import { QUOTE_REQUEST_ACTION } from './quote-request-tree';

/** Every name a newsletter or email-capture form goes by. */
export const SIGNUP_ACTIONS: readonly string[] = [
  'email-signup',
  'newsletter',
  'signup',
  'subscribe',
];

/** Every name a contact form goes by. The same list as builder-schemas'
 *  `CONTACT_FORM_ACTIONS`, which the server checks a submission against; repeated here
 *  because this file runs in the visitor's browser, and a test holds the two equal. */
export const CONTACT_FORM_ACTIONS: readonly string[] = ['contact', 'submit'];

/** Every action `SilicaBehaviors` carries out. A form naming anything else is told so. */
export const HANDLED_ACTIONS: readonly string[] = [
  ...SIGNUP_ACTIONS,
  ...CONTACT_FORM_ACTIONS,
  QUOTE_REQUEST_ACTION,
  'add-to-cart',
  'buy-now',
];

export function isSignupAction(ref: string | null): boolean {
  return ref !== null && SIGNUP_ACTIONS.includes(ref);
}

/** A contact form, under either name (`CONTACT_FORM_ACTIONS`): the designs' Contact
 *  pages say `submit`. */
export function isContactAction(ref: string | null): boolean {
  return ref !== null && CONTACT_FORM_ACTIONS.includes(ref);
}

export function isHandledAction(ref: string | null): boolean {
  return ref !== null && HANDLED_ACTIONS.includes(ref);
}

/** What a reader reads after signing up: the endpoint puts them straight on the list. */
export const SIGNED_UP_MESSAGE = 'Thank you. You are on the list.';

/** What a visitor reads after sending a message, instead of silica's "Submitted.". */
export const MESSAGE_SENT_MESSAGE = 'Thank you. Your message has been sent.';

/** Put the site's thank-you on a form, unless its author wrote one of her own. */
export function thankOnSuccess(form: Element, message: string): void {
  if (!form.hasAttribute('data-success-message'))
    form.setAttribute('data-success-message', message);
}

/** What a form with a job the site cannot do says, instead of a false thank-you. */
export const NOT_CONNECTED_MESSAGE =
  'Sorry, this form is not working yet, so nothing was sent. Please get in touch another way.';
