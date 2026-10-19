// A staff alert's link to the record it is about (sparx persona issue 331).
//
// "High-value order: O-000034 · $640.96" arrived as one line with nothing to
// click: the owner had to open the console and search for the number. The alert
// says which record it is about (`raw.link`); this turns that into a link on the
// business's own console, because only here is the console's address known.

import { appLink } from '@wizeworks/links/server';
import { prisma } from '@wizeworks/db';

/** The record an alert is about: `RecordLink` in `@wizeworks/email-sends`, which
 *  writes it onto the stored send. */
export interface RecordLink {
  surface: string;
  id: string;
  param?: string;
  label: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The body with the link added: a paragraph in the HTML, a line in the text. An
 *  alert with no HTML of its own gets its text as the HTML's first paragraph, so
 *  the link is never the only thing in it. */
export function withLinkLine(
  body: { html: string; text: string },
  label: string,
  url: string
): { html: string; text: string } {
  const lead = body.html.trim()
    ? body.html
    : body.text
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
  return {
    html: `${lead}<p><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p>`,
    text: `${body.text}\n\n${label}: ${url}`,
  };
}

/** The alert's body with its record link, or as it was when the record has no
 *  console address (an unknown surface answers null rather than a broken link). */
export async function addRecordLink(
  tenantId: string,
  body: { html: string; text: string },
  link: RecordLink | undefined
): Promise<{ html: string; text: string }> {
  if (!link) return body;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { platformBrand: true },
  });
  const url = appLink(
    link.surface,
    { [link.param ?? 'id']: link.id },
    { brand: tenant?.platformBrand }
  );
  return url ? withLinkLine(body, link.label, url) : body;
}
