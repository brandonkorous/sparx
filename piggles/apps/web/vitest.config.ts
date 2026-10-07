// The marketing site's test seat: pure rules only (the free tools' encoders), no
// React rendering. A plain object, not `defineConfig`, so it loads before install.

export default {
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    environment: 'node',
  },
};
