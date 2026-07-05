// Site forms — the ContactForm block contract (docs/115).
//
// ContactForm is a WIRED interactive leaf (the `Signup` island's richer sibling):
// a self-contained contact/lead form that renders identically on the live site and
// the editor canvas, and — only on the live site, via the injected runtime — POSTs
// to the public submit endpoint. Config lives in `props`; the FIELDS are a fixed,
// well-designed contact set (Name, Email, optional Phone, Message) toggled by a
// couple of booleans, because the block's real job is routing the submission
// (email / autoresponder / CRM), not building arbitrary forms.
//
// SECURITY — one prop is sensitive: `recipients` (the notify addresses). It is
// authored in the inspector and lives in the DRAFT tree (dashboard-only), but is
// EXTRACTED into a FormDefinition row and STRIPPED at publish so it never reaches
// the client-delivered published tree. `CONTACT_FORM_SECRET_PROPS` is the single
// source of truth for that strip, shared by the publish extractor. Everything
// else here (toggles, copy) is non-sensitive and safe to ship in the tree.
//
// Zod-only, no DB / no React — shared by the catalog, the render island, the
// publish-time extractor, and the submit endpoint.

/** The node `type` of a wired contact form. */
export const CONTACT_FORM_TYPE = 'ContactForm' as const;

/** Props that carry routing SECRETS — extracted to FormDefinition and removed
 *  from the published tree at publish time so they never reach a visitor. Keep in
 *  sync with the FormDefinition columns. */
export const CONTACT_FORM_SECRET_PROPS = ['recipients'] as const;

/** The normalized, defaulted config the island + endpoint read. */
export interface ContactFormConfig {
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  messagePlaceholder: string;
  /** Focus-accent + button color slot (a theme color role). */
  color: string;
  /** Render the optional Phone field. */
  showPhone: boolean;
  /** Require the Message field (Name + Email are always required). */
  messageRequired: boolean;
  /** Email the site owner / configured recipients on submit. */
  notify: boolean;
  /** Mirror the submitter into the CRM as a prospect (needs the `crm` module). */
  addToCrm: boolean;
  /** Send the submitter a confirmation reply. */
  autoresponder: boolean;
  /** Autoresponder subject + body (non-sensitive marketing copy). */
  autoresponderSubject: string;
  autoresponderMessage: string;
  /** SENSITIVE — the notify addresses. Present only in the DRAFT tree; stripped
   *  from the published tree. Empty ⇒ the endpoint falls back to the tenant's
   *  account email. */
  recipients: string[];
}

/** The catalog/default authoring props for a fresh ContactForm block. */
export const DEFAULT_CONTACT_FORM_PROPS: Record<string, unknown> = {
  title: 'Get in touch',
  description: "Send us a note and we'll reply within one business day.",
  submitLabel: 'Send message',
  successMessage: 'Thanks — we got your message and will be in touch soon.',
  color: 'primary',
  showPhone: false,
  messageRequired: true,
  notify: true,
  addToCrm: false,
  autoresponder: false,
  autoresponderSubject: 'We received your message',
  autoresponderMessage:
    "Thanks for reaching out — we've received your message and will get back to you shortly.",
  recipients: [],
};

const asBool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);
const asStr = (v: unknown, dflt: string): string =>
  typeof v === 'string' && v.trim() !== '' ? v : dflt;

/** Read + normalize a ContactForm node's props into a fully-defaulted config.
 *  Tolerant of `unknown` prop values (the tree is untrusted at read time). */
export function readContactFormConfig(
  props: Record<string, unknown> | undefined
): ContactFormConfig {
  const p = props ?? {};
  return {
    title: asStr(p.title, 'Get in touch'),
    description: asStr(p.description, "Send us a note and we'll reply within one business day."),
    submitLabel: asStr(p.submitLabel, 'Send message'),
    successMessage: asStr(
      p.successMessage,
      'Thanks — we got your message and will be in touch soon.'
    ),
    namePlaceholder: asStr(p.namePlaceholder, 'Jordan Avery'),
    emailPlaceholder: asStr(p.emailPlaceholder, 'you@example.com'),
    phonePlaceholder: asStr(p.phonePlaceholder, '(555) 123-4567'),
    messagePlaceholder: asStr(p.messagePlaceholder, 'How can we help?'),
    color: asStr(p.color, 'primary'),
    showPhone: asBool(p.showPhone, false),
    messageRequired: asBool(p.messageRequired, true),
    notify: asBool(p.notify, true),
    addToCrm: asBool(p.addToCrm, false),
    autoresponder: asBool(p.autoresponder, false),
    autoresponderSubject: asStr(p.autoresponderSubject, 'We received your message'),
    autoresponderMessage: asStr(
      p.autoresponderMessage,
      "Thanks for reaching out — we've received your message and will get back to you shortly."
    ),
    recipients: Array.isArray(p.recipients)
      ? p.recipients.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
      : [],
  };
}

/** One rendered field descriptor. `key` is the posted field name. */
export interface ContactFormField {
  key: 'name' | 'email' | 'phone' | 'message';
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea';
  required: boolean;
  placeholder: string;
  autoComplete?: string;
}

/** The ordered fields a ContactForm renders, derived from its config. */
export function contactFormFields(cfg: ContactFormConfig): ContactFormField[] {
  const fields: ContactFormField[] = [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      placeholder: cfg.namePlaceholder,
      autoComplete: 'name',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: cfg.emailPlaceholder,
      autoComplete: 'email',
    },
  ];
  if (cfg.showPhone) {
    fields.push({
      key: 'phone',
      label: 'Phone',
      type: 'tel',
      required: false,
      placeholder: cfg.phonePlaceholder,
      autoComplete: 'tel',
    });
  }
  fields.push({
    key: 'message',
    label: 'Message',
    type: 'textarea',
    required: cfg.messageRequired,
    placeholder: cfg.messagePlaceholder,
  });
  return fields;
}
