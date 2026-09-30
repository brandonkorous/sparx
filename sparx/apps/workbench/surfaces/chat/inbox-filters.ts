// How the chat inbox is narrowed from outside.
//
// "Waiting to hear back" is a conversation with a message nobody on the team has
// read (`unread=true` on the list endpoint, `unreadStaff > 0` on the row — the
// dot every row carries). The inbox could not ask that question at all, so it
// gained an Unread toggle, and a link can turn it on with `unread=true`.
//
// Split from `inbox.tsx` so it can be TESTED: that file is React, and the
// console's test seat is plain Node.

/** `unread` on the address, read once as the toggle's starting state. Only the
 *  literal "true" turns it on — anything else means "no narrowing". */
export function parseUnread(raw: unknown): boolean {
  return raw === 'true';
}
