// Site forms on the silica engine (docs/115 + docs/118).
//
// The legacy sparx builder had its OWN `ContactForm` node type, and it carried the
// form's whole routing config in `node.props` — including the notify addresses, which
// then had to be surgically stripped at publish so they never reached a visitor
// (`CONTACT_FORM_SECRET_PROPS`). That strip is the kind of thing that is one refactor
// away from silently leaking.
//
// silica already ships the form. `@wizeworks/silicaui-html/blocks`'s `contactSection`
// lowers to a real `<form>` carrying the `form` BEHAVIOR (native validation, FormData
// collection, busy/success/error states) and the host ACTION ref `contact` — the seam
// silicaui deliberately stops at, leaving the submission target to the host. So sparx
// does not author a form node type at all any more; it implements the seam.
//
// That lets the config move OFF the tree entirely. On silica:
//
//   · the TREE carries only the form + its action ref. No config. No secrets. Nothing
//     to strip at publish, because nothing sensitive was ever in there.
//   · the ROW (`FormDefinition`, keyed `(propertyId, formNodeId)`) carries the whole
//     routing config — recipients AND the toggles — in columns the client never sees.
//   · the published tree's only job at submit time is to answer ONE question: does a
//     form with this id actually exist on this page? That is the anti-forgery check
//     that stops a script POSTing at a tenant who has no form.
//
// Strictly safer than the legacy design, and it needs no migration: `FormDefinition`
// already had a `config Json` column.

import type { SilicaNode } from './site-sync';

/** The host action ref silica's `contactSection` block dispatches on a valid submit
 *  (`Form` component → `props.action`). The storefront's `onAction` routes this ref to
 *  the public submit endpoint; the server checks for it when verifying the node. */
export const SILICA_FORM_ACTION = 'contact' as const;

/** The behavior marker silica lowers a `<form>` to. A node is a live, submittable form
 *  only if it carries BOTH this behavior and the action ref — the behavior alone is
 *  what does the client-side work, the action is what points it at a host. */
export const SILICA_FORM_BEHAVIOR = 'form' as const;

/** The routing config for one silica form. Identical in meaning to the legacy
 *  `ContactFormConfig`, minus the two fields that were only ever about the legacy
 *  node's own chrome (`submitLabel` / `color` — silica's block owns its submit button,
 *  and the author restyles it with the normal builder). `successMessage` stays: the
 *  form behavior swaps to a success state, and this is what it should say.
 *
 *  Stored in `FormDefinition.config` + `.recipients`. NEVER in the tree. */
export interface SilicaFormConfig {
  /** Author label, shown as the form's name in the submissions inbox. On the legacy
   *  engine this was the builder node's `name`; a silica node has no such field, so it
   *  rides in the config with everything else the author sets. Empty ⇒ the inbox falls
   *  back to the page. */
  name: string;
  /** Shown in place of the form after a successful submit. */
  successMessage: string;
  /** Email the configured recipients (or, when empty, the account email) on submit. */
  notify: boolean;
  /** Mirror the submitter into the CRM as a prospect (needs the `crm` module). */
  addToCrm: boolean;
  /** Open a sales deal for the submitter in the default pipeline (needs `crm`).
   *  Implies capturing the contact — a deal needs someone to attach to. */
  openDeal: boolean;
  /** Send the submitter a confirmation reply. */
  autoresponder: boolean;
  autoresponderSubject: string;
  autoresponderMessage: string;
}

export const DEFAULT_SILICA_FORM_CONFIG: SilicaFormConfig = {
  name: '',
  successMessage: 'Thanks — we got your message and will be in touch soon.',
  notify: true,
  addToCrm: false,
  openDeal: false,
  autoresponder: false,
  autoresponderSubject: 'We received your message',
  autoresponderMessage:
    "Thanks for reaching out — we've received your message and will get back to you shortly.",
};

const bool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);
const str = (v: unknown, dflt: string): string =>
  typeof v === 'string' && v.trim() !== '' ? v : dflt;

/** Normalize a stored `FormDefinition.config` blob. Total — a row written by an older
 *  build, or a hand-edited one, still yields a complete config rather than throwing on
 *  the submit path, where there is nowhere to report an error to. */
export function readSilicaFormConfig(raw: unknown): SilicaFormConfig {
  const c = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_SILICA_FORM_CONFIG;
  const addToCrm = bool(c.addToCrm, d.addToCrm);
  const openDeal = bool(c.openDeal, d.openDeal);
  return {
    name: typeof c.name === 'string' ? c.name : d.name,
    successMessage: str(c.successMessage, d.successMessage),
    notify: bool(c.notify, d.notify),
    // A deal needs a contact to hang off, so opening one implies capturing them —
    // enforced here rather than trusted from the stored blob, so a row that says
    // `{openDeal: true, addToCrm: false}` can't produce an orphan deal.
    addToCrm: addToCrm || openDeal,
    openDeal,
    autoresponder: bool(c.autoresponder, d.autoresponder),
    autoresponderSubject: str(c.autoresponderSubject, d.autoresponderSubject),
    autoresponderMessage: str(c.autoresponderMessage, d.autoresponderMessage),
  };
}

/** Is this node a live, submittable form? Both markers must be present: silica's `form`
 *  behavior (the client-side machinery) AND our action ref (the host seam). A form the
 *  author stripped the action off is inert by construction, and must not resolve. */
export function isSilicaFormNode(node: SilicaNode): boolean {
  const n = node as {
    behavior?: { type?: string };
    props?: Record<string, unknown>;
    data?: { kind?: string; ref?: string };
  };
  const hasBehavior = n.behavior?.type === SILICA_FORM_BEHAVIOR;
  // The ref reaches the DOM as `data-sui-action`, and it can arrive either as the
  // `Form` component's `action` prop (how the shipped block authors it) or as an
  // explicit action data-marker (how a hand-composed tree would).
  const hasAction =
    n.props?.action === SILICA_FORM_ACTION ||
    (n.data?.kind === 'action' && n.data.ref === SILICA_FORM_ACTION);
  return hasBehavior && hasAction;
}

/** Find a live form node by id anywhere in a silica tree, or null. Depth-first; the
 *  id is silica's node id, which is what the rendered `<form>` carries as
 *  `data-sui-id` and what the visitor's submit sends back. */
export function findSilicaFormNode(root: SilicaNode, formNodeId: string): SilicaNode | null {
  const node = root as SilicaNode & { id?: string; children?: unknown[] };
  if (node.id === formNodeId) return isSilicaFormNode(root) ? root : null;
  for (const child of node.children ?? []) {
    // A silica container's children are nodes or bare strings (text runs).
    if (!child || typeof child !== 'object') continue;
    const hit = findSilicaFormNode(child as SilicaNode, formNodeId);
    if (hit) return hit;
  }
  return null;
}
