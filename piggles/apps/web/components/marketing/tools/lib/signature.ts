/**
 * Email signature markup.
 *
 * ── WHY THIS IS WRITTEN LIKE IT IS 2003 ─────────────────────────────────────
 *
 * Tables for layout, styling on every element, no classes, no flexbox, no grid.
 * That is not neglect — it is the only thing that survives.
 *
 * Outlook on Windows renders email using Microsoft Word's layout engine, which
 * has no meaningful support for modern CSS. Gmail strips `<style>` blocks
 * entirely, so any rule not written on the element it applies to is discarded on
 * paste. Between them they cover most business email, and the result is that a
 * signature built the way the rest of this codebase builds UI arrives as a
 * vertical stack of unstyled text.
 *
 * So this file breaks the house style deliberately and completely, and it is the
 * one place in Piggles where that is correct. It is also why the output is a
 * STRING rather than a React component: it has to be copied to a clipboard as
 * markup and pasted into somebody else's application, where none of our CSS
 * exists.
 */

export type SignatureLayout = 'stacked' | 'beside' | 'minimal';

export const SIGNATURE_LAYOUTS: { value: SignatureLayout; label: string; blurb: string }[] = [
  {
    value: 'stacked',
    label: 'Stacked',
    blurb:
      'Name, then role, then contact details, straight down. Narrow enough to read on a phone.',
  },
  {
    value: 'beside',
    label: 'Photo beside',
    blurb:
      'Your photo or logo on the left with the details to the right, divided by a colored rule.',
  },
  {
    value: 'minimal',
    label: 'Two lines',
    blurb: 'Name and role on one line, contact on the next. The most likely to still be read.',
  },
];

export interface SignatureInput {
  name: string;
  jobTitle: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  /** A full web address to an image. A file on your computer will not survive
   *  being sent, which is the single most common way a signature breaks. */
  imageUrl: string;
  accent: string;
  layout: SignatureLayout;
  /** A one-line closer — "Book a table", "Open Tuesday to Saturday". */
  tagline: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const withProtocol = (url: string): string => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/** Ordinary faces every mail client has. A web font does not load in most of
 *  them, and the fallback is whatever the client feels like — usually Times. */
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";
const INK = '#202631';
const QUIET = '#4B5563';

export function buildSignature(input: SignatureInput): string {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(input.accent) ? input.accent : '#FF6F86';

  const link = (href: string, text: string, color = accent) =>
    `<a href="${escapeHtml(href)}" style="color:${color};text-decoration:none;">${escapeHtml(text)}</a>`;

  const name = input.name
    ? `<div style="font-family:${FONT};font-size:16px;font-weight:700;color:${INK};line-height:1.3;">${escapeHtml(input.name)}</div>`
    : '';

  const role = [input.jobTitle, input.company].filter(Boolean).join(' · ');
  const roleLine = role
    ? `<div style="font-family:${FONT};font-size:13px;color:${QUIET};line-height:1.5;padding-top:2px;">${escapeHtml(role)}</div>`
    : '';

  const contactBits: string[] = [];
  if (input.phone) contactBits.push(link(`tel:${input.phone.replace(/[^\d+]/g, '')}`, input.phone));
  if (input.email) contactBits.push(link(`mailto:${input.email}`, input.email));
  if (input.website) {
    contactBits.push(link(withProtocol(input.website), input.website.replace(/^https?:\/\//i, '')));
  }

  // A middle dot separator rather than a pipe: it survives every encoding, and a
  // pipe reads as a table border in clients that add their own rules.
  const contactLine = contactBits.length
    ? `<div style="font-family:${FONT};font-size:13px;color:${QUIET};line-height:1.6;padding-top:6px;">${contactBits.join('<span style="color:#9CA3AF;"> &middot; </span>')}</div>`
    : '';

  const tagline = input.tagline
    ? `<div style="font-family:${FONT};font-size:12px;color:${QUIET};line-height:1.5;padding-top:8px;">${escapeHtml(input.tagline)}</div>`
    : '';

  const details = `${name}${roleLine}${contactLine}${tagline}`;

  if (input.layout === 'minimal') {
    const head = [input.name, role].filter(Boolean).join(' — ');
    return trim(`
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr><td style="font-family:${FONT};font-size:14px;font-weight:700;color:${INK};padding:0 0 4px 0;">${escapeHtml(head)}</td></tr>
  <tr><td style="padding:0;">${contactLine}</td></tr>
</table>`);
  }

  if (input.layout === 'beside' && input.imageUrl) {
    return trim(`
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  <tr>
    <td style="vertical-align:top;padding:0 16px 0 0;">
      <img src="${escapeHtml(withProtocol(input.imageUrl))}" alt="${escapeHtml(input.name || input.company)}" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:12px;object-fit:cover;border:0;">
    </td>
    <td style="vertical-align:top;border-left:3px solid ${accent};padding:0 0 0 16px;">
      ${details}
    </td>
  </tr>
</table>`);
  }

  const image = input.imageUrl
    ? `<tr><td style="padding:0 0 10px 0;"><img src="${escapeHtml(withProtocol(input.imageUrl))}" alt="${escapeHtml(input.name || input.company)}" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:12px;object-fit:cover;border:0;"></td></tr>`
    : '';

  return trim(`
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
  ${image}
  <tr><td style="border-top:3px solid ${accent};padding:10px 0 0 0;">${details}</td></tr>
</table>`);
}

/** The plain-text version, for mail clients set to send plain text — and for the
 *  clipboard's text/plain half, so pasting somewhere unexpected produces
 *  something readable rather than a wall of markup. */
export function signaturePlainText(input: SignatureInput): string {
  const role = [input.jobTitle, input.company].filter(Boolean).join(' · ');
  return [input.name, role, input.phone, input.email, input.website, input.tagline]
    .filter(Boolean)
    .join('\n');
}

const trim = (html: string): string =>
  html
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

/** The things that break a signature, checked before somebody pastes it into
 *  Gmail and sends four hundred of them. */
export function signatureWarnings(input: SignatureInput): string[] {
  const warnings: string[] = [];

  if (input.imageUrl && !/^https?:\/\//i.test(input.imageUrl) && !input.imageUrl.includes('.')) {
    warnings.push(
      'That image address does not look like a web address. An image has to live somewhere on the internet — a file on your computer disappears the moment the email leaves it.'
    );
  }
  if (/^file:|^[a-z]:\\|^\//i.test(input.imageUrl)) {
    warnings.push(
      'That is a file on your own computer. Everybody who receives your email will see a broken image. Upload it to your website first and use the address it gets.'
    );
  }
  if (input.imageUrl.startsWith('http://')) {
    warnings.push(
      'That image address is not secure (http rather than https). Some mail clients refuse to load those, so the picture would simply not appear.'
    );
  }
  if (!input.email && !input.phone) {
    warnings.push('There is no way to reach you in this signature, which rather defeats it.');
  }
  const lines = [input.name, input.jobTitle, input.company, input.tagline].filter(Boolean).length;
  if (lines >= 4 && input.tagline.length > 60) {
    warnings.push(
      'This is getting long. Four lines is about where people stop reading a signature, and every reply in a thread carries the whole thing again.'
    );
  }
  return warnings;
}
