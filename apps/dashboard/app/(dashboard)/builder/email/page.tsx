import type { Metadata } from 'next';
import { buildThemeCssV2, compileThemeForTenant } from '@sparx/site-themes';

import { getBrand, getConfig } from '../_brand/lib/api';
import { loadEmailSurfaceData } from '../_lib/email-surface-data';
import { EmailBuilderApp } from '../_builder/email-builder-app';
import '../builder.css';
// The Surface RECIPE — same canvas-scoped sheet the page/site editors load, so a
// node authored with a Color/Variant renders live on the canvas (docs/47 §5).
import '@sparx/site-ui/styles.canvas.css';

// /builder/email — the Email Builder (docs/52): edit an email as ONE self-
// contained body tree, with the same editor brain as /builder/page. A tenant
// keeps a catalog of emails; the list endpoint seeds the starter set on first use.
//
// The per-site brand merge, the email-exact canvas theme, and the sender identity
// are loaded by the shared `loadEmailSurfaceData` (also used by the unified studio's
// Email sibling surface — docs/builder/03 §2.7), so that load-bearing logic lives
// in one place.

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

export default async function BuilderEmailRoute() {
  const [themeCss, email] = await Promise.all([canvasThemeCss(), loadEmailSurfaceData()]);
  if (email.kind === 'empty') {
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
      {/* The email-brand override (docs/93) — after the site theme so it wins for
          the email canvas: its fonts / hairlines / accent match the real send. */}
      {email.emailBrandCss ? (
        <style dangerouslySetInnerHTML={{ __html: email.emailBrandCss }} />
      ) : null}
      <EmailBuilderApp {...email.props} />
    </>
  );
}
