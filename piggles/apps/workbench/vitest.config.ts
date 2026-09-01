// The console's test seat.
//
// WHY AN APP HAS ONE. The house convention is that packages are tested and apps
// are not, and it holds wherever an app is only wiring. This one is not: the
// console decides what a person READS — which name a form has, what a design will
// do to the site it lands on, whether setup is about to run over a live business —
// and every one of those is a pure function whose failure is invisible to
// typecheck, lint and the eye. Three shipped that way before this existed
// (issues 353, 355, 364), and a fourth would have deleted a site (363).
//
// So the rules are tested where they live, beside the screen that uses them,
// rather than moved into a package to satisfy the convention. What is NOT tested
// here is React: no component rendering, no jsdom, no query-client fixtures. The
// surfaces are checked by driving them as the business owner, which is the right
// test for a surface and the wrong one for a sentence.

// A PLAIN OBJECT, not `defineConfig`. The helper is imported from `vitest/config`,
// which resolves only once vitest is linked into this workspace — so a config
// using it cannot load on a checkout where `pnpm install` has not run yet, and
// the failure is an unresolved-import stack rather than "run install". A literal
// config loads either way.
export default {
  test: {
    // Co-located beside the module they cover, the way the wizeworks packages do
    // it — a rule and its test read as one file pair.
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    environment: 'node',
  },
};
