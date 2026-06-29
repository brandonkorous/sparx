import { ResourceForm } from '../_components/resource-form';

// Full-page surface for creating a resource. The surface-aware `ResourceForm`
// renders the SAME SurfaceFrame here (`presentation="page"`) and inside the
// `@detail` drawer/modal overlay (`presentation="overlay"`). No page-level
// Container/PageHeader — the embedded frame supplies the title.

export const dynamic = 'force-dynamic';

export default function NewResourcePage() {
  return <ResourceForm presentation="page" />;
}
