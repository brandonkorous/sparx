// The account app's test seat: pure rules and loaders only, no React rendering, run in node.
// A plain object, not `defineConfig`, so it loads before install.

export default {
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    environment: 'node',
  },
};
