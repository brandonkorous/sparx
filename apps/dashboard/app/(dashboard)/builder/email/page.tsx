import type { Metadata } from 'next';
import type { BindingCatalog, BuilderEmailDto } from '@sparx/builder-schemas';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/site-themes';

import { getBrand, getConfig, getTenant } from '../_brand/lib/api';
import { getEmailBindingCatalog, listEmails, listEmailsForProperty } from '../_lib/api';
import { resolveSiteScope } from '@/lib/sites';
import { EmailBuilderApp } from '../_builder/email-builder-app';
import '../builder.css';
// The Surface RECIPE — same canvas-scoped sheet the page/site editors load, so a
// node authored with a Color/Variant renders live on the canvas (docs/47 §5).
import '@sparx/site-ui/styles.canvas.css';

// /builder/email — the Email Builder (docs/52): edit an email as ONE self-
// contained body tree, with the same editor brain as /builder/page. A tenant
// keeps a catalog of emails; the list endpoint seeds the starter set on first use.
//
// Like the page editor, we compile the tenant brand to CSS scoped to the canvas so
// the body previews in the real brand. The editor receives the EMAIL binding
// catalog (docs/52 §7) — recipient / order / cart / loyalty / products / promotion
// plus the tenant's CMS collections — so nodes can bind to per-recipient and
// per-send data (the true render resolves it at preview/send, docs/52 §9 P4).

export const metadata: Metadata = {
  title: 'Builder · Email',
};

// Compile the tenant brand to CSS scoped to `.bx-canvas`. Defensive: a failed
// read returns '' and the canvas falls back to its built-in studio brand.
async function canvasThemeCss(): Promise<string> {
  try {
    const [brand, config] = await Promise.all([getBrand(), getConfig()]);
    const compiled = compileThemeForTenant({
      themeKey: config.themeKey,
      brand,
      presentation: config.draftSettings.presentation ?? null,
    });
    return buildThemeCssV2(compiled, { rootSelector: '.bx-canvas' });
  } catch {
    return '';
  }
}

// The emails the editor opens. For a single-site tenant (or when the site list
// can't be read) this is the tenant-wide catalog (listOrSeed seeds the curated
// starter set on first load). For a MULTI-site tenant it's the ACTIVE site's view
// (docs/49 Phase 7b) — the tenant defaults with this site's overrides swapped in —
// so switching sites in the breadcrumb re-scopes the editor. Defensive: any failed
// read falls back to the tenant-wide list, then to [] (a recoverable message).
async function loadEmails(propertyId: string | undefined): Promise<BuilderEmailDto[]> {
  try {
    return propertyId ? await listEmailsForProperty(propertyId) : await listEmails();
  } catch {
    try {
      return await listEmails();
    } catch {
      return [];
    }
  }
}

// What an email can bind to (docs/52 §7). Defensive: a failed read yields an empty
// catalog — the editor still runs, bindings just resolve to placeholders.
async function loadCatalog(): Promise<BindingCatalog> {
  try {
    return await getEmailBindingCatalog();
  } catch {
    return { sources: [] };
  }
}

// The tenant's sending identity for the canvas inbox-envelope `From` row. The
// name is the brand's business name; the address is the tenant's default Sparx
// sending subdomain (`<slug>.sparx.email` — docs/13). Defensive: a failed read
// yields a neutral label so the envelope still renders.
async function loadSender(): Promise<{ name: string; address: string | null }> {
  try {
    const [brand, tenant] = await Promise.all([getBrand(), getTenant()]);
    const trimmed = brand.businessName?.trim() ?? '';
    const name = trimmed.length > 0 ? trimmed : 'Your store';
    const address = tenant.slug ? `hello@${tenant.slug}.sparx.email` : null;
    return { name, address };
  } catch {
    return { name: 'Your store', address: null };
  }
}

export default async function BuilderEmailRoute() {
  // The active site (docs/49): a multi-site tenant authors ONE site at a time
  // (the breadcrumb switcher's cookie); a single-site tenant gets `undefined` and
  // the tenant-wide catalog, unchanged. `multiSite` gates the per-site editor
  // affordances (the "Customize for this site" fork + the override badge).
  const scope = await resolveSiteScope().catch(() => null);
  const activePropertyId = scope?.activePropertyId;
  const activeSite =
    scope && activePropertyId ? scope.sites.find((s) => s.id === activePropertyId) : undefined;

  const [themeCss, emails, catalog, sender] = await Promise.all([
    canvasThemeCss(),
    loadEmails(activePropertyId),
    loadCatalog(),
    loadSender(),
  ]);
  if (emails.length === 0) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-12 text-center text-sm text-[var(--color-text-muted)]">
          Couldn’t load your emails. Check that the Builder module is enabled, then reload.
        </div>
      </div>
    );
  }
  return (
    <>
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <EmailBuilderApp
        initialEmails={emails}
        bindingCatalog={catalog}
        senderName={sender.name}
        senderAddress={sender.address}
        site={
          activePropertyId && activeSite
            ? { propertyId: activePropertyId, name: activeSite.name }
            : undefined
        }
      />
    </>
  );
}
