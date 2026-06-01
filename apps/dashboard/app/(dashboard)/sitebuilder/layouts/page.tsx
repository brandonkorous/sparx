import { STATIC_LAYOUT_TARGETS } from '@sparx/sitebuilder-schemas';
import { listLayoutDefaults, listPageLayouts, resolvePageLayout } from '../_lib/api';
import { LayoutsIndex, type TargetGroupData } from '../_components/layouts-index';

// The unified Layouts surface (docs/36 §11, P-D). Renders full-width in the
// editor shell (the index is a catalog, not a canvas scope — its `/:id` children
// are the editors). One group per static layout target — Homepage, Product pages,
// Collection pages, Pages — each listing the tenant's PageLayouts + the per-target
// default. The homepage layout is resolve-or-created on load so it always has an
// editable row (idempotent, like the old Homepage scope).
export default async function LayoutsIndexPage() {
  await resolvePageLayout('site:home');

  const [layouts, defaults] = await Promise.all([listPageLayouts(), listLayoutDefaults()]);
  const defaultByTarget = new Map(defaults.map((d) => [d.targetId, d.pageLayoutId]));

  const groups: TargetGroupData[] = STATIC_LAYOUT_TARGETS.map((t) => ({
    targetId: t.id,
    label: t.label,
    binding: t.binding ?? null,
    layouts: layouts
      .filter((l) => l.targetId === t.id)
      .map((l) => ({ id: l.id, key: l.key, name: l.name })),
    defaultLayoutId: defaultByTarget.get(t.id) ?? null,
  }));

  return <LayoutsIndex groups={groups} />;
}
