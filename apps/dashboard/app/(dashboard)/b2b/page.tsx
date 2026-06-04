import { ModuleStub } from '../../../components/module-stub';
import { moduleCatalog } from '../../../components/module-catalog';

// B2B is gated at the layout: a tenant without the module sees the upsell, so
// this page only renders when B2B is active — the "coming online" preview until
// the real UI ships. Copy comes from the shared catalog.
export default function B2bPage() {
  const { Icon, title, tagline, description, features } = moduleCatalog.b2b;
  return (
    <ModuleStub
      icon={<Icon className="h-5 w-5" />}
      title={title}
      tagline={tagline}
      description={description}
      features={features}
    />
  );
}
