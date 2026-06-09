import { expect, test, type Locator, type Page } from '@playwright/test';

// Multi-site (web property) management — full lifecycle against the real DB.
//
// Each test:
//   1. Navigates to /settings/sites
//   2. Creates a secondary site with a timestamp-unique name
//   3. Exercises the feature under test
//   4. Deletes the secondary site via the AlertDialog so the DB stays clean
//
// The site create + delete helpers are reused across every describe block.

// ── helpers ───────────────────────────────────────────────────────────────────

/** The Card element wrapping a specific site. SitesManager annotates each Card
 *  with data-testid="site-card"; we filter by display name. */
function siteCard(page: Page, name: string): Locator {
  return page.locator('[data-testid="site-card"]').filter({ hasText: name });
}

/** Create a secondary site and wait for the toast confirming success. */
async function createSecondary(page: Page, name: string, slug: string): Promise<void> {
  await page.getByRole('button', { name: 'New site' }).click();
  await page.getByLabel('Site name').fill(name);
  await page.getByLabel('URL handle (optional)').fill(slug);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Site created')).toBeVisible({ timeout: 15_000 });
}

/** Delete a secondary site via the AlertDialog confirm.
 *  Caller is responsible for ensuring the site is not primary before calling. */
async function deleteSecondary(page: Page, name: string): Promise<void> {
  const card = siteCard(page, name);
  await card.getByRole('button', { name: 'Delete site' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /delete site/i })
    .click();
  await expect(siteCard(page, name)).not.toBeVisible({ timeout: 15_000 });
}

// ── create / delete ───────────────────────────────────────────────────────────

test.describe('/settings/sites — site creation and deletion', () => {
  test('creates a secondary site then deletes it', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Site ${stamp}`;
    const slug = `e2esite${stamp}`;

    await page.goto('/settings/sites');
    await expect(page.getByRole('heading', { name: 'Sites', level: 1 })).toBeVisible();

    await createSecondary(page, name, slug);

    // New site card appears, marked as currently being edited.
    const card = siteCard(page, name);
    await expect(card).toBeVisible();
    await expect(card.getByText('Editing now')).toBeVisible();

    // The URL handle is displayed in the card.
    await expect(card.getByText(slug)).toBeVisible();

    // Primary site card must still show the Primary badge.
    const primaryCard = page
      .locator('[data-testid="site-card"]')
      .filter({ hasText: 'Primary' })
      .filter({ hasNotText: name });
    await expect(primaryCard.getByText('Primary')).toBeVisible();

    await deleteSecondary(page, name);
    await expect(page.getByText(name)).not.toBeVisible();
  });
});

// ── site switching ────────────────────────────────────────────────────────────

test.describe('/settings/sites — site switching', () => {
  test('switching sites updates the "Editing now" indicator', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Switch ${stamp}`;
    const slug = `e2eswitch${stamp}`;

    await page.goto('/settings/sites');
    await createSecondary(page, name, slug);

    const secondary = siteCard(page, name);
    await expect(secondary.getByText('Editing now')).toBeVisible();

    // Find the primary card (has "Primary" badge and is not our test site).
    const primaryCard = page
      .locator('[data-testid="site-card"]')
      .filter({ hasText: 'Primary' })
      .filter({ hasNotText: name });

    // Switch to the primary site.
    await primaryCard.getByRole('button', { name: 'Switch to this site' }).click();
    await expect(page.getByText(/Now editing/)).toBeVisible({ timeout: 10_000 });
    await expect(primaryCard.getByText('Editing now')).toBeVisible({ timeout: 8_000 });
    await expect(secondary.getByText('Editing now')).not.toBeVisible();

    // Switch back to the secondary site.
    await secondary.getByRole('button', { name: 'Switch to this site' }).click();
    await expect(secondary.getByText('Editing now')).toBeVisible({ timeout: 10_000 });

    // Restore: switch to primary before cleanup so deleteSecondary's card has
    // the "Delete site" button (secondary must not be the active "Editing now"
    // site when deleted, which is fine — the button is always visible on secondaries).
    await deleteSecondary(page, name);
  });
});

// ── brand override ────────────────────────────────────────────────────────────

