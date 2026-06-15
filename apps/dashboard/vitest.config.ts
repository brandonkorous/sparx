import { defineConfig } from 'vitest/config';

// Dashboard unit tests run in a NODE environment over PURE logic only (no DOM, no
// React render) — today the unified studio's three-zone routing guards
// (docs/builder/03 §6). `include` is scoped to `*.test.ts` under app/ so it never
// picks up the Playwright `*.spec.ts` e2e suite (which uses its own runner). JSX is
// not needed: the tested modules are plain TypeScript.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
});
