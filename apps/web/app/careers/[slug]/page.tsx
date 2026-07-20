import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { Section, Display, Spark, Dot } from '@/components/marketing/primitives';
import { ROLES, OPEN_APPLICATION, getRole, type Role } from '../roles';
import { ApplyForm } from './apply-form';

const EMBER = 'var(--color-primary)';

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

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 grid list-none gap-3.5 p-0">
      {items.map((item) => (
        <li key={item} className="flex items-baseline gap-3">
          <span className="relative top-[7px] shrink-0">
            <Dot color={EMBER} />
          </span>
          <span className="text-body text-ink-muted">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function RoleColumn({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-h3 text-base-content m-0 font-medium tracking-[-0.01em]">{heading}</h2>
      <BulletList items={items} />
    </div>
  );
}

function RoleHeader({ role }: { role: Role }) {
  return (
    <div className="flex max-w-[820px] flex-col gap-[22px]">
      <Link href="/careers" className="text-small text-ink-muted no-underline">
        ← All roles
      </Link>
      <Display as="h1" size={60} lineHeight={60}>
        {role.title}
        <Spark />
      </Display>
      <div className="flex flex-wrap gap-2">
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
      <Card className="bg-base-200 max-w-[720px] rounded-lg">
        <CardBody className="gap-2 px-5 py-[18px]">
          <span className="text-body-sm text-base-content inline-flex items-center gap-2 font-medium tracking-[0.01em]">
            <Dot color={EMBER} />
            The honest deal
          </span>
          <p className="text-body-sm text-ink-muted m-0">{role.compensation}</p>
        </CardBody>
      </Card>
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
        <div className="flex max-w-[720px] flex-col gap-[18px]">
          {role.aboutRole.map((p) => (
            <p key={p} className="text-body-lg text-ink-muted m-0">
              {p}
            </p>
          ))}
        </div>
      </Section>

      <Section surface="page" padding="lg">
        <div className="flex flex-col gap-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <RoleColumn heading="What you'll own" items={role.whatYoullOwn} />
            <RoleColumn heading="What we're looking for" items={role.whatWereLookingFor} />
          </div>
          {role.niceToHave ? (
            <div className="flex max-w-[720px] flex-col gap-5">
              <RoleColumn heading="Nice to have" items={role.niceToHave} />
            </div>
          ) : null}
        </div>
      </Section>

      <Section surface="surface" padding="lg">
        <div className="flex max-w-[620px] flex-col gap-7">
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
