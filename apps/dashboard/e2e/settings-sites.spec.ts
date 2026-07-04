import { expect, test, type Locator, type Page } from '@playwright/test';

// Multi-site (web property) management — full lifecycle against the real DB.
//
// The page is on the sitewide list substrate (SelectionList) + the per-site
// detail (drawer/modal/full-page). Tests force `?view=table` for a deterministic
// row structure and drive the per-site DETAIL via each row's full-page "Manage"
// link (a plain link → always full page, regardless of the user's
// defaultDetailView). All per-site editing (name, domains, modules, delete,
// switch, make-primary) lives on that detail now — not inline on the list.
//
// Each test creates a secondary site with a timestamp-unique name, exercises the
// feature, and deletes the site so the DB stays clean.

// ── helpers ───────────────────────────────────────────────────────────────────

/** A site's row in the table view, located by its display name. */
function siteRow(page: Page, name: string): Locator {
  return page.locator('tbody tr').filter({ hasText: name });
}

/** The display name of the current primary site (first row bearing "Primary").
 *  The row's first link is the site-name EntityRowLink (the "Manage" link is
 *  second), so `.first()` reads the name. Requires table view. */
async function primaryName(page: Page): Promise<string> {
  const row = page.locator('tbody tr').filter({ hasText: 'Primary' }).first();
  return (await row.getByRole('link').first().innerText()).trim();
}

/** Open a site's management detail full-page via its row "Manage" link, and wait
 *  for the General tab to render. */
async function openDetail(page: Page, name: string): Promise<void> {
  await siteRow(page, name).getByRole('link', { name: 'Manage' }).click();
  await expect(page.getByRole('heading', { name: 'Site name & address' })).toBeVisible({
    timeout: 15_000,
  });
}

/** Create a secondary site through the New-site wizard (docs/49 Phase 8b), taking
 *  the blank-site path so the helper is deterministic (no blueprint dependency),
 *  and wait for its row to appear. */
