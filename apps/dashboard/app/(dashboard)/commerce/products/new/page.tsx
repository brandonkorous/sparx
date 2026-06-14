import { ProductWizard } from '../_components/product-wizard';

// Full-page surface for creating a product. The comprehensive WizardFrame flow
// (docs/68, docs/86) owns the viewport as a full-screen overlay — it creates a
// draft on the first step and walks the merchant through its relations. The
// "New product" affordance routes here (the entity has no overlay create form,
// so EntityCreateButton falls back to this route).

export default function NewProductPage() {
  return <ProductWizard />;
}
