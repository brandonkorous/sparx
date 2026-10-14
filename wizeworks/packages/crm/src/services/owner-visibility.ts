// Who may see a thing a person made and chose whether to share (persona issue 264).
//
// Boards, reports and saved paragraphs carry who made them and whether they are
// shared, and their screens promise "Off keeps it to you". The rule is the same
// for all three, so it lives once:
//
//   · shared                 → everyone in the business
//   · made by nobody         → everyone (the ready-made reports, and anything
//                              saved before makers were recorded)
//   · made by this person    → this person
//
// A caller with no person behind it (an API key) sees only the first two: a key
// is not anybody, so nothing is "its own".
//
// Callers answer a row outside this rule exactly as they answer a missing one, a
// not-found, never a "forbidden": a private board's existence is part of what is
// private.

/** The two columns the rule reads, by their names on a given table. */
export interface OwnerColumns<O extends string, S extends string> {
  owner: O;
  shared: S;
}

/** Boards and reports name them `ownerId` + `shared`. */
export const BOARD_COLUMNS: OwnerColumns<'ownerId', 'shared'> = {
  owner: 'ownerId',
  shared: 'shared',
};

/** Whether `viewerId` may see a row made by `ownerId`, shared or not. */
export function canSee(
  viewerId: string | null | undefined,
  row: { ownerId: string | null; shared: boolean }
): boolean {
  if (row.shared || row.ownerId === null) return true;
  return Boolean(viewerId) && row.ownerId === viewerId;
}

/**
 * The same rule as a Prisma `where` fragment. Spread it into a query that has no
 * `OR` of its own, or put it in an `AND` beside one.
 */
export function visibleWhere<O extends string, S extends string>(
  viewerId: string | null | undefined,
  columns: OwnerColumns<O, S>
): { OR: (Record<S, true> | Record<O, string | null>)[] } {
  const anyone = [
    { [columns.shared]: true } as Record<S, true>,
    { [columns.owner]: null } as Record<O, null>,
  ];
  if (!viewerId) return { OR: anyone };
  return { OR: [...anyone, { [columns.owner]: viewerId } as Record<O, string>] };
}
