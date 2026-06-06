// /builder — the Builder overview/landing (docs/54 §13 step 2). Two paths:
// "Start from a blueprint" links the platform Marketplace in-context (the
// Marketplace stays platform-pinned — this is an entry point, not a move), and a
// grid of the build-it-yourself surfaces. Replaces the old redirect to
// /builder/page.
//
// The builder layout is gate-only (no ModuleProvider, so the editor's full-height
// shell isn't disturbed), so this standard page supplies its own module color.

import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Component,
  File,
  Fingerprint,
  Globe,
  LayoutTemplate,
  Mail,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Container,
  Grid,
  Heading,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

const SURFACES = [
  {
    href: '/builder/brand',
    icon: Fingerprint,
    title: 'Brand',
    description: 'Your identity — colors, type, logo, and rounding the whole site renders in.',
  },
  {
    href: '/builder/site',
    icon: Globe,
    title: 'Site',
    description: 'The site shell: header, footer, navigation, and page layouts.',
  },
  {
    href: '/builder/page',
    icon: File,
    title: 'Page',
    description: 'Design page templates on the visual canvas, bound to your content and catalog.',
  },
  {
    href: '/builder/email',
    icon: Mail,
    title: 'Email',
    description: 'Build branded emails as composable node trees, ready to broadcast.',
  },
  {
    href: '/builder/components',
    icon: Component,
    title: 'Components',
    description: 'Reusable building blocks — primitives and your own saved components.',
  },
] as const;

export default async function BuilderOverviewPage() {
  // Teaser the blueprint catalog in-context (count + a few names). Degrades to a
  // plain CTA if the catalog read fails.
  let teaser: { count: number; names: string[] } | null = null;
  try {
    const { blueprints } = await api.get<{ blueprints: { name: string }[] }>('/v1/blueprints');
    teaser = { count: blueprints.length, names: blueprints.slice(0, 4).map((b) => b.name) };
  } catch {
    teaser = null;
  }

  return (
    <ModuleProvider module="builder">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Boxes className="h-5 w-5" />}
            title="Builder"
            description="Design your site, pages, emails, and components. Start from a ready-made template, or build each surface yourself."
          />

          {/* Start from a blueprint — the in-context entry point to the platform
              Marketplace (docs/54). */}
          <Card variant="module">
            <CardHeader>
              <Stack direction="row" align="center" gap={2}>
                <LayoutTemplate className="h-5 w-5 text-[var(--module-active)]" />
                <CardTitle>Start from a blueprint</CardTitle>
              </Stack>
              <CardDescription>
                Install a fully themed starting point — site, pages, products, content, and emails —
                onto your site as drafts. Review, customize, then go live.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Stack gap={4}>
                {teaser && teaser.count > 0 ? (
                  <Text size="sm" variant="muted">
                    {teaser.count} ready-made {teaser.count === 1 ? 'blueprint' : 'blueprints'} —{' '}
                    {teaser.names.join(', ')}
                    {teaser.count > teaser.names.length ? ', and more' : ''}.
                  </Text>
                ) : null}
                <div>
                  <Button color="module" asChild>
                    <Link href="/marketplace">
                      Browse the marketplace
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Stack>
            </CardContent>
          </Card>

          {/* Build it yourself — the Builder surfaces. */}
          <Stack gap={3}>
            <Heading level={3}>Or build it yourself</Heading>
            <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
              {SURFACES.map(({ href, icon: Icon, title, description }) => (
                <Card key={href} variant="module">
                  <CardHeader>
                    <Stack direction="row" align="center" gap={2}>
                      <Icon className="h-4 w-4 text-[var(--module-active)]" />
                      <CardTitle>{title}</CardTitle>
                    </Stack>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button color="module" variant="outline" size="sm" asChild>
                      <Link href={href}>Open {title.toLowerCase()}</Link>
                    </Button>
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
