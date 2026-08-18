/**
 * Builds an email signature as table-based HTML with fully inlined styles —
 * the only thing that survives Gmail, Outlook, and Apple Mail intact. Fonts are
 * web-safe (Arial/Helvetica) on purpose: an email can't load Geist. Social links
 * are text, not images, because most clients block remote images by default.
 */

export type SignatureLayout = 'horizontal' | 'stacked' | 'minimal';

export interface SignatureData {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  accent: string;
  photo: string | null;
  logo: string | null;
  linkedin: string;
  twitter: string;
  instagram: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONT = 'font-family:Arial,Helvetica,sans-serif;';

function link(href: string, text: string, accent: string, bold = false): string {
  return `<a href="${esc(href)}" style="color:${accent};text-decoration:none;${bold ? 'font-weight:bold;' : ''}">${esc(text)}</a>`;
}

function detailsHtml(d: SignatureData): string {
  const rows: string[] = [];
  rows.push(
    `<div style="${FONT}font-size:16px;font-weight:bold;color:#111111;line-height:1.3;">${esc(d.name) || 'Your Name'}</div>`
  );
  const role = [d.title, d.company].filter(Boolean).map(esc).join(' · ');
  if (role)
    rows.push(`<div style="${FONT}font-size:13px;color:#555555;padding-top:2px;">${role}</div>`);
  rows.push('<div style="height:8px;line-height:8px;font-size:8px;">&nbsp;</div>');

  if (d.phone)
    rows.push(
      `<div style="${FONT}font-size:13px;color:#555555;line-height:1.6;">${link(`tel:${d.phone}`, d.phone, d.accent)}</div>`
    );
  if (d.email)
    rows.push(
      `<div style="${FONT}font-size:13px;color:#555555;line-height:1.6;">${link(`mailto:${d.email}`, d.email, d.accent)}</div>`
    );
  if (d.website) {
    const href = /^https?:\/\//i.test(d.website) ? d.website : `https://${d.website}`;
    rows.push(
      `<div style="${FONT}font-size:13px;color:#555555;line-height:1.6;">${link(href, d.website.replace(/^https?:\/\//, ''), d.accent)}</div>`
    );
  }

  const socials = [
    d.linkedin && link(d.linkedin, 'LinkedIn', d.accent),
    d.twitter && link(d.twitter, 'X', d.accent),
    d.instagram && link(d.instagram, 'Instagram', d.accent),
  ].filter(Boolean);
  if (socials.length)
    rows.push(
      `<div style="${FONT}font-size:13px;padding-top:6px;color:#999999;">${socials.join(' &nbsp;·&nbsp; ')}</div>`
    );

  if (d.logo)
    rows.push(
      `<div style="padding-top:12px;"><img src="${esc(d.logo)}" alt="${esc(d.company)}" height="30" style="height:30px;display:block;border:0;" /></div>`
    );

  return rows.join('');
}

/** Compose the signature HTML for the chosen layout. */
export function buildSignatureHtml(d: SignatureData, layout: SignatureLayout): string {
  const details = detailsHtml(d);

  if (layout === 'minimal') {
    const contact = [d.email, d.phone, d.website].filter(Boolean).map(esc).join('&nbsp; · &nbsp;');
    return (
      `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="border-left:3px solid ${d.accent};padding-left:12px;">` +
      `<div style="${FONT}font-size:15px;font-weight:bold;color:#111111;">${esc(d.name) || 'Your Name'}` +
      `${d.title ? `<span style="font-weight:normal;color:#555555;"> — ${esc(d.title)}${d.company ? `, ${esc(d.company)}` : ''}</span>` : ''}</div>` +
      `${contact ? `<div style="${FONT}font-size:13px;color:#555555;padding-top:4px;">${contact}</div>` : ''}` +
      `</td></tr></table>`
    );
  }

  if (layout === 'horizontal' && d.photo) {
    return (
      `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>` +
      `<td valign="top" style="padding-right:16px;"><img src="${esc(d.photo)}" alt="${esc(d.name)}" width="72" height="72" style="width:72px;height:72px;border-radius:50%;display:block;border:0;object-fit:cover;" /></td>` +
      `<td valign="top" style="border-left:2px solid ${d.accent};padding-left:16px;">${details}</td>` +
      `</tr></table>`
    );
  }

  // stacked (or horizontal without a photo)
  return (
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>` +
    `<td valign="top" style="border-left:3px solid ${d.accent};padding-left:14px;">${details}</td>` +
    `</tr></table>`
  );
}

/** Plain-text fallback for the clipboard. */
export function buildSignatureText(d: SignatureData): string {
  return [d.name, [d.title, d.company].filter(Boolean).join(', '), d.phone, d.email, d.website]
    .filter(Boolean)
    .join('\n');
}
