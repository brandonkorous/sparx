/**
 * vCard 3.0 — the contact file every phone, mail app and address book reads.
 *
 * Version 3.0 rather than 4.0 deliberately. 4.0 is a decade old, tidier, and
 * still not understood by parts of the Apple and Android contact stacks, which
 * quietly import a 4.0 card with fields missing. 3.0 is understood everywhere
 * and the difference matters to nobody except the person whose job title
 * vanished.
 *
 * ── THE ESCAPING IS THE WHOLE JOB ───────────────────────────────────────────
 *
 * Commas and semicolons are structure in this format. A company called "Bell,
 * Book & Candle" splits into two fields unless the comma is escaped, and the
 * result is a contact whose company is "Bell" — which imports without complaint
 * and is simply wrong.
 */

export interface VCardInput {
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  street: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  note: string;
}

const escape = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

/**
 * Fold lines at 75 characters, as the specification requires.
 *
 * A continued line begins with a single space. Strict parsers reject a long
 * unfolded line outright, and — much more commonly — a note or a long web
 * address silently loses everything past the limit. The folding is done on
 * characters rather than bytes, which is very slightly wrong for non-ASCII and
 * wrong in the safe direction: the lines come out shorter, never longer.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

export function buildVCard(input: VCardInput): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  // N is the structured name and is what most address books sort by; FN is what
  // gets displayed. Both are required, and a card with only one of them imports
  // as a contact with no name in at least one popular mail client.
  lines.push(`N:${escape(input.lastName)};${escape(input.firstName)};;;`);
  const full = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  lines.push(`FN:${escape(full || input.company || 'Contact')}`);

  if (input.company) lines.push(`ORG:${escape(input.company)}`);
  if (input.jobTitle) lines.push(`TITLE:${escape(input.jobTitle)}`);
  if (input.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${escape(input.email)}`);
  if (input.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escape(input.phone)}`);
  if (input.mobile) lines.push(`TEL;TYPE=CELL,VOICE:${escape(input.mobile)}`);
  if (input.website) {
    const url = /^https?:\/\//i.test(input.website) ? input.website : `https://${input.website}`;
    lines.push(`URL:${escape(url)}`);
  }

  const address = [input.street, input.city, input.region, input.postcode, input.country];
  if (address.some(Boolean)) {
    // ADR has seven fields: post office box, extended address, street, locality,
    // region, postal code, country. The first two are left empty, which is
    // normal, and the semicolons still have to be there.
    lines.push(
      `ADR;TYPE=WORK:;;${escape(input.street)};${escape(input.city)};${escape(input.region)};${escape(input.postcode)};${escape(input.country)}`
    );
  }

  if (input.note) lines.push(`NOTE:${escape(input.note)}`);

  lines.push('END:VCARD');

  // CRLF between lines, not LF. Several parsers — including some versions of
  // Outlook — refuse a card with Unix line endings, which is an unhelpfully
  // pedantic thing to be right about and is nevertheless what happens.
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Is there enough here to be worth saving? A card with nothing but a name is
 *  technically valid and practically useless. */
export function vCardIsUsable(input: VCardInput): boolean {
  const hasName = Boolean(input.firstName || input.lastName || input.company);
  const hasContact = Boolean(input.email || input.phone || input.mobile || input.website);
  return hasName && hasContact;
}
