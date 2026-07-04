import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Playwright "setup" project. Runs once before any dependent project.
// It signs the test user up (or signs them in if they exist) via the real
// dashboard UI, then saves cookies/localStorage to a storageState file the
// chromium project reuses. This keeps every test below authenticated without
// each spec carrying its own login boilerplate.

const TEST_EMAIL = 'e2e-staff@sparx.test';
const TEST_PASSWORD = 'e2e-test-password';
const TEST_NAME = 'E2E Tester';

export const STORAGE_STATE_PATH = path.resolve(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Strategy: try to sign up. If the email is already taken (re-runs against
  // the same dev database — the common local case), peel off and sign in via
  // the form instead. We drive the UI either way so we exercise the same code
  // paths a real user would — and so we land past the auth screens with a live
  // session before storageState() snapshots cookies.
  //
  // The sign-up form is: name, email, password, confirm password, and the
  // legal-acceptance checkbox (required server-side — an unchecked box short-
  // circuits to a "please accept" error before the email-taken check, so we
  // MUST tick it for the already-exists fallback to fire). A fresh sign-up
  // lands in onboarding (/story); an already-registered email keeps us on
  // /sign-up with an "already exists" error.

  await page.goto('/sign-up');
  await page.getByLabel('Your name').fill(TEST_NAME);
  await page.getByLabel('Work email').fill(TEST_EMAIL);
  // "Password" is a substring of "Confirm password"; pin the exact label so the
  // locator isn't ambiguous under strict mode.
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
  await page.getByRole('checkbox', { name: /I agree/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();

  // Success navigates off /sign-up (into onboarding); a taken email keeps us on
  // /sign-up with an inline "already exists" error. Race the two so the setup
  // works against both a fresh and a reused database. (Next.js renders a global
  // role="alert" announcer; target the specific text instead to avoid strict-
  // mode locator collisions.)
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith('/sign-up'), { timeout: 15_000 }),
    page.getByText(/already taken|already exists/).waitFor({ state: 'visible', timeout: 15_000 }),
  ]);

  if (new URL(page.url()).pathname.startsWith('/sign-up')) {
    // Email already exists — sign in instead.
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    // Exact label: the PasswordInput's "Show password" toggle also carries
    // "password" in its accessible name, so a loose match is ambiguous.
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/');
  }

  // Always land on / before snapshotting so subsequent tests start there. The
  // dashboard greets with a time-of-day heading ("Good morning/afternoon/
  // evening"), so match the family rather than a single literal that only holds
  // before noon.
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })
  ).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
