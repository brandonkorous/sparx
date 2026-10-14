// WHICH EMAIL. The two choices the email designer makes about which email it is
// working on, kept apart from the screen so they can be tested.
//
// Pressing "+" made a new email and opened its name box, and the name Doty typed
// renamed the automatic Welcome email instead (sparx persona issue 153). Two
// things lined up. The list of emails was refetched AFTER the new one was made,
// so the step that settles the active email did not find it and fell back to the
// first email in the list, which was Welcome. And the name box renamed whatever
// email was active when Enter was pressed, not the one it was opened for.

interface Row {
  id: string;
  name: string;
}

/** The email list with a just-made email in it, written into the cache the
 *  moment it is made, so nothing reads a list that does not have it yet. */
export function withCreatedEmail<T extends Row>(list: readonly T[] | undefined, created: T): T[] {
  return [...(list ?? []).filter((email) => email.id !== created.id), created];
}

/** The email to show: the active one while it is in the list, else the one the
 *  link names, else the first. */
export function emailToShow(
  emails: readonly Row[],
  activeId: string | null,
  linkedId: string | undefined
): string | null {
  if (activeId && emails.some((email) => email.id === activeId)) return activeId;
  const linked = linkedId ? emails.find((email) => email.id === linkedId) : undefined;
  return linked?.id ?? emails[0]?.id ?? null;
}

/** What a name box commits: the email it was OPENED for, by id, and only when
 *  the name really changed. Never "whichever email is active now". */
export function renameToCommit(
  emails: readonly Row[],
  openedFor: string | null,
  draft: string
): { id: string; name: string } | null {
  const target = openedFor ? emails.find((email) => email.id === openedFor) : undefined;
  const name = draft.trim();
  if (!target || name === '' || name === target.name) return null;
  return { id: target.id, name };
}
