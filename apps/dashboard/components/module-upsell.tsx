import Link from 'next/link';
import { Lock } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  EmptyState,
  Grid,
  Heading,
  ModuleProvider,
  Stack,
  Text,
} from '@sparx/ui';
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
      <Container size="xl">
        <Stack gap={8} className="py-10">
          <Stack gap={2}>
            <Stack direction="row" align="center" gap={2}>
              <span aria-hidden className="text-[var(--module-active)]">
                <Icon className="h-5 w-5" />
              </span>
              <Heading level={1}>{title}</Heading>
              <Badge color="module" variant="soft">
                Not in your plan
              </Badge>
            </Stack>
            <Text variant="muted">{tagline}</Text>
          </Stack>

          <EmptyState
            icon={<Lock className="h-5 w-5" />}
            title={`Activate ${title} to unlock this area`}
            description={description}
            action={
              canActivate ? (
                <Button asChild color="module" variant="solid">
                  <Link href="/settings/modules">Activate {title}</Link>
                </Button>
              ) : (
                <Text size="sm" variant="muted">
                  Ask a workspace owner or admin to activate {title}.
                </Text>
              )
            }
          />

          <Stack gap={3}>
            <Heading level={3}>What you get with {title}</Heading>
            <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
              {features.map((f) => (
                <Card key={f.title} variant="module">
                  <CardHeader>
                    <CardTitle>{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Text size="sm" variant="muted">
                      {f.description}
                    </Text>
                  </CardContent>
                </Card>
              ))}
            </Grid>
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
