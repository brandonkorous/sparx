// Site forms — the Form block contract (docs/115).
//
// A ContactForm is a WIRED interactive CONTAINER (a leaf that accepts children, the
// Button/NavItem pattern): it renders a real `<form>` wrapping its Builder CHILDREN
// — the fields are ordinary named input atoms (Input / Textarea / Select / Checkbox
// / …) the author drops in, styled + reordered with the normal builder, NOT a
// hardcoded field list. On the live site the injected runtime's `submitForm` collects
// the form's named controls (`new FormData`) and POSTs them; the editor canvas
// no-ops it. The block's own job is routing the submission (email / autoresponder /
// CRM) — resolved server-side from `props` — plus a guaranteed submit button. This
// `props` config carries ONLY that form-level chrome + routing; the fields, heading,
// and helper copy are children.
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

/** The node `type` of a wired form. */
import { isQuiz, readQuizScoring, type QuizScoring } from './quiz';

export const CONTACT_FORM_TYPE = 'ContactForm' as const;

/** Props that carry routing SECRETS — extracted to FormDefinition and removed
 *  from the published tree at publish time so they never reach a visitor. Keep in
 *  sync with the FormDefinition columns. */
// `scoring` is here for a DIFFERENT reason to `recipients` and both are real.
// Recipients are private data about the tenant. The quiz weights are private
// data about the tenant's JUDGEMENT: shipped in the published tree, a visitor
// could read exactly which answers are worth what and score themselves however
// they liked, and the "hot lead" the sales team is handed would be somebody who
// read the source. Stripped at publish, held server-side, read only there.
export const CONTACT_FORM_SECRET_PROPS = ['recipients', 'scoring', 'delivery'] as const;

/** The normalized, defaulted form-level config the island + endpoint read. The
 *  fields, heading, and helper copy are CHILDREN, not config — this is only the
 *  submit button, the thank-you swap, and the server-side routing. */
export interface ContactFormConfig {
  /** The form's own guaranteed submit button label. */
  submitLabel: string;
  /** Message shown in place of the form after a successful submit. */
  successMessage: string;
  /** Submit-button color slot (a theme color role). */
  color: string;
  /** Email the site owner / configured recipients on submit. */
  notify: boolean;
  /** Mirror the submitter into the CRM as a prospect (needs the `crm` module). */
  addToCrm: boolean;
  /** Open a sales deal for the submitter in the default pipeline (needs the `crm`
   *  module). Implies capturing the contact — a deal needs someone to attach to.
   *  This is what turns a plain contact form into a quote/lead-request form. */
  openDeal: boolean;
  /** Open a SUPPORT REQUEST for the submitter, with a reply deadline attached
   *  (needs the `crm` module). Implies capturing the contact, same as a deal.
   *  This is what turns a plain contact form into a help/support form.
   *
   *  Deliberately separate from `openDeal` rather than a one-of: they are
   *  different jobs — a deal is money you hope to make, a request is an answer
   *  you already owe — and a form can legitimately be both (an existing customer
   *  asking about an upgrade). Both default off, so no existing form starts
   *  behaving differently after this shipped. */
  openRequest: boolean;
  /** Quiz / calculator weights, if this form scores anything (docs/152 C3).
   *  Authored here, persisted to `FormDefinition.config` and read back from
   *  THERE at submit time — the published tree's copy is never trusted. */
  scoring: unknown;
  /** Send the submitter a confirmation reply. */
  autoresponder: boolean;
  /** Autoresponder subject + body (non-sensitive copy). */
  autoresponderSubject: string;
  autoresponderMessage: string;
  /** SENSITIVE — the notify addresses. Present only in the DRAFT tree; stripped
   *  from the published tree. Empty ⇒ the endpoint falls back to the tenant's
   *  account email. */
  recipients: string[];
}

/** The catalog/default authoring props for a fresh Form block. */
export const DEFAULT_CONTACT_FORM_PROPS: Record<string, unknown> = {
  submitLabel: 'Send message',
  successMessage: 'Thanks — we got your message and will be in touch soon.',
  color: 'primary',
  notify: true,
  addToCrm: false,
  openDeal: false,
  openRequest: false,
  autoresponder: false,
  autoresponderSubject: 'We received your message',
  autoresponderMessage:
    "Thanks for reaching out — we've received your message and will get back to you shortly.",
  recipients: [],
};

const asBool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);
const asStr = (v: unknown, dflt: string): string =>
  typeof v === 'string' && v.trim() !== '' ? v : dflt;

