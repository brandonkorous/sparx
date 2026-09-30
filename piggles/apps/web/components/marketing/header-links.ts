// The plain links the header offers after the Apps and Who it's for panels.
// The desktop bar and the phone drawer both render them, so they never differ.

export const HEADER_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  // Free tools stay in the bar: people who arrive for a tool need a reason to see a second page.
  { href: '/tools', label: 'Free tools' },
];
