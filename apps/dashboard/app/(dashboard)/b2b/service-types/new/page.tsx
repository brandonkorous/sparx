import { ServiceTypeForm } from '../_components/service-type-form';

// Full-page surface for creating a B2B service type. The surface-aware
// `ServiceTypeForm` renders the SAME SurfaceFrame here (`presentation="page"`)
// and inside the `@detail` drawer/modal overlay (`presentation="overlay"`). No
// page-level Container/PageHeader — the embedded frame supplies the title.

export const dynamic = 'force-dynamic';

export default function NewServiceTypePage() {
  return <ServiceTypeForm presentation="page" />;
}
