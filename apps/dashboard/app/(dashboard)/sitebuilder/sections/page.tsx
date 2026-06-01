import { listCustomDefinitions } from '../_lib/api';
import { SectionsIndex } from '../_components/sections-index';

// Section Studio index (docs/38 Phase C; docs/handoffs/sitebuilder-section-studio-design.md).
// The tenant's custom section TYPES — a full-width catalog in the editor shell
// (the Studio uses its own preview, not the storefront canvas). Each row opens
// the authoring editor at /sitebuilder/sections/<slug>; "New section" → /new.
export default async function SectionStudioIndexPage() {
  const definitions = await listCustomDefinitions();
  return <SectionsIndex definitions={definitions} />;
}
