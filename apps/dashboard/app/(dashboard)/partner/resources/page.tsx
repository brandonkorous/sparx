import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, FileText, Presentation, Share2, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Button,
  Card,
  Container,
  Grid,
  Heading,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';
import type { SparxModule } from '@sparx/ui';

// Partner Portal — Resources (docs/114 §B.7/D7). The enablement hub: pitch + win
// clients, onboard them module by module, and run your referral toolkit. Not
// member-gated (a prospective partner can browse it), so no partner fetch. The
// module onboarding guides each wear their target module's hue via a nested
// ModuleProvider — a legit cross-module wayfinding moment, not decoration.

export const dynamic = 'force-dynamic';

interface Resource {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
  cta: string;
}

const PITCH: Resource[] = [
  {
    title: 'Partner pitch deck',
    description:
      'The story of Sparx for a client conversation — what it is, who it’s for, and why now.',
    icon: Presentation,
    href: 'https://sparx.works/partners',
    external: true,
    cta: 'Open deck',
  },
  {
    title: 'Client proposal template',
    description: 'A ready-to-brand proposal you can drop your scope and pricing into.',
    icon: FileText,
    href: 'https://sparx.works/partners',
    external: true,
    cta: 'Get template',
  },
  {
    title: 'One-pager & talking points',
    description: 'A single-page overview and the answers to the questions clients always ask.',
    icon: BookOpen,
    href: 'https://sparx.works/partners',
    external: true,
    cta: 'Read the brief',
  },
];

// Per-module onboarding guides — each links to that module's marketing page and
// wears its hue. The module keys drive the nested ModuleProvider tint.
const MODULE_GUIDES: { module: SparxModule; label: string; href: string; blurb: string }[] = [
  {
    module: 'commerce',
    label: 'Commerce',
    href: 'https://sparx.works/commerce',
    blurb: 'Catalog, checkout, and payments.',
  },
  {
    module: 'cms',
    label: 'CMS',
    href: 'https://sparx.works/cms',
    blurb: 'Pages, posts, and structured content.',
  },
  {
    module: 'crm',
    label: 'CRM',
    href: 'https://sparx.works/crm',
    blurb: 'Customers, pipelines, and segments.',
  },
  {
    module: 'email',
    label: 'Email',
    href: 'https://sparx.works/email',
    blurb: 'Broadcasts, flows, and deliverability.',
  },
  {
    module: 'b2b',
    label: 'B2B',
    href: 'https://sparx.works/b2b',
    blurb: 'Accounts, price lists, and fleet.',
  },
  {
    module: 'builder',
    label: 'Site Builder',
    href: 'https://sparx.works/builder',
    blurb: 'Themes, layouts, and domains.',
  },
];

const TOOLKIT: Resource[] = [
  {
    title: 'Referral link kit',
    description: 'Your link, ready-to-share copy, and where to place it so it converts.',
    icon: Share2,
    href: '/partner/referrals',
    cta: 'Open referrals',
  },
  {
    title: 'Directory profile',
    description: 'Polish your public listing so prospective clients pick you.',
    icon: UserRound,
    href: '/partner/profile',
    cta: 'Edit profile',
  },
];

export default function PartnerResourcesPage() {
  return (
    <ModuleProvider module="partner">
      <Container size="xl">
        <Stack gap={8} className="py-10">
          <PageHeader
            icon={<BookOpen className="h-5 w-5" />}
            title="Resources"
            description="Everything you need to pitch Sparx, onboard clients, and grow your referrals."
          />

          <Section title="Pitch & win clients">
            <Grid cols={1} mdCols={3} gap={4}>
              {PITCH.map((r) => (
                <ResourceCard key={r.title} resource={r} />
              ))}
            </Grid>
          </Section>

          <Section
            title="Onboard clients, module by module"
            description="Hand these to a client — or use them yourself — to get each module live fast."
          >
            <Grid cols={1} mdCols={3} gap={4}>
              {MODULE_GUIDES.map((g) => (
                <ModuleProvider key={g.module} module={g.module}>
                  <Card variant="module" padding="md">
                    <Stack gap={2}>
                      <Text size="sm" weight="medium" className="text-[var(--module-active-text)]">
                        {g.label}
                      </Text>
                      <Text size="sm" variant="muted">
                        {g.blurb}
                      </Text>
                      <Button
                        asChild
                        color="module"
                        variant="link"
                        size="sm"
                        className="self-start"
                      >
                        <a href={g.href} target="_blank" rel="noreferrer">
                          Onboarding guide
                          <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </Stack>
                  </Card>
                </ModuleProvider>
              ))}
            </Grid>
          </Section>

          <Section title="Your referral toolkit">
            <Grid cols={1} mdCols={2} gap={4}>
              {TOOLKIT.map((r) => (
                <ResourceCard key={r.title} resource={r} />
              ))}
            </Grid>
          </Section>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Heading level={2}>{title}</Heading>
        {description && (
          <Text size="sm" variant="muted">
            {description}
          </Text>
        )}
      </Stack>
      {children}
    </Stack>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const Icon = resource.icon;
  return (
    <Card variant="default" padding="md">
      <Stack gap={3}>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--module-active-tint)] text-[var(--module-active)]">
          <Icon className="h-5 w-5" />
        </span>
        <Stack gap={1}>
          <Text size="sm" weight="medium">
            {resource.title}
          </Text>
          <Text size="sm" variant="muted">
            {resource.description}
          </Text>
        </Stack>
        <Button asChild color="module" variant="link" size="sm" className="self-start">
          {resource.external ? (
            <a href={resource.href} target="_blank" rel="noreferrer">
              {resource.cta}
              <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
            </a>
          ) : (
            <Link href={resource.href}>{resource.cta}</Link>
          )}
        </Button>
      </Stack>
    </Card>
  );
}
