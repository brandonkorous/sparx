import { TierCreateForm } from '../_components/tier-create-form';

// Full-page surface for creating a B2B pricing tier. The surface-aware
// `TierCreateForm` renders the SAME SurfaceFrame here (`presentation="page"`)
// and inside the `@detail` drawer/modal overlay (`presentation="overlay"`). No
// page-level Container/PageHeader — the embedded frame supplies the title.

export const dynamic = 'force-dynamic';

export default function NewPricingTierPage() {
  return <TierCreateForm presentation="page" />;
}
