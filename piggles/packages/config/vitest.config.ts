// The config package's test seat: the api-rest reads every layout makes, run in node.
// A plain object, not `defineConfig`, so it loads before install.

export default {
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
  },
};