test.describe('/settings/sites — per-site brand override', () => {
  test('sets and saves a brand override on a secondary site', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Brand ${stamp}`;
    const slug = `e2ebrand${stamp}`;

    await page.goto('/settings/sites');
    await createSecondary(page, name, slug);

    const card = siteCard(page, name);

    // Open the "Site presentation" details section.
    await card.getByText('Site presentation', { exact: true }).click();
    await card.getByLabel('Display name').fill('Wholesale Division');
    await card.getByLabel('Primary colour').fill('#1a2b3c');
    await card.getByRole('button', { name: 'Save site presentation' }).click();

    // The summary updates to "· on" once an override is set.
    await expect(card.getByText(/Site presentation · on/)).toBeVisible({ timeout: 10_000 });

    // Re-open and confirm the values round-tripped from the DB.
    await card.getByText(/Site presentation/).click();
    await expect(card.getByLabel('Display name')).toHaveValue('Wholesale Division');
    await expect(card.getByLabel('Primary colour')).toHaveValue('#1a2b3c');

    await deleteSecondary(page, name);
  });
});

// ── module visibility ─────────────────────────────────────────────────────────

test.describe('/settings/sites — per-site module visibility', () => {
  test('disabling then re-enabling a module on a secondary site', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Modules ${stamp}`;
    const slug = `e2emods${stamp}`;

    await page.goto('/settings/sites');
    await createSecondary(page, name, slug);

    const card = siteCard(page, name);

    // Open the "Module visibility" section.
    await card.getByText('Module visibility', { exact: true }).click();

    // Each module row: <Text>{slug}</Text> <Button>Enabled | Disabled</Button>
    // Scope to the commerce row by targeting the sibling button of the "commerce" label.
    const commerceLabel = card.getByText('commerce', { exact: true });
    const commerceToggle = commerceLabel.locator('..').getByRole('button');
    await expect(commerceToggle).toHaveText('Enabled');

    // Disable.
    await commerceToggle.click();
    await expect(commerceToggle).toHaveText('Disabled', { timeout: 8_000 });
    await expect(card.getByText(/Module visibility · 1 disabled/)).toBeVisible({
      timeout: 5_000,
    });

    // Re-enable so the DB is clean.
    await commerceToggle.click();
    await expect(commerceToggle).toHaveText('Enabled', { timeout: 8_000 });

    await deleteSecondary(page, name);
  });
});

// ── make primary ──────────────────────────────────────────────────────────────

test.describe('/settings/sites — make primary', () => {
  test('promotes a secondary site to primary and restores afterward', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Primary ${stamp}`;
    const slug = `e2epri${stamp}`;

    await page.goto('/settings/sites');
    await createSecondary(page, name, slug);

    const secondary = siteCard(page, name);

    // Promote the secondary to primary.
    await secondary.getByRole('button', { name: 'Make primary' }).click();
    await expect(page.getByText(/is now primary/i)).toBeVisible({ timeout: 10_000 });
    await expect(secondary.getByText('Primary')).toBeVisible({ timeout: 8_000 });

    // The former primary lost its badge and now exposes "Make primary".
    // It's the only site-card that has a "Make primary" button but NOT our name.
    const formerPrimary = page
      .locator('[data-testid="site-card"]')
      .filter({ hasNotText: name })
      .filter({ has: page.getByRole('button', { name: 'Make primary' }) })
      .first();
    await expect(formerPrimary.getByText('Primary')).not.toBeVisible();

    // Restore: make the original site primary again.
    await formerPrimary.getByRole('button', { name: 'Make primary' }).click();
    await expect(page.getByText(/is now primary/i)).toBeVisible({ timeout: 10_000 });
    await expect(formerPrimary.getByText('Primary')).toBeVisible({ timeout: 8_000 });

    // Our test site is now secondary again → can be deleted.
    await deleteSecondary(page, name);
  });
});

// ── domain connection ─────────────────────────────────────────────────────────

test.describe('/settings/sites — custom domain connection', () => {
  test('connecting a domain shows DNS instructions', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Domain ${stamp}`;
    const slug = `e2edom${stamp}`;
    // Use a realistic-looking host; the API validates format but not actual DNS.
    const host = `shop${stamp}.example.com`;

    await page.goto('/settings/sites');
    await createSecondary(page, name, slug);

    const card = siteCard(page, name);

    // Connect a custom domain.
    await card.getByLabel('Connect a domain you own').fill(host);
    await card.getByRole('button', { name: 'Connect' }).click();

    // After connecting the domain row appears with DNS instructions.
    await expect(card.getByText(host)).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText('CNAME')).toBeVisible({ timeout: 5_000 });

    // Deleting the site cascades and removes the domain row — no separate
    // disconnect step needed.
    await deleteSecondary(page, name);
  });
});
