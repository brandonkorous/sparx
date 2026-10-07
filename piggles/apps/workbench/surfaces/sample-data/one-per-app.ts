// Two modules can live in one app, so a list of modules read aloud as app names
// can say the same name twice. Practice data's row said "Sell, Customers,
// Content, Stock, Bookings, Sell, Invoices" (issue 937).

/** The modules, keeping the first of any that share an app name. */
export function onePerApp(slugs: readonly string[], label: (slug: string) => string): string[] {
  const seen = new Set<string>();
  return slugs.filter((slug) => {
    const name = label(slug);
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}