// ── File attachments (docs/115 Part D) ───────────────────────────────────────
//
// A public visitor can attach files (a resume, an RFQ, a spec sheet) to a Form.
// The upload is a proxied two-phase flow (a signed token → PUT the bytes to
// api-rest, which magic-sniffs them → stored in the PRIVATE bucket), mirroring the
// media upload path. These constants are the SHARED policy: the friendly
// client-side pre-check (island), the server allowlist (upload endpoint), and the
// inbox all read them, so the bound lives in one place. The server NEVER trusts the
// client's declared type — the api-rest PUT sniffs the actual bytes — this is only
// for a fast, honest pre-check and to keep the two sides in sync.

/** Allowed attachment MIME → canonical extension. Documents + images: the realistic
 *  set for quote / contact / careers forms. Office types are OOXML (ZIP) containers
 *  sniffed for their part markers server-side. */
export const FORM_ATTACHMENT_MIME: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

/** Per-file byte cap. Bounds the public upload endpoint against huge-object abuse.
 *  Typed `number` (not the literal) so consumers can compare/pluralize freely. */
export const MAX_FORM_ATTACHMENT_BYTES: number = 10 * 1024 * 1024;

/** Max attachments per submission — a small bound; a form is not a file drop. */
export const MAX_FORM_ATTACHMENTS = 3;

/** Whether a declared MIME is in the attachment allowlist (client pre-check +
 *  server presign gate; the PUT still sniffs the bytes). */
export function isAllowedAttachmentMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(FORM_ATTACHMENT_MIME, mime);
}

/** A stored form-submission attachment — the durable ref persisted on the row and
 *  echoed to the inbox. Bytes live in the PRIVATE bucket at `key`; there is never a
 *  public URL — staff download through an authenticated, RLS-scoped route. */
export interface FormAttachment {
  /** Private-bucket object key (`form-uploads/attached/…`). */
  key: string;
  /** Original filename the visitor uploaded — display only, already sanitized. */
  filename: string;
  /** The sniff-verified content type. */
  mimeType: string;
  /** Byte size of the stored object. */
  byteSize: number;
}

/** Read + normalize a Form node's props into a fully-defaulted config. Tolerant of
 *  `unknown` prop values (the tree is untrusted at read time). */
export function readContactFormConfig(
  props: Record<string, unknown> | undefined
): ContactFormConfig {
  const p = props ?? {};
  return {
    submitLabel: asStr(p.submitLabel, 'Send message'),
    successMessage: asStr(
      p.successMessage,
      'Thanks — we got your message and will be in touch soon.'
    ),
    color: asStr(p.color, 'primary'),
    notify: asBool(p.notify, true),
    addToCrm: asBool(p.addToCrm, false),
    openDeal: asBool(p.openDeal, false),
    openRequest: asBool(p.openRequest, false),
    autoresponder: asBool(p.autoresponder, false),
    autoresponderSubject: asStr(p.autoresponderSubject, 'We received your message'),
    autoresponderMessage: asStr(
      p.autoresponderMessage,
      "Thanks for reaching out — we've received your message and will get back to you shortly."
    ),
    recipients: Array.isArray(p.recipients)
      ? p.recipients.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
      : [],
    // Carried through verbatim and normalized only where it is READ, so a
    // config authored against a later shape is not flattened on the way past.
    scoring: p.scoring ?? null,
  };
}

/** The non-sensitive ROUTING subset persisted to `FormDefinition.config` at
 *  publish, so the automation worker can route a submission (notify / autoresponder
 *  / CRM) WITHOUT reading the published Builder tree (which it has no access to).
 *  The sensitive recipient addresses live in their own `recipients` column, never
 *  here. Kept as one extractor so the publish-time write and the resolver read agree
 *  on the shape. */
export interface FormRoutingConfig {
  notify: boolean;
  addToCrm: boolean;
  openDeal: boolean;
  openRequest: boolean;
  autoresponder: boolean;
  autoresponderSubject: string;
  autoresponderMessage: string;
  /** Quiz / calculator weights (docs/152 C3). Server-only for the same reason
   *  the recipient addresses are: a quiz that decides somebody is a strong lead
   *  cannot let that somebody edit the arithmetic. Null on an ordinary form. */
  scoring: QuizScoring | null;
}

/** Extract the routing subset persisted to FormDefinition.config from a full config. */
export function formRoutingConfig(cfg: ContactFormConfig): FormRoutingConfig {
  const scoring = readQuizScoring(cfg.scoring);
  return {
    notify: cfg.notify,
    addToCrm: cfg.addToCrm,
    openDeal: cfg.openDeal,
    openRequest: cfg.openRequest,
    autoresponder: cfg.autoresponder,
    autoresponderSubject: cfg.autoresponderSubject,
    autoresponderMessage: cfg.autoresponderMessage,
    scoring: isQuiz(scoring) ? scoring : null,
  };
}
