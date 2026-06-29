// Email module presets — starter marketing CAMPAIGNS. Each pack seeds a real,
// published Builder email (a fresh, fully editable body tree — not one of the 13
// keyed automation defaults that activation already provisions) and a DRAFT
// broadcast that points at it and at a starter audience, so a merchant lands on a
// ready-to-review campaign instead of a blank composer.
//
// At the composition root because the services it dogfoods live in two packages
// that don't dep the preset contract: emails come from @sparx/builder
// (emailService) and broadcasts from @sparx/email-platform (broadcastService).
// api-rest deps all three (+ @sparx/auth for the contract), so this is the one
// place they compose without a new dependency edge. Every call threads the open
// tenant tx (`sx.tx`) so the email + publish + broadcast install atomically.
//
// The broadcast stays a DRAFT — nothing sends — and its segment is a SOFT FK
// (nullable): the audience resolves to the built-in `newsletter-subscribers`
// segment when CRM is enabled, else null (the merchant picks one before sending).
//
// Data-as-code (line-limit exempt).

import { emailService } from '@sparx/builder';
import { EMAIL_WORDMARK_TYPE, seedNode, type BuilderNode } from '@sparx/builder-schemas';
import { definePreset, type ModulePreset } from '@sparx/auth';
import type { TenantContext } from '@sparx/db';
import { broadcastService } from '@sparx/email-platform';

interface EmailContent {
  idPrefix: string;
  heading: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaHref: string;
}

/** Compose a marketing email body tree in the same vocabulary as the platform
 *  defaults (pinned wordmark header → heading → paragraphs → CTA → compliance
 *  footer), so it renders and edits identically. Ids are deterministic within the
 *  one tree (unique per email, like the `def-` default scheme). */
function marketingEmailTree(c: EmailContent): BuilderNode {
  let seq = 0;
  const id = (t: string): string => `${c.idPrefix}-${t}-${(seq += 1)}`;
  const node = (type: string, opts: Parameters<typeof seedNode>[2] = {}): BuilderNode =>
    seedNode(id(type), type, opts);

  const children: BuilderNode[] = [
    node(EMAIL_WORDMARK_TYPE, { props: { treatment: 'lockup', align: 'left', size: 'md' } }),
    node('Heading', { props: { level: 'h1', text: c.heading } }),
    ...c.paragraphs.map((text) => node('Text', { props: { variant: 'body', text } })),
    node('Button', { props: { label: c.ctaLabel, href: c.ctaHref }, box: { align: 'start' } }),
    // Marketing compliance footer (docs/91) — divider, unsubscribe, postal address.
    node('Divider'),
    node('unsubscribe_link'),
    node('physical_address'),
  ];

  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children,
  });
}

interface CampaignSpec {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  emailName: string;
  subject: string;
  preheader: string;
  content: Omit<EmailContent, 'idPrefix'>;
  /** Built-in/preset segment slug to target, when present. */
  segmentSlug: string;
  audienceChip: string;
}

/** Seed + publish the starter email, then create a draft broadcast pointing at it
 *  and (when present) the named segment — all on the open tenant tx. */
async function buildCampaign(sx: TenantContext, spec: CampaignSpec): Promise<{ id: string }> {
  const tree = marketingEmailTree({ ...spec.content, idPrefix: spec.slug });
  const email = await emailService.create(sx, {
    name: spec.emailName,
    subject: spec.subject,
    preheader: spec.preheader,
    tree,
  });
  // Publish so the broadcast has a renderable snapshot to attach to.
  await emailService.publish(sx, email.id);

  const segment = await sx.tx!.segment.findFirst({
    where: { tenantId: sx.tenantId, slug: spec.segmentSlug, archivedAt: null },
    select: { id: true },
  });

  const broadcast = await broadcastService.create(sx, {
    name: spec.name,
    subject: spec.subject,
    preheader: spec.preheader,
    builderEmailId: email.id,
    segmentId: segment?.id ?? undefined,
  });
  return { id: broadcast.id };
}

function campaignPreset(spec: CampaignSpec): ModulePreset {
  return definePreset({
    module: 'email',
    slug: spec.slug,
    kind: 'email-campaign',
    name: spec.name,
    description: spec.description,
    iconKey: spec.iconKey,
    tags: ['email', 'campaign', 'marketing', ...spec.tags],
    summary: [
      { label: 'Email + draft campaign', tone: 'neutral' },
      { label: spec.audienceChip, tone: 'module' },
    ],
    // Installed ⇔ the campaign's broadcast exists (its sentinel).
    marker: (tx, tenantId) =>
      tx.broadcast
        .findFirst({ where: { tenantId, name: spec.name }, select: { id: true } })
        .then(Boolean),
    build: (sx: TenantContext) => buildCampaign(sx, spec),
  });
}

/** Every email module preset, in picker order. */
export const emailPresets: ModulePreset[] = [
  campaignPreset({
    slug: 'newsletter-campaign',
    name: 'Monthly newsletter',
    description:
      'A ready-to-edit monthly newsletter email plus a draft campaign aimed at your subscribers. Update the copy, then send or schedule it from Email → Campaigns.',
    iconKey: 'newspaper',
    tags: ['newsletter'],
    emailName: 'Monthly newsletter',
    subject: 'What’s new at {{site.name}}',
    preheader: 'Your monthly update from {{site.name}}',
    content: {
      heading: 'What’s new this month',
      paragraphs: [
        'Hi {{customer.firstName ?? "there"}} — here’s a quick roundup of what’s new at {{site.name}}.',
        'Swap in your own highlights, news, and links before you send. Keep it short: a headline, a few updates, and one clear call to action work best.',
      ],
      ctaLabel: 'See the latest',
      ctaHref: '{{site.url}}',
    },
    segmentSlug: 'newsletter-subscribers',
    audienceChip: 'To newsletter subscribers',
  }),
  campaignPreset({
    slug: 'promo-campaign',
    name: 'Sale announcement',
    description:
      'A promotional email and draft campaign for a sale or limited-time offer, aimed at your VIP customers. Set the offer and dates, then send when you’re ready.',
    iconKey: 'tag',
    tags: ['promotion', 'sale'],
    emailName: 'Sale announcement',
    subject: 'A little something for you',
    preheader: 'A limited-time offer inside',
    content: {
      heading: 'An exclusive offer, just for you',
      paragraphs: [
        'Hi {{customer.firstName ?? "there"}} — as a thank-you for being a customer of {{site.name}}, here’s an offer we think you’ll like.',
        'Add your discount code, the offer details, and an end date before sending. A clear deadline is what turns a promo into a purchase.',
      ],
      ctaLabel: 'Shop the sale',
      ctaHref: '{{site.url}}',
    },
    segmentSlug: 'vip-customers',
    audienceChip: 'To VIP customers',
  }),
];
