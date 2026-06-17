import { defineConfig } from 'vitest/config';

// The View-HTML serializer renders into a real (detached) DOM via react-dom/client
// + flushSync (it cannot use react-dom/server — Next bans it in the app bundle), so
// the suite needs a DOM: jsdom. The leaf-map tests render presentational output and
// run fine under it too. JSX is transformed via the automatic runtime that the
// tsconfig (`jsx: react-jsx`) already declares.
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