async function createSecondary(page: Page, name: string, slug: string): Promise<void> {
  // Drive the wizard on its full-page route for a deterministic surface —
  // "New site" (EntityCreateButton) otherwise opens it as the user's
  // defaultDetailView (drawer / modal / full page).
  await page.goto('/settings/sites/new');
  // Step 1 — starting point: a blank site.
  await page.getByRole('button', { name: /Blank site/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // Step 2 — name & address.
  await page.getByLabel('Site name').fill(name);
  await page.getByLabel('URL handle').fill(slug);
  await page.getByRole('button', { name: 'Continue' }).click();
  // Step 3 — review & create.
  await page.getByRole('button', { name: 'Create site' }).click();
  // Success panel, then Done → back to the list; the new row appears.
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Done' }).click();
  await page.goto('/settings/sites?view=table');
  await expect(siteRow(page, name)).toBeVisible({ timeout: 15_000 });
}

/** Delete a secondary site from its detail's General tab (danger zone → confirm).
 *  Caller must ensure the site is not primary first (api-rest refuses the primary). */
async function deleteSecondary(page: Page, name: string): Promise<void> {
  await openDetail(page, name);
  await page.getByRole('button', { name: /^Delete/ }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /delete site/i })
    .click();
  // Delete navigates back to the list; the row (its name link) is gone.
  await expect(page.getByRole('link', { name })).not.toBeVisible({ timeout: 15_000 });
}

// ── create / delete ───────────────────────────────────────────────────────────

test.describe('/settings/sites — site creation and deletion', () => {
  test('creates a secondary site then deletes it', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Site ${stamp}`;
    const slug = `e2esite${stamp}`;

    await page.goto('/settings/sites?view=table');
    await expect(page.getByRole('heading', { name: 'Sites', level: 1 })).toBeVisible();

    await createSecondary(page, name, slug);

    // The new row appears, marked as currently being edited, with its handle shown.
    // Match the handle chip exactly — the row's domain link also contains the slug
    // (as `<slug>.…sparx.zone`), so a loose text match is ambiguous.
    const row = siteRow(page, name);
    await expect(row.getByText('Editing now')).toBeVisible();
    await expect(row.getByText(slug, { exact: true })).toBeVisible();

    // A primary site still exists (its row bears the Primary badge).
    await expect(
      page.locator('tbody tr').filter({ hasText: 'Primary' }).filter({ hasNotText: name })
    ).toBeVisible();

    await deleteSecondary(page, name);
  });
});

// ── site switching ────────────────────────────────────────────────────────────

test.describe('/settings/sites — site switching', () => {
  test('switching sites updates the "Editing now" indicator', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Switch ${stamp}`;
    const slug = `e2eswitch${stamp}`;

    await page.goto('/settings/sites?view=table');
    const original = await primaryName(page);
    await createSecondary(page, name, slug);

    // The new site is now the one being edited.
    await expect(siteRow(page, name).getByText('Editing now')).toBeVisible();

    // Switch to the original primary from its detail header.
    await openDetail(page, original);
    await page.getByRole('button', { name: 'Switch to editing' }).click();
    await expect(page.getByText(/Now editing/)).toBeVisible({ timeout: 10_000 });

    // Back on the list, the secondary is no longer "Editing now".
    await page.goto('/settings/sites?view=table');
    await expect(siteRow(page, name).getByText('Editing now')).not.toBeVisible({ timeout: 8_000 });

    // Switch back to the secondary (also readies it for cleanup).
    await openDetail(page, name);
    await expect(page.getByRole('button', { name: 'Switch to editing' })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to editing' }).click();
    await expect(page.getByText(/Now editing/)).toBeVisible({ timeout: 10_000 });

    await page.goto('/settings/sites?view=table');
    await deleteSecondary(page, name);
  });
});

// ── module visibility ─────────────────────────────────────────────────────────

test.describe('/settings/sites — per-site module visibility', () => {
  test('disabling then re-enabling a module on a secondary site', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Modules ${stamp}`;
    const slug = `e2emods${stamp}`;

    await page.goto('/settings/sites?view=table');
    await createSecondary(page, name, slug);

    await openDetail(page, name);
    await page.getByRole('tab', { name: /Modules/ }).click();

    const commerce = page.getByRole('switch', { name: 'Commerce on this site' });
    await expect(commerce).toBeChecked();

    // Disable, then re-enable so the DB is clean. The toggle is disabled while its
    // server action is in flight, so allow generous headroom for a cold call.
    await commerce.click();
    await expect(commerce).not.toBeChecked({ timeout: 15_000 });
    await commerce.click();
    await expect(commerce).toBeChecked({ timeout: 15_000 });

    await page.goto('/settings/sites?view=table');
    await deleteSecondary(page, name);
  });
});

// ── make primary ──────────────────────────────────────────────────────────────

test.describe('/settings/sites — make primary', () => {
  test('promotes a secondary site to primary and restores afterward', async ({ page }) => {
    const stamp = Date.now();
    // Deliberately avoid the word "Primary" in the name — it would collide with
    // the row's "Primary" status badge under a text locator.
    const name = `E2E Promote ${stamp}`;
    const slug = `e2epromo${stamp}`;

    await page.goto('/settings/sites?view=table');
    const original = await primaryName(page);
    await createSecondary(page, name, slug);

    // Promote the secondary from its detail header (icon action, tooltip label).
    await openDetail(page, name);
    await page.getByRole('button', { name: 'Make primary site' }).click();
    await expect(page.getByText(/is now primary/i)).toBeVisible({ timeout: 10_000 });

    // Back on the list, our site now wears the Primary badge.
    await page.goto('/settings/sites?view=table');
    await expect(siteRow(page, name).getByText('Primary')).toBeVisible({ timeout: 8_000 });

    // Restore the original primary so seed state (and deletability) is recovered.
    await openDetail(page, original);
    await page.getByRole('button', { name: 'Make primary site' }).click();
    await expect(page.getByText(/is now primary/i)).toBeVisible({ timeout: 10_000 });

    await page.goto('/settings/sites?view=table');
    await deleteSecondary(page, name);
  });
});

// ── domain connection ─────────────────────────────────────────────────────────

test.describe('/settings/sites — custom domain connection', () => {
  test('connecting a domain shows DNS instructions', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Domain ${stamp}`;
    const slug = `e2edom${stamp}`;
    // Realistic-looking host; the API validates format but not actual DNS.
    const host = `shop${stamp}.example.com`;

    await page.goto('/settings/sites?view=table');
    await createSecondary(page, name, slug);

    await openDetail(page, name);
    await page.getByRole('tab', { name: /Domains/ }).click();

    await page.getByLabel('Connect a domain you own').fill(host);
    await page.getByRole('button', { name: 'Connect' }).click();

    // The domain row appears with its DNS instructions (after the connect action
    // resolves and the tab refreshes).
    await expect(page.getByText(host)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('CNAME')).toBeVisible({ timeout: 5_000 });

    // Deleting the site cascades and removes the domain — no separate disconnect.
    await page.goto('/settings/sites?view=table');
    await deleteSecondary(page, name);
  });
});
