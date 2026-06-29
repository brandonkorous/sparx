import { SupplierCreateForm } from '../_components/supplier-create-form';

// New-supplier route. The embedded SurfaceFrame supplies its own title + window
// controls + pinned toolbar, so the page renders the form bare (no Container /
// PageHeader). The same form also renders in the drawer/modal overlay via
// `detail-slot.tsx`'s `createComponents['supplier']`, honoring the user's
// `defaultDetailView` preference.

export const dynamic = 'force-dynamic';

export default function NewSupplierPage() {
  return <SupplierCreateForm surface="page" />;
}
