// savedThemeService — the tenant's named theme variants (docs/36 Brand+Theme
// tier) and the scheduled-publish theme swap. Covers CRUD, ownership (RLS →
// NotFound), `apply` loading a saved theme into the working draft, and a
// scheduled publish that applies its theme before snapshotting.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  publishService,
  savedThemeService,
  scheduleService,
  themeService,
} from '../../src/services/index.js';
import { SitebuilderNotFoundError } from '../../src/errors.js';
import {
  addSecondaryProperty,
  disposeTestContext,
  makeTestContext,
  readPropertyBrandOverride,
  readTenantBrand,
  type TestContext,
} from '../helpers.js';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('sitebuilder saved themes', () => {
  let test: TestContext;
  let summerId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('create — saves a named presentation variant + brand snapshot; list is sorted by name', async () => {
    const summer = await savedThemeService.create(test.ctx, {
      name: 'Summer',
      basePresetKey: 'apex',
      presentation: { containerWidth: '1200px' },
      brand: { colorPrimary: '#ff5a1f', fontHeading: 'Poppins' },
    });
    summerId = summer.id;
    expect(summer.name).toBe('Summer');
    expect(summer.basePresetKey).toBe('apex');
    expect(summer.presentation.containerWidth).toBe('1200px');
    // The captured brand "look" round-trips (docs/33 self-contained themes).
    expect(summer.brand?.colorPrimary).toBe('#ff5a1f');
    expect(summer.brand?.fontHeading).toBe('Poppins');

    await savedThemeService.create(test.ctx, {
      name: 'Holiday',
      basePresetKey: 'industrial',
      presentation: { containerWidth: '1320px' },
      brand: { colorPrimary: '#0a7d2b' },
    });

    const list = await savedThemeService.list(test.ctx);
    expect(list.map((t) => t.name)).toEqual(['Holiday', 'Summer']);
  });

  it('update — renames and replaces the presentation + brand', async () => {
    const updated = await savedThemeService.update(test.ctx, summerId, {
      name: 'Summer Sale',
      presentation: { containerWidth: '1280px' },
      brand: { colorPrimary: '#2f7d32' },
    });
    expect(updated.name).toBe('Summer Sale');
    expect(updated.presentation.containerWidth).toBe('1280px');
    // Brand edits write back into the snapshot ("select and tweak").
    expect(updated.brand?.colorPrimary).toBe('#2f7d32');
  });

  it('apply — loads the saved theme into the working draft (theme + presentation + brand), no publish', async () => {
    const result = await savedThemeService.apply(test.ctx, summerId);
    expect(result).toEqual({ ok: true, themeKey: 'apex' });

    const config = await themeService.getConfig(test.ctx);
    expect(config.themeKey).toBe('apex');
    const draft = config.draftSettings as {
      presentation?: { containerWidth?: string };
      activeSavedThemeId?: string;
    };
    expect(draft.presentation?.containerWidth).toBe('1280px');
    // The applied theme is pinned so the dashboard rail restores the selection.
    expect(draft.activeSavedThemeId).toBe(summerId);
    // Apply also lands the captured brand look — on the PRIMARY site that's the
    // tenant BASE brand (the fix: a headless apply must colour the site, not just
    // stage its surfaces, or the theme "doesn't apply" in the brand designer).
    const brand = await readTenantBrand(test.tenant.tenantId);
    expect(brand?.colorPrimary).toBe('#2f7d32');
    // Not published — apply only stages the draft.
    expect(config.publishedVersionId).toBeNull();
  });

  it('scheduled publish — applies the schedule’s theme before snapshotting', async () => {
    const holiday = (await savedThemeService.list(test.ctx)).find((t) => t.name === 'Holiday');
    expect(holiday).toBeTruthy();

    const scheduled = await scheduleService.schedule(test.ctx, {
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
      note: 'go live for the holidays',
      themeId: holiday!.id,
    });
    expect(scheduled.status).toBe('pending');

    const result = await scheduleService.processDueSchedule(test.ctx, scheduled.id);
    expect(result.status).toBe('published');
    // The schedule pointed at the Holiday theme (industrial) — the published
    // version carries it, even though the draft was on apex from the apply test.
    expect(result.version?.themeKey).toBe('industrial');

    const config = await themeService.getConfig(test.ctx);
    expect(config.themeKey).toBe('industrial');

    // The Holiday theme captured its own brand; the scheduled swap applies it to
    // the tenant brand, so the storefront — which compiles brand live — recolours
    // (not just the surface overlay). compiledV2 reflects the applied primary.
    const snapshot = await publishService.getPublishedSnapshot(test.ctx);
    expect(snapshot?.compiledV2?.light.primary).toBe('#0a7d2b');
  });

  it('remove — deletes the variant', async () => {
    const removed = await savedThemeService.remove(test.ctx, summerId);
    expect(removed.id).toBe(summerId);
    const list = await savedThemeService.list(test.ctx);
    expect(list.map((t) => t.name)).toEqual(['Holiday']);
  });

  it('ownership — update/apply/remove of an unknown id rejects (RLS → NotFound)', async () => {
    await expect(
      savedThemeService.update(test.ctx, MISSING_ID, { name: 'x' })
    ).rejects.toBeInstanceOf(SitebuilderNotFoundError);
    await expect(savedThemeService.apply(test.ctx, MISSING_ID)).rejects.toBeInstanceOf(
      SitebuilderNotFoundError
    );
    await expect(savedThemeService.remove(test.ctx, MISSING_ID)).rejects.toBeInstanceOf(
      SitebuilderNotFoundError
    );
  });
});

