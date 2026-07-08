import { Badge, Card, CardBody, CardTitle, EmptyState } from 'silicaui-react';
import { Sparkles } from 'lucide-react';

export interface ModuleStubProps {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  description: string;
  features: { title: string; description: string }[];
}

// Shared scaffolding for module landing pages while their real UI is unbuilt.
// Each page wraps this in <ModuleProvider module="..."> so the badge, card
// stripes, and link color all pick up the module's accent automatically.
export function ModuleStub({ icon, title, tagline, description, features }: ModuleStubProps) {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-10">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center gap-2">
            <span aria-hidden className="text-module">
              {icon}
            </span>
            <h1 className="text-3xl font-semibold">{title}</h1>
            <Badge color="module">Module preview</Badge>
          </div>
          <p className="text-base-content/70">{tagline}</p>
        </div>

        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title={`${title} is coming online`}
          description={description}
        />

        <div className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold">What ships in this module</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="bg-module bg-soft">
                <CardBody>
                  <p className="opacity-70">Planned</p>
                  <CardTitle>{f.title}</CardTitle>
                  <p className="text-base-content/70 text-sm">{f.description}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
