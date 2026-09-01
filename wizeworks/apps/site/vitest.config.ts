// The storefront's test seat.
//
// WHY THIS APP HAS ONE. The house convention is that packages are tested and apps
// are not, and it holds wherever an app is only wiring. This app is the one every
// tenant's customers actually buy through, and some of what it does is pure logic
// whose failure is invisible to typecheck, lint and the eye: the silica walk's
// attribute translation shipped a buy box whose quantity box could not be changed
// by typing, by the spinner, or by the keyboard, and nothing anywhere went red
// (issue 371).
//
// So a rule with a right answer gets tested beside the module that holds it. What
// is NOT tested here is React: no component rendering, no jsdom. Surfaces are
// checked by walking them as a customer, which is the right test for a surface and
// the wrong one for a lookup table.

// A PLAIN OBJECT, not `defineConfig` — the helper resolves only once vitest is
// linked into this workspace, so a config using it cannot load on a checkout where
// `pnpm install` has not run and the failure is an unresolved-import stack rather
// than "run install". A literal config loads either way.
export default {
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    environment: 'node',
  },
};
