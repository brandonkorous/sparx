// The handoff's test seat.
//
// The cookie that IS the session on mypiggles.com is now written by api-rest, and its tests moved with it
// (wizeworks/packages/auth/src/session-handoff.test.ts, which checks the
// signature against better-call's own verifier). What stays here is where the
// apps are and where a person lands.

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
