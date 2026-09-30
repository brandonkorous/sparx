// WHAT THE PANEL CALLS THE PERSON SHE IS TALKING TO.
//
// Three states, not two. The panel used to ask one question — does this
// conversation name a customer — so it said "Customer" or "Visitor", and
// nothing on the platform has ever named one: the public widget is the only
// thing that starts a conversation and it passes no customer id. Every repeat
// buyer read "Visitor" (issue 864).
//
// The middle state is the one that needed words. The visitor typed an email
// address and the shop already has it, which is a strong hint and not proof, so
// it must not wear the same badge as a confirmed customer and must say in a
// sentence what actually happened. The sentence is the part that keeps the
// screen honest: it tells her the history below belongs to the customer that
// address matched, so she can decide for herself whether to trust it.
//
// Lives in a `.ts` beside the pane because a `.tsx` cannot be imported by
// vitest in this app (`jsx: preserve`), and these words are worth a test.

import type { CustomerMatch } from './data';

/** How a badge is drawn: the color prop, or null for a colorless badge. */
export interface WhoBadge {
  label: string;
  /** A silica color, or null to pass NO `color` prop at all. A colorless badge
   *  resolves its own readable ink and is the right control for a state that
   *  carries no meaning to color — which "we do not know who this is" is. */
  color: 'module' | 'info' | null;
  variant: 'soft' | 'outline';
}

export function whoBadge(match: CustomerMatch): WhoBadge {
  switch (match) {
    case 'record':
      // Somebody this shop knows, confirmed. Wears the module hue because it is
      // the CRM's own fact showing up inside Messages.
      return { label: 'Customer', color: 'module', variant: 'soft' };
    case 'email':
      // A weaker version of the same claim, so a weaker version of the same
      // treatment: still colored, still soft, not the module's own hue.
      return { label: 'Possible customer', color: 'info', variant: 'soft' };
    case 'none':
      return { label: 'Visitor', color: null, variant: 'outline' };
  }
}

/**
 * The sentence under the badge, or null when there is nothing to explain.
 *
 * Only the email match needs one. `headerName` is what the panel already shows
 * as the heading (the name the visitor gave); `customerName` is the address
 * book's name for whoever the email matched. When those are the same person by
 * name there is no second name worth printing, so the shorter sentence is used.
 */
export function whoNote(
  match: CustomerMatch,
  headerName: string,
  customerName: string | null
): string | null {
  if (match !== 'email') return null;
  const same =
    customerName !== null && customerName.trim().toLowerCase() === headerName.trim().toLowerCase();
  if (customerName === null || customerName.trim() === '' || same) {
    return 'They gave an email address you already have, so the history below is theirs.';
  }
  return `They gave an email address you already have for ${customerName}, so the history below is that customer’s.`;
}

/** Whether there is a customer worth showing a spend history for. */
export function hasHistory(match: CustomerMatch): boolean {
  return match !== 'none';
}
