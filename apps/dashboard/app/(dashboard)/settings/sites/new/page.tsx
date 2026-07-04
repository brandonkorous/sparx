import { NewSiteWizard } from '../new-site-wizard';
import { loadNewSiteData } from './wizard-data';

// Full-page surface for creating a site — the `embedded` New-site wizard (docs/86)
// inside the dashboard chrome. On the Sites list the "New site" affordance opens
// this SAME wizard inside the drawer/modal detail chrome (the `overlay`
// presentation), picked by the user's `defaultDetailView`. This route is the
// full-page option that chrome's "open in full page" button, Shift-click, and
// new-tab resolve to. No Container/PageHeader — the embedded frame supplies the title.

export const dynamic = 'force-dynamic';

export default async function NewSitePage() {
  const data = await loadNewSiteData();
  return <NewSiteWizard presentation="page" {...data} />;
}
