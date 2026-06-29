import { PolicyForm } from '../_components/policy-form';

// Full-page surface for creating a booking policy. The surface-aware `PolicyForm`
// renders the SAME SurfaceFrame here (`presentation="page"`) and inside the
// `@detail` drawer/modal overlay (`presentation="overlay"`). No page-level
// Container/PageHeader — the embedded frame supplies the title.

export const dynamic = 'force-dynamic';

export default function NewPolicyPage() {
  return <PolicyForm presentation="page" />;
}
