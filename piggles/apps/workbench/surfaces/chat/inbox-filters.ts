// How the chat inbox is narrowed from outside.
//
// Home's "2 people are waiting to hear back" counts conversations with a
// message nobody on the team has read (`unread=true`), and it opened the whole
// inbox: every conversation the site had ever had, answered ones included, with
// the two marked only by a dot ([258]). The inbox had no way to ask that
// question at all, so it gained an Unread toggle, and this is how the sentence
// turns it on.
//
// Split from `inbox.tsx` so it can be TESTED: that file is React, and the
// console's test seat is plain Node.

/** `unread` on the address, read once as the toggle's starting state. Only the
 *  literal "true" turns it on — anything else means "no narrowing". */
export function parseUnread(raw: unknown): boolean {
  return raw === 'true';
}
