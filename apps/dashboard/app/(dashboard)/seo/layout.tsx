import { ModuleProvider } from '@sparx/ui';

// SEO is a platform surface (always-on, not a separately-billed module), so this
// layout adds NO ModuleGate — it only supplies SEO's Yellow color to every
// /seo/* route (the overview, the audits list, the per-entity report) via
// ModuleProvider, matching how the gated module layouts set their accent.
export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <ModuleProvider module="seo">{children}</ModuleProvider>;
}
