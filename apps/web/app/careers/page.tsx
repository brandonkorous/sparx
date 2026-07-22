import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<Link/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Section, Display, Spark, Dot } from '@/components/marketing/primitives';
import { ROLES, OPEN_APPLICATION, CAREERS_COPY, type Role } from './roles';

export const metadata: Metadata = {
  title: 'Careers — sparx',
  description:
    'Founding roles at WizeWorks LLC, the team building sparx. Equity and revenue share, remote-first, and honest about exactly where we are.',
  alternates: { canonical: '/careers' },
};

/** Decorative separator between role meta values — a background dot, not read. */
const META_DOT = 'color-mix(in oklab, var(--color-base-content) 30%, transparent)';

function RoleCard({ role }: { role: Role }) {
  return (
    <Link href={`/careers/${role.slug}`} className="mkt-role-card">
      <Card>
        <CardBody className="p-8">
          <div className="mkt-role-row">
            <div className="flex min-w-0 flex-col gap-2.5">
              <h3 className="text-h4 text-base-content m-0 font-medium tracking-[-0.01em]">
                {role.title}
              </h3>
              <div className="text-caption text-ink-subtle flex flex-wrap items-center gap-x-3 gap-y-2">
                <span>{role.team}</span>
                <Dot color={META_DOT} size={3} />
                <span>{role.location}</span>
                <Dot color={META_DOT} size={3} />
                <span>{role.commitment}</span>
              </div>
              <p className="text-body text-ink-muted mt-1 mb-0 max-w-[620px]">{role.summary}</p>
            </div>
            <span className="mkt-role-arrow">
              View role <span aria-hidden>→</span>
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

function StepRow({ index, text }: { index: number; text: string }) {
  return (
    <li className="mkt-step-row">
      <span className="text-small text-primary w-7 shrink-0 font-mono font-medium">
        {String(index).padStart(2, '0')}
      </span>
      <span className="text-body-lg text-ink-muted">{text}</span>
    </li>
  );
}

export default function CareersPage() {
  return (
    <>
      <Section surface="page" padding="xl">
        <div className="flex max-w-[900px] flex-col gap-[22px]">
          <Display as="h1" size={76} lineHeight={78}>
            {CAREERS_COPY.title}
            <Spark />
          </Display>
          <p className="text-lede-lg text-ink-muted m-0 max-w-[620px]">{CAREERS_COPY.subtitle}</p>
        </div>
      </Section>

      <Section surface="surface" padding="lg">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div className="mkt-stack-copy">
            <Display as="h2" size={38} lineHeight={42}>
              Where we actually are
              <Spark />
            </Display>
          </div>
          <div className="flex flex-col gap-5">
            {CAREERS_COPY.pitch.map((p) => (
              <p key={p} className="text-body-lg text-ink-muted m-0">
                {p}
              </p>
            ))}
          </div>
        </div>
      </Section>

      <Section surface="page" padding="lg">
        <div className="flex flex-col gap-8">
          <Display as="h2" size={40} lineHeight={44}>
            Open roles
            <Spark />
          </Display>
          <div className="flex flex-col gap-4">
            {ROLES.map((role) => (
              <RoleCard key={role.slug} role={role} />
            ))}
          </div>
        </div>
      </Section>

      <Section surface="dark" padding="lg">
        <div className="flex max-w-[720px] flex-col gap-5">
          <Display as="h2" size={40} lineHeight={44}>
            Don&rsquo;t see your role
            <Spark />
          </Display>
          <p className="text-lede text-ink-muted m-0 max-w-[580px]">{OPEN_APPLICATION.summary}</p>
          <div className="pt-1">
            <Link
              href={`/careers/${OPEN_APPLICATION.slug}`}
              className={buttonClasses({ size: 'lg' })}
            >
              {OPEN_APPLICATION.title} →
            </Link>
          </div>
        </div>
      </Section>

      <Section surface="surface" padding="lg">
        <div className="flex max-w-[760px] flex-col gap-7">
          <Display as="h2" size={38} lineHeight={42}>
            How we hire
            <Spark />
          </Display>
          <ol className="m-0 list-none p-0">
            {CAREERS_COPY.howWeHire.map((step, i) => (
              <StepRow key={step} index={i + 1} text={step} />
            ))}
          </ol>
        </div>
      </Section>

      <Section surface="page" padding="md">
        <p className="text-small text-ink-subtle m-0 max-w-[760px]">{CAREERS_COPY.entityNote}</p>
      </Section>
    </>
  );
}