describe('sitebuilder saved theme apply — brand scope (docs/49)', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('non-primary site — the theme brand lands on the site override, not the tenant base', async () => {
    // A distinctive brand so the assertions can't pass by coincidence.
    const theme = await savedThemeService.create(test.ctx, {
      name: 'Sitewear',
      basePresetKey: 'drift',
      presentation: { containerWidth: '1100px' },
      brand: { colorPrimary: '#123456', fontBody: 'Georgia' },
    });
    // The fresh tenant hasn't applied anything to its primary site, so its base
    // brand is empty — the negative assertion below proves the non-primary apply
    // left it that way.
    const baseBefore = await readTenantBrand(test.tenant.tenantId);

    const secondary = await addSecondaryProperty(test);
    const result = await savedThemeService.apply(secondary.ctx, theme.id);
    expect(result).toEqual({ ok: true, themeKey: 'drift' });

    // The site's OWN override carries the theme brand (recolours only this site)…
    const row = await readPropertyBrandOverride(test.tenant.tenantId, secondary.propertyId);
    const override = row?.brandOverride as { colorPrimary?: string; fontBody?: string } | null;
    expect(override?.colorPrimary).toBe('#123456');
    expect(override?.fontBody).toBe('Georgia');

    // …and the tenant BASE brand is untouched, so sibling sites don't recolour.
    const baseAfter = await readTenantBrand(test.tenant.tenantId);
    expect(baseAfter?.colorPrimary ?? null).toBe(baseBefore?.colorPrimary ?? null);
  });
});

describe('sitebuilder update_site_settings — identity media (logo/favicon)', () => {
  let test: TestContext;
  const LOGO = '11111111-1111-1111-8111-111111111111';
  const FAVICON = '22222222-2222-2222-8222-222222222222';

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('primary site — logo + favicon ids land on the tenant base brand', async () => {
    await themeService.updateSettings(test.ctx, {
      logoLightMediaId: LOGO,
      faviconMediaId: FAVICON,
    });
    const brand = await readTenantBrand(test.tenant.tenantId);
    expect(brand?.logoLightMediaId).toBe(LOGO);
    expect(brand?.faviconMediaId).toBe(FAVICON);
  });

  it('null clears one id; an omitted field is left as-is', async () => {
    await themeService.updateSettings(test.ctx, { logoLightMediaId: null });
    const brand = await readTenantBrand(test.tenant.tenantId);
    expect(brand?.logoLightMediaId ?? null).toBeNull(); // cleared
    expect(brand?.faviconMediaId).toBe(FAVICON); // untouched (undefined)
  });

  it('non-primary site — the id lands on the site override, not the tenant base', async () => {
    const secondary = await addSecondaryProperty(test);
    await themeService.updateSettings(secondary.ctx, { logoLightMediaId: LOGO });

    const row = await readPropertyBrandOverride(test.tenant.tenantId, secondary.propertyId);
    const override = row?.brandOverride as { logoLightMediaId?: string } | null;
    expect(override?.logoLightMediaId).toBe(LOGO);

    // The tenant base logo stays cleared (from the null test) — a sibling-site
    // logo change must not leak onto the base brand.
    const base = await readTenantBrand(test.tenant.tenantId);
    expect(base?.logoLightMediaId ?? null).toBeNull();
  });
});
