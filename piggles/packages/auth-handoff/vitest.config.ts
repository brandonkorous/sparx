// The handoff's test seat.
//
// This package writes the cookie that IS the session on mypiggles.com. Every
// property that matters about it — that it is signed the way Better Auth
// verifies, that it lasts exactly as long as the person asked it to, that
// signing out clears all of it — is invisible to typecheck and to the eye, and
// the last one shipped wrong: "Keep me signed in" was honoured on one domain and
// silently discarded on the other for as long as the handoff has existed.
//
// `scripts/check-session-cookie.mjs` covers the signature against better-call's
// own verifier and stays where it is; it is deliberately dependency-free so it
// can run on a checkout with nothing installed. This covers the decisions.

// A PLAIN OBJECT, not `defineConfig` — same reason as the console's seat: the
// helper comes from `vitest/config`, which cannot resolve before `pnpm install`,
// so a config that imports it fails with an unresolved-import stack instead of
// loading. A literal config loads either way.
export default {
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
  },
};
