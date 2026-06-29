import { ServiceForm } from '../_components/service-form';

// Full-page surface for creating a service. The surface-aware `ServiceForm`
// (docs/86 F layout) renders the SAME SurfaceFrame here (`presentation="page"` →
// the `embedded` contained sheet) and inside the `@detail` drawer/modal overlay
// (`presentation="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences, deep links, and the overlay's "maximize" button resolve to — no
// page-level Container/PageHeader, so the title isn't rendered twice.

export const dynamic = 'force-dynamic';

export default function NewServicePage() {
  return <ServiceForm presentation="page" />;
}
