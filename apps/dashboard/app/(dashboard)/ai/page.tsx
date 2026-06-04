import { ModuleStub } from '../../../components/module-stub';
import { moduleCatalog } from '../../../components/module-catalog';

// AI is gated at the layout: a tenant without the module sees the upsell, so
// this page only renders when AI is active — the "coming online" preview until
// the real UI ships. Copy comes from the shared catalog.
export default function AiPage() {
  const { Icon, title, tagline, description, features } = moduleCatalog.ai;
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
