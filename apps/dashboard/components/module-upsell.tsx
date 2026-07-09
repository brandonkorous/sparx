import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardTitle, EmptyState } from '@wizeworks/silicaui-react';
import { ModuleProvider } from '@sparx/ui';
import type { ModuleSlug } from '@sparx/auth';

import { moduleCatalog } from './module-catalog';

// Module upsell — what a tenant sees when they reach a module's dashboard area
// without that module active. The product counterpart to the API's 404: the
// API hides a disabled module's URL space entirely, but the owner-facing
// dashboard keeps its chrome and converts the dead end into an activation
// prompt (docs/24 §5; CLAUDE.md "modules are feature-flagged").
//
// `canActivate` mirrors the modules settings page: only owners/admins can flip
// activation, so only they get the CTA — everyone else is told who to ask. The
// CTA routes to /settings/modules for now (the activation toggle lives there);
// when self-serve billing lands this becomes a direct "add to your plan" flow.
//
// Wraps itself in <ModuleProvider> so it adopts the module's accent color even
// when rendered outside a module-colored layout (e.g. the Builder editor, which
// has no surrounding provider).

export function ModuleUpsell({
  module,
  canActivate,
}: {
  module: ModuleSlug;
  canActivate: boolean;
}) {
  const { Icon, title, tagline, description, features } = moduleCatalog[module];

  return (
    <ModuleProvider module={module}>
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-10">
          <div className="flex flex-col gap-2">
            <div className="flex flex-row items-center gap-2">
              <span aria-hidden className="text-module">
                <Icon className="h-5 w-5" />
              </span>
              <h1 className="text-3xl font-semibold">{title}</h1>
              <Badge color="module" variant="soft">
                Not in your plan
              </Badge>
            </div>
            <p className="text-base-content/70">{tagline}</p>
          </div>

          <EmptyState
            icon={<Lock className="h-5 w-5" />}
            title={`Activate ${title} to unlock this area`}
            description={description}
            actions={
              canActivate ? (
                <Button color="module" variant="solid" render={<Link href="/settings/modules" />}>
                  Activate {title}
                </Button>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Ask a workspace owner or admin to activate {title}.
                </p>
              )
            }
          />

          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-semibold">What you get with {title}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <Card key={f.title} className="bg-module bg-soft">
                  <CardBody>
                    <CardTitle>{f.title}</CardTitle>
                    <p className="text-base-content/70 text-sm">{f.description}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModuleProvider>
  );
}
