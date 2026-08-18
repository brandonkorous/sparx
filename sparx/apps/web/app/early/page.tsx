import type { Metadata } from 'next';
import { Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { Display, Dot, Section, Spark } from '@/components/marketing/primitives';
import { EarlyAccessForm } from './early-access-form';

export const metadata: Metadata = {
  title: 'Early access — sparx',
  description:
    'sparx is the modular OS for content and commerce — sites, CRM, CMS, email, B2B, and AI in one platform. Join the early-access list and we’ll bring you in.',
  alternates: { canonical: '/early' },
  openGraph: {
    title: 'Get early access to sparx',
    description:
      'One platform for content and commerce — built by AI, kept by you. Join the early-access list.',
    url: '/early',
    type: 'website',
  },
};

// What joining gets you — kept factual, no pricing promises.
const PERKS = [
  'An invite the moment the modules you need are ready',
  'A direct line to shape what we build next',
  'First look at every new module as it ships',
] as const;

export default function EarlyAccessPage() {
  return (
    <Section surface="page" padding="lg">
      <div className="flex flex-col items-start gap-[clamp(40px,6vw,80px)] lg:flex-row">
        {/* ── Left: the pitch ─────────────────────────────────── */}
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
          <Display as="h1" size={80} lineHeight={76}>
            Be first on sparx
            <Spark />
          </Display>

          <p className="m-0 max-w-[560px] text-lg">
            sparx is the modular OS for content and commerce — sites, CRM, CMS, email, B2B, and AI
            in one platform that builds your site and keeps it. We&rsquo;re opening it up gradually.
            Join the list and we&rsquo;ll bring you in.
          </p>

          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {PERKS.map((perk) => (
              <li key={perk} className="text-md flex items-start gap-3 leading-6">
                <span className="inline-flex shrink-0 pt-[9px]">
                  <Dot />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: the form card ────────────────────────────── */}
        <div className="w-full max-w-[440px] shrink-0">
          <Card className="shadow-lg">
            <CardBody className="gap-5 p-[clamp(24px,4vw,36px)]">
              <div className="flex flex-col gap-1.5">
                <CardTitle className="text-xl font-medium tracking-[-0.015em]">
                  Join the waitlist
                </CardTitle>
                <span className="text-sm">
                  Takes ten seconds. We&rsquo;ll only reach out when it matters.
                </span>
              </div>

              <EarlyAccessForm />
            </CardBody>
          </Card>
        </div>
      </div>
    </Section>
  );
}
