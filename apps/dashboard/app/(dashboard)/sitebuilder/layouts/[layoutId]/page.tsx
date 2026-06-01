import { notFound } from 'next/navigation';
import { getLayoutTarget } from '@sparx/sitebuilder-schemas';
import { getPageLayout, listSectionsByPageLayout } from '../../_lib/api';
import { PageLayoutEditor } from '../../_components/page-layout-editor';

// The per-layout canvas editor (docs/36 §11, P-D). A canvas scope: the editor
// shell shows the live storefront beside the docked SectionBuilder. Loads the
// layout by id (404 → notFound) + its sections, then resolves the target for the
// binding/label the canvas wiring needs.
export default async function LayoutEditorPage({
  params,
}: {
  params: Promise<{ layoutId: string }>;
}) {
  const { layoutId } = await params;
  const layout = await getPageLayout(layoutId).catch(() => null);
  if (!layout) notFound();

  const sections = await listSectionsByPageLayout(layout.id);
  const target = getLayoutTarget(layout.targetId);

  return (
    <PageLayoutEditor
      layout={layout}
      binding={target?.binding ?? null}
      targetLabel={target?.label ?? layout.targetId}
      sections={sections}
    />
  );
}
