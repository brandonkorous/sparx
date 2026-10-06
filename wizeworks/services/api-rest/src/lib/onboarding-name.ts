// What the setup checklist reads to decide whether the business has been named.

/**
 * Whether the business carries a name a PERSON chose. Two names are made by machine:
 * sign-up's "<First>'s workspace" (`workspaceNameFor`, @wizeworks/auth) and the story
 * flow's title-cased web address ("gillettdiesel" → "Gillettdiesel"). The checklist's
 * "Confirm your site details" read `Boolean(tenant.name)`, which every tenant passes
 * from its first second, so it could never ask anybody (sparx persona issue 025).
 * Read from the name itself, so renaming it on ANY screen counts.
 */
export function nameIsChosen(name: string | null, slug: string | null): boolean {
  const n = (name ?? '').trim();
  if (!n) return false;
  if (/'s workspace$/i.test(n)) return false;
  const fromSlug = (slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return n !== fromSlug;
}
