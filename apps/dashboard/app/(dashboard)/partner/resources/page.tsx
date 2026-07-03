import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  FileText,
  GraduationCap,
  Presentation,
  Share2,
  UserRound,
} from 'lucide-react';
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

import { MODULE_GUIDES } from './_lib/content';

// Partner Portal — Resources (docs/114 §B.7/D7). The enablement hub: pitch + win
// clients, onboard them module by module, run the referral toolkit. Every card now
// links to a REAL in-app resource (a presentable pitch, a proposal builder, a
// printable one-pager, per-module guides) — not the public marketing site. Not
// member-gated (a prospective partner can browse it), so no partner fetch.

interface Resource {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  cta: string;
}

const PITCH: Resource[] = [
  {
    title: 'The Sparx pitch',
    description:
      'The story of Sparx for a client conversation — what it is, who it’s for, why now.',
    icon: Presentation,
    href: '/partner/resources/pitch',
    cta: 'Open the pitch',
  },
  {
    title: 'Client proposal',
    description: 'Fill in the client and modules; get a clean, printable proposal to send.',
    icon: FileText,
    href: '/partner/resources/proposal',
    cta: 'Build a proposal',
  },
  {
    title: 'One-pager',
    description: 'A single-page overview of Sparx you can print or hand a client as a PDF.',
    icon: BookOpen,
    href: '/partner/resources/one-pager',
    cta: 'Open the one-pager',
  },
];

const TOOLKIT: Resource[] = [
  {
    title: 'Referral link kit',
    description: 'Your link, ready-to-share copy, and the accounts that signed up under it.',
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

          <Section title="Onboard clients, module by module">
            <Card variant="default" padding="lg">
              <Stack direction="row" align="center" justify="between" gap={4} className="flex-wrap">
                <Stack direction="row" align="start" gap={3} className="min-w-0">
                  <span className="text-[var(--module-active)]">
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  <Stack gap={1} className="min-w-0">
                    <Text weight="medium">Onboarding guides</Text>
                    <Text size="sm" variant="muted">
                      Step-by-step playbooks to get each module live —{' '}
                      {MODULE_GUIDES.map((g) => g.label).join(', ')}.
                    </Text>
                  </Stack>
                </Stack>
                <Button asChild color="module" variant="soft" size="sm" className="self-start">
                  <Link href="/partner/resources/guides">
                    Open guides
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </Stack>
            </Card>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{title}</Heading>
      {children}
    </Stack>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const Icon = resource.icon;
  return (
    <Card variant="default" padding="md">
      <Stack gap={3}>
        <span className="text-[var(--module-active)]">
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
          <Link href={resource.href}>
            {resource.cta}
            <ArrowRight className="ml-0.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </Stack>
    </Card>
  );
}
