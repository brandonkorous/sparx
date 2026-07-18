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

const EMBER = 'var(--color-primary)';

const ledeStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: '19px',
  lineHeight: '30px',
  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
  maxWidth: '620px',
};

const pitchStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: '17px',
  lineHeight: '28px',
  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
};

function RoleCard({ role }: { role: Role }) {
  return (
    <Link href={`/careers/${role.slug}`} className="mkt-role-card">
      <Card>
        <CardBody className="p-8">
          <div className="mkt-role-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '21px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-base-content)',
                }}
              >
                {role.title}
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                <span>{role.team}</span>
                <Dot
                  color="color-mix(in oklab, var(--color-base-content) 30%, transparent)"
                  size={3}
                />
                <span>{role.location}</span>
                <Dot
                  color="color-mix(in oklab, var(--color-base-content) 30%, transparent)"
                  size={3}
                />
                <span>{role.commitment}</span>
              </div>
              <p
                style={{
                  margin: '4px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '16px',
                  lineHeight: '25px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  maxWidth: '620px',
                }}
              >
                {role.summary}
              </p>
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
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          fontWeight: 500,
          color: EMBER,
          flexShrink: 0,
          width: '28px',
        }}
      >
        {String(index).padStart(2, '0')}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '17px',
          lineHeight: '27px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        {text}
      </span>
    </li>
  );
}

export default function CareersPage() {
  return (
    <>
      <Section surface="page" padding="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '900px' }}>
          <Display as="h1" size={76} lineHeight={78}>
            {CAREERS_COPY.title}
            <Spark />
          </Display>
          <p style={ledeStyle}>{CAREERS_COPY.subtitle}</p>
        </div>
      </Section>

      <Section surface="surface" padding="lg">
        <div className="mkt-stack-split">
          <div className="mkt-stack-copy">
            <Display as="h2" size={38} lineHeight={42}>
              Where we actually are
              <Spark />
            </Display>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {CAREERS_COPY.pitch.map((p) => (
              <p key={p} style={pitchStyle}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </Section>

      <Section surface="page" padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <Display as="h2" size={40} lineHeight={44}>
            Open roles
            <Spark />
          </Display>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {ROLES.map((role) => (
              <RoleCard key={role.slug} role={role} />
            ))}
          </div>
        </div>
      </Section>

      <Section surface="dark" padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px' }}>
          <Display as="h2" size={40} lineHeight={44} color="#FFFFFF">
            Don&rsquo;t see your role
            <Spark color="#FFFFFF" />
          </Display>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: '18px',
              lineHeight: '29px',
              color: '#A1A1AA',
              maxWidth: '580px',
            }}
          >
            {OPEN_APPLICATION.summary}
          </p>
          <div style={{ paddingTop: '4px' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '760px' }}>
          <Display as="h2" size={38} lineHeight={42}>
            How we hire
            <Spark />
          </Display>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {CAREERS_COPY.howWeHire.map((step, i) => (
              <StepRow key={step} index={i + 1} text={step} />
            ))}
          </ol>
        </div>
      </Section>

      <Section surface="page" padding="md">
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            lineHeight: '23px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            maxWidth: '760px',
          }}
        >
          {CAREERS_COPY.entityNote}
        </p>
      </Section>
    </>
  );
}
