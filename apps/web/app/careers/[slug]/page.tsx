import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@wizeworks/silicaui-react';
import { Section, Display, Spark, Dot } from '@/components/marketing/primitives';
import { ROLES, OPEN_APPLICATION, getRole, type Role } from '../roles';
import { ApplyForm } from './apply-form';

const EMBER = 'var(--color-primary)';
const MEASURE = '720px';

export function generateStaticParams() {
  return [...ROLES, OPEN_APPLICATION].map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const role = getRole(slug);
  if (!role) return { title: 'Careers — sparx' };
  return {
    title: `${role.title} — Careers at sparx`,
    description: role.summary,
    alternates: { canonical: `/careers/${slug}` },
  };
}

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontSize: '17px',
  lineHeight: '28px',
  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: '15px',
  letterSpacing: '0.01em',
  color: 'var(--color-base-content)',
};

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '14px' }}>
      {items.map((item) => (
        <li key={item} style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
          <span style={{ position: 'relative', top: '7px', flexShrink: 0 }}>
            <Dot color={EMBER} />
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '16px',
              lineHeight: '26px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            }}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RoleColumn({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '22px',
          letterSpacing: '-0.01em',
          color: 'var(--color-base-content)',
        }}
      >
        {heading}
      </h2>
      <BulletList items={items} />
    </div>
  );
}

function RoleHeader({ role }: { role: Role }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '820px' }}>
      <Link
        href="/careers"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          textDecoration: 'none',
        }}
      >
        ← All roles
      </Link>
      <Display as="h1" size={60} lineHeight={60}>
        {role.title}
        <Spark />
      </Display>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Badge color="primary" variant="soft" size="lg">
          {role.team}
        </Badge>
        <Badge color="neutral" variant="outline" size="lg">
          {role.location}
        </Badge>
        <Badge color="info" variant="soft" size="lg">
          {role.commitment}
        </Badge>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '18px 20px',
          border: '1px solid var(--color-base-300)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-base-200)',
          maxWidth: MEASURE,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', ...headingStyle }}>
          <Dot color={EMBER} />
          The honest deal
        </span>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            lineHeight: '24px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
        >
          {role.compensation}
        </p>
      </div>
    </div>
  );
}

export default async function RoleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const role = getRole(slug);
  if (!role) notFound();

  return (
    <>
      <Section surface="page" padding="xl">
        <RoleHeader role={role} />
      </Section>

      <Section surface="surface" padding="lg">
        <div style={{ maxWidth: MEASURE, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {role.aboutRole.map((p) => (
            <p key={p} style={paragraphStyle}>
              {p}
            </p>
          ))}
        </div>
      </Section>

      <Section surface="page" padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <div className="mkt-grid-2-1">
            <RoleColumn heading="What you'll own" items={role.whatYoullOwn} />
            <RoleColumn heading="What we're looking for" items={role.whatWereLookingFor} />
          </div>
          {role.niceToHave ? (
            <div
              style={{ maxWidth: MEASURE, display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              <RoleColumn heading="Nice to have" items={role.niceToHave} />
            </div>
          ) : null}
        </div>
      </Section>

      <Section surface="surface" padding="lg">
        <div style={{ maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <Display as="h2" size={34} lineHeight={38}>
            Apply for this role
            <Spark />
          </Display>
          <ApplyForm
            role={{
              slug: role.slug,
              title: role.title,
              resumeRequired: role.resumeRequired,
              interestPrompt: role.interestPrompt,
            }}
          />
        </div>
      </Section>
    </>
  );
}
