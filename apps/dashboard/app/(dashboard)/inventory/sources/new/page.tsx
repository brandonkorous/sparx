import { SourceForm } from '../_components/source-form';

// Full-page surface for connecting an inventory source. The surface-aware
// `SourceForm` renders the SAME SurfaceFrame here (`presentation="page"`) and
// inside the `@detail` drawer/modal overlay (`presentation="overlay"`). No
// page-level Container/PageHeader — the embedded frame supplies the title.

export const dynamic = 'force-dynamic';

export default function NewSourcePage() {
  return <SourceForm presentation="page" />;
}
