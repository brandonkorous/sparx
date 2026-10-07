// Where a free address came from, in a sentence that is true for the business
// reading it.
//
// Since 2026-08-24 (issue 010, commit 9ac046f0f) an owner TYPES her address:
// the Your web address box on getpiggles' last sign-up step, and the Web address
// box when she adds a site. The detail pane still said "Piggles gave your
// business this address when you signed up" (P01, Domains, Ease 6), which reads
// as the product having picked for her, about a thing she picked.
//
// Older businesses really were given one, two different ways: before 2026-08-22
// a made-up name (`quiet-haven-3783`), then for two days one made from the
// business's name. So the sentence is chosen by the address's AGE and, for the
// made-up kind, by its SHAPE, rather than told the same way to everyone.

/** The first day every new business and every new site typed its own address. */
const CHOSEN_SINCE = Date.parse('2026-08-25T00:00:00Z');

/** `quiet-haven-3783`: two words and four digits, the shape of the made-up names. */
const MADE_UP = /^[a-z]+-[a-z]+-\d{4}$/;

export function addressOrigin(host: string, createdAt: string, product: string): string {
  // `<business>.<zone>` for the first site, `<site>.<business>.<zone>` after it.
  const labels = host.split('.');
  const sitePart = labels.length >= 4 ? labels[0] : null;
  const created = Date.parse(createdAt);
  const chosen = Number.isFinite(created) && created >= CHOSEN_SINCE;

  if (sitePart) {
    const parts = `The first part, ${sitePart}, is the site's own; the rest is your business's.`;
    return chosen
      ? `You chose this site's address when you added the site, in its Web address box. ${parts}`
      : `${product} gave this site its address when it was added. ${parts}`;
  }
  const business = labels[0] ?? '';
  if (MADE_UP.test(business)) {
    return `${product} made this address up when you signed up, before it asked businesses to choose their own.`;
  }
  return chosen
    ? 'You chose this address when you signed up, in the Your web address box on the last step.'
    : `${product} made this address from your business's name when you signed up.`;
}
