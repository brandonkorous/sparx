import { defineConfig } from 'vitest/config';

// Tests render the shared leaf map with react-dom/server (no DOM needed), so the
// node environment is enough. JSX is transformed via the automatic runtime that
// the tsconfig (`jsx: react-jsx`) already declares.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
