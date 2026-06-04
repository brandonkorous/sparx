import type { Metadata } from 'next';
import type { BindingCatalog, BuilderEmailDto } from '@sparx/builder-schemas';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/site-themes';

import { getBrand, getConfig } from '../_brand/lib/api';
import { listEmails } from '../_lib/api';
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
// the body previews in the real brand. Phase 1 is STATIC — the editor receives an
// EMPTY binding catalog (the static slice has no data-aware components yet, docs/52
// §9), so nothing binds.

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

// The tenant's emails (the list endpoint seeds the curated starter set on first
// load). Defensive: a failed read yields [] so the route shows a recoverable
// message rather than 500.
async function loadEmails(): Promise<BuilderEmailDto[]> {
  try {
    return await listEmails();
  } catch {
    return [];
  }
}

// Phase 1 (static) passes an EMPTY catalog — no data-aware email components exist
// yet, so nothing binds. The EMAIL_CATALOG shape is wired in Phase 4 alongside the
// data resolver.
const EMPTY_CATALOG: BindingCatalog = { sources: [] };

export default async function BuilderEmailRoute() {
  const [themeCss, emails] = await Promise.all([canvasThemeCss(), loadEmails()]);
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
      <EmailBuilderApp initialEmails={emails} bindingCatalog={EMPTY_CATALOG} />
    </>
  );
}
