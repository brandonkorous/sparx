import { ModuleProvider } from '@sparx/ui';
import { getConfig, getSitePreviewToken, getTenant } from './_lib/api';
import { storefrontOrigin } from './_lib/storefront';
import { EditorShell } from './_components/editor-shell';
import { requireModuleOrUpsell } from '../../../components/module-gate';

// Site Builder editor shell (Phase 2 §2). The contextual-panel module nav
// switches the child route (= the inspector for a scope); this layout — and the
// EditorShell's persistent canvas iframe — stay mounted across those switches,
// so the live preview never reloads when hopping scopes. Scopes that don't want
// a preview (Brand, Publishing) render full-width inside the shell. The data the
// canvas needs (tenant slug, storefront origin, draft preview token) is resolved
// once here rather than per scope page.
export default async function SitebuilderLayout({ children }: { children: React.ReactNode }) {
  // Legacy Site Builder is a surface of the billable `builder` module — gate on
  // it (and bail before the editor data fetch) so a tenant without Builder gets
  // the activation upsell, not a half-loaded editor.
  const upsell = await requireModuleOrUpsell('builder');
  if (upsell) return upsell;

  const [tenant, config, previewToken] = await Promise.all([
    getTenant(),
    getConfig(),
    getSitePreviewToken(),
  ]);
  const initialMode = config.appearancePolicy === 'dark-only' ? 'dark' : 'light';

  return (
    <ModuleProvider module="storefront">
      {/* Deprecation banner — the Site Builder is superseded by the Builder
          (/builder). Brand authoring already forwards there; pages + layouts are
          edited in /builder/page and /builder/site. Kept live for version history
          + rollback during the transition. */}
      <div className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">
        <strong className="text-[var(--color-text-primary)]">Deprecated.</strong> The Site Builder
        is being replaced by the{' '}
        <a className="font-medium underline" href="/builder">
          Builder
        </a>{' '}
        — edit pages, layouts, and brand there.
      </div>
      <EditorShell
        slug={tenant.slug}
        storefrontUrl={storefrontOrigin(tenant.slug)}
        previewToken={previewToken}
        initialMode={initialMode}
        isPublished={config.publishedVersionId !== null}
      >
        {children}
      </EditorShell>
    </ModuleProvider>
  );
}
