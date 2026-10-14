// The pages a reader sees when they leave a business's mailing list (piggles persona
// issue 983).
//
// Opening the link used to unsubscribe at once and say "You will no longer receive
// marketing emails at this address." Two things were wrong with that:
//
//   • Opening is not choosing. Mail scanners (work mail filters, link checkers)
//     open every link in an email before a person does, so a reader could be taken
//     off a list nobody asked to leave. RFC 8058 is built on exactly that: a GET is
//     safe, the one-click unsubscribe is a POST. So opening the link now ASKS, and
//     the button (a POST, the same request a mail app's own Unsubscribe button
//     sends) does it.
//   • It named nobody. A reader on several lists could not tell which one this was,
//     or which of their addresses. Both pages now say the business and the address.
//
// Pure: HTML strings from plain values, so the words are tested without a server.

/** What the page needs to say who and what. Null business when the account has no
 *  name to show, which the pages say plainly rather than inventing one. */
export interface UnsubscribeSubject {
  business: string | null;
  email: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1rem;box-sizing:border-box}main{max-width:28rem;padding:2.5rem;background:#fff;border:1px solid #e2e8f0;border-radius:12px;text-align:center}h1{font-size:1.25rem;margin:0 0 .75rem}p{margin:0 0 1rem;color:#0f172a;line-height:1.5;font-size:1rem}p:last-child{margin-bottom:0}strong{overflow-wrap:anywhere}button{font:inherit;font-weight:600;background:#0f172a;color:#fff;border:0;border-radius:8px;padding:.75rem 1.25rem;cursor:pointer}button:focus-visible{outline:3px solid #2563eb;outline-offset:2px}</style></head><body><main>${body}</main></body></html>`;
}

/** "from The Marrow Review" or "from this sender". */
function fromWhom(business: string | null): string {
  return business ? `from <strong>${escapeHtml(business)}</strong>` : 'from this sender';
}

/** Opening the link: what it will do, and the one button that does it. */
export function unsubscribeAskPage(subject: UnsubscribeSubject, action: string): string {
  return shell(
    'Unsubscribe',
    `<h1>Stop these emails?</h1><p>You will no longer get newsletters and offers ${fromWhom(subject.business)} at <strong>${escapeHtml(subject.email)}</strong>. Emails about something you ordered or booked still reach you.</p><form method="post" action="${escapeHtml(action)}"><button type="submit">Unsubscribe</button></form>`
  );
}

/** After the button (or a mail app's own one-click Unsubscribe). */
export function unsubscribedPage(subject: UnsubscribeSubject): string {
  return shell(
    'Unsubscribed',
    `<h1>You’re unsubscribed</h1><p>You will no longer get newsletters and offers ${fromWhom(subject.business)} at <strong>${escapeHtml(subject.email)}</strong>.</p>`
  );
}

/** A link that could not be read: cut short, or not one of ours. Nothing is written. */
export function unreadableLinkPage(): string {
  return shell(
    'Unsubscribe',
    `<h1>This link didn’t work</h1><p>It may have been cut short on its way here. Open the email again and use its Unsubscribe link, or reply to the email and ask to be taken off the list.</p>`
  );
}
