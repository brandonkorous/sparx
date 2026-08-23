// The four pages the site header offers, in one place.
//
// The bar and the phone drawer both render them, and a visitor who found one
// list shorter than the other would be right to wonder what else differs.

export const HEADER_LINKS = [
  { href: '/apps', label: 'Apps' },
  { href: '/pricing', label: 'Pricing' },
  // Ahead of Trust deliberately: most people arriving at the free tools came
  // from a search with nothing to do with Piggles, and this is the one nav item
  // that gives them a reason to look at a second page.
  { href: '/tools', label: 'Free tools' },
  { href: '/trust', label: 'Trust' },
];
