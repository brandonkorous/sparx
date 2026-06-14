import { ProductWizard } from '../_components/product-wizard';

// Full-page surface for creating a product. The comprehensive WizardFrame flow
// (docs/68, docs/86) owns the viewport as a full-screen overlay — it creates a
// draft on the first step and walks the merchant through its relations.
//
// On the products list the "New" affordance opens this same wizard inside the
// dashboard's drawer/modal detail chrome, picked by the user's `defaultDetailView`
// preference (the `'overlay'` presentation; see `EntityCreateButton` + the
// `@detail` create registry). This route is the full-page option that chrome's
// "open in full page" button, Shift-click, new-tab, and deep links resolve to.

export default function NewProductPage() {
  return <ProductWizard presentation="page" />;
}
