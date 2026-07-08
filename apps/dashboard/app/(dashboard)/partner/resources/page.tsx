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
import { Button, Card, CardBody } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

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
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-10">
          <PageHeader
            icon={<BookOpen className="h-5 w-5" />}
            title="Resources"
            description="Everything you need to pitch Sparx, onboard clients, and grow your referrals."
          />

          <Section title="Pitch & win clients">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {PITCH.map((r) => (
                <ResourceCard key={r.title} resource={r} />
              ))}
            </div>
          </Section>

          <Section title="Onboard clients, module by module">
            <Card>
              <CardBody>
                <div className="flex flex-row flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-row items-start gap-3">
                    <span className="text-[var(--module-active)]">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-base font-medium">Onboarding guides</p>
                      <p className="text-base-content/70 text-sm">
                        Step-by-step playbooks to get each module live —{' '}
                        {MODULE_GUIDES.map((g) => g.label).join(', ')}.
                      </p>
                    </div>
                  </div>
                  <Button
                    render={<Link href="/partner/resources/guides" />}
                    color="module"
                    variant="soft"
                    size="sm"
                    className="self-start"
                    iconEnd={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    Open guides
                  </Button>
                </div>
              </CardBody>
            </Card>
          </Section>

          <Section title="Your referral toolkit">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {TOOLKIT.map((r) => (
                <ResourceCard key={r.title} resource={r} />
              ))}
            </div>
          </Section>
        </div>
      </div>
    </ModuleProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const Icon = resource.icon;
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-3">
          <span className="text-[var(--module-active)]">
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{resource.title}</p>
            <p className="text-base-content/70 text-sm">{resource.description}</p>
          </div>
          <Button
            render={<Link href={resource.href} />}
            color="module"
            variant="link"
            size="sm"
            className="self-start"
            iconEnd={<ArrowRight className="ml-0.5 h-3.5 w-3.5" />}
          >
            {resource.cta}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
