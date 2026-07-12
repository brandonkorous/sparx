// Shared "render a marketing module page" helper. Used by every
// /<module>/page.tsx route on the marketing site. The page data comes from the
// hand-coded TS in lib/modules.ts (via loadModuleData) — module pages were
// briefly CMS-backed via a `module` content type, but that type was reclassified
// into builder components (docs/51 §7), so the static map is authoritative.
//
// Each marketing route is a one-liner above this:
//
//   export const generateMetadata = makeMetadata('builder');
//   export default makePage('builder');

import type { Metadata } from 'next';
import { ModulePage } from '@/components/marketing/module-page';
import { loadModuleData } from '@/lib/load-module-data';
import type { ModulePageSlug } from '@/lib/modules';

type ModuleKey = ModulePageSlug;

export function makeMetadata(slug: ModuleKey) {
  return function generateMetadata(): Metadata {
    const meta = loadModuleData(slug);
    return {
      title: meta.title,
      description: meta.description,
      alternates: { canonical: `/${meta.slug}` },
      openGraph: {
        title: meta.title,
        description: meta.description,
        url: `https://sparx.works/${meta.slug}`,
        siteName: 'sparx',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: meta.title,
        description: meta.description,
      },
    };
  };
}

export function makePage(slug: ModuleKey) {
  return function ModulePageRoute() {
    const meta = loadModuleData(slug);
    return <ModulePage meta={meta} />;
  };
}
