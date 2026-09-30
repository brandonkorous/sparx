// "WHAT CAN THIS PERSON REACH" — ONE PHRASE, TWO QUESTIONS.
//
// The roster has a column with that heading, and until now it answered only
// half of what it asks. Access narrows on two independent axes: WHICH APPS a
// person may open, and WHOSE BUSINESS they may open them on. An account running
// a shop, a market stall and a press page uses the same apps for all three, so
// the app list cannot say "the Saturday assistant works the stall only" — and
// that is the sentence an owner with more than one site actually needs.
//
// The column said "Everything their role allows" for somebody held to one shop
// out of seven. Not wrong about the apps. Just silent about the part that
// mattered, which is the worst kind of wrong for a summary (issue 879).
//
// ── WHY THE NAMES COME IN FROM OUTSIDE ──────────────────────────────────────
//
// An app's label is a brand decision and a site's name is a row in the
// database, so neither belongs in a rule about sentences. Passing both in as
// functions keeps this file free of the console's React module graph, which is
// what lets it be tested at all — and it is the same shape `siteName` already
// needed, since a site that has been deleted since the grant was made still has
// to say something and an id is not something.

/** Resolves an app slug and a site id to the words a person reads. */
export interface ReachNames {
  moduleName: (slug: string) => string;
  siteName: (id: string) => string;
}

/** What the column needs to know about one person. Deliberately the smallest
 *  shape that answers the question, so an invitation and a member both fit. */
export interface ReachSubject {
  role: string;
  kind: 'member' | 'invitation';
  moduleAccessMode?: 'all' | 'selected';
  modules?: string[];
  propertyAccessMode?: 'all' | 'selected';
  properties?: string[];
}

/**
 * A list of names, shortened once it stops being readable at a glance.
 *
 * Names, not a count: "3 apps" is a number the owner then has to go and look
 * up, and the whole reason this column exists is to answer without opening
 * anybody.
 */
export function nameList(names: string[], keep: number): string {
  if (names.length <= keep) return names.join(', ');
  return `${names.slice(0, keep).join(', ')} and ${String(names.length - keep)} more`;
}

/** Which apps, or null when nothing narrows them. */
export function describeModuleReach(person: ReachSubject, names: ReachNames): string | null {
  if (person.kind === 'invitation') return null;
  if (person.moduleAccessMode !== 'selected') return null;
  const modules = person.modules ?? [];
  // A real, saveable state: somebody can sign in and find nothing at all. The
  // column has to say so rather than fall through to "everything".
  if (modules.length === 0) return 'Nothing chosen yet';
  return nameList(modules.map(names.moduleName), 3);
}

/** Which sites, or null when nothing narrows them. */
export function describeSiteReach(person: ReachSubject, names: ReachNames): string | null {
  if (person.kind === 'invitation') return null;
  if (person.propertyAccessMode !== 'selected') return null;
  const properties = person.properties ?? [];
  if (properties.length === 0) return 'No sites chosen yet';
  // Two before it shortens, not three: a site's name is a business name and
  // runs longer than an app's, and the cell clips at a fixed width.
  return `${nameList(properties.map(names.siteName), 2)} only`;
}

/**
 * The whole answer, as one phrase.
 *
 * Owners and admins first, because the server refuses to limit them at all —
 * saying anything narrower about those two would be describing a restriction
 * that does not exist. An invitation carries no grants yet, so it can only
 * honestly promise what the role allows.
 */
export function describeReach(person: ReachSubject, names: ReachNames): string {
  if (person.role === 'owner' || person.role === 'admin') return 'Everything';
  if (person.kind === 'invitation') return 'Everything their role allows';

  const areas = describeModuleReach(person, names);
  const sites = describeSiteReach(person, names);
  if (!areas && !sites) return 'Everything their role allows';
  // The apps clause still reads "everything their role allows" when only the
  // sites are narrowed, because that half is genuinely unrestricted and
  // dropping it would make the sentence describe the wrong axis.
  return [areas ?? 'Everything their role allows', sites].filter(Boolean).join(' · ');
}
