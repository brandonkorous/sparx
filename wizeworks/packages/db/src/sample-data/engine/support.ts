// Support slice (docs/144 §7) — the demo support queue, crm-gated.
//
// A queue with no rows in it is the one screen where sample data matters most:
// the whole point of the surface is the SPREAD — one request breached, one going
// amber, one nobody has picked up, one already sorted — and none of that is
// visible on an empty table. So this deliberately writes a set that lands in
// every state at once.
//
// THE DUE DATES ARE WRITTEN DIRECTLY, not computed from the policy. Everywhere
// else in the platform they come out of the SLA clock; here they are placed on
// purpose, because a demo has to show a breached request NOW rather than nine
// working hours from whenever someone happened to press Load. Sample rows carry
// `source: 'api'` + the sample marker and are removed by Clear, so nothing here
// contaminates what a real request looks like.
//
// THE PROMISE ITSELF IS STILL REAL, THOUGH. Writing the dates by hand is a
// deliberate decision about the DATES; it was silently also a decision about the
// POLICY, which this never created. The result was five requests showing live
// reply clocks — one breached, one amber — beside a Response times screen that
// said "No response times set up yet" and promised "one is created for you the
// first time a support request comes in", with five requests already in the
// queue. Measured before the fix: 10 of the 11 requests on the platform sat
// under a tenant with no policy at all. So the starter promise is created here
// alongside the queue, and every sample request names it. The hand-placed dates
// are unchanged; what changes is that the owner can now find, read and edit the
// rule they are measured against.
//
// The support queue's own pipeline is created if the tenant has not filed a
// request yet — the same one `ticketService.ensureTicketPipeline` makes, kept in
// step by hand because @wizeworks/db sits BELOW @wizeworks/crm and must not depend
// upwards (the same rule record-types.ts follows for the built-in objects).

import type { SampleDataPack } from '../types';
import type { ApplyCtx } from './context';
import { daysAgo } from './context';

/** Kept in step with DEFAULT_TICKET_PIPELINE_TEMPLATE in @wizeworks/crm-schemas. */
const TICKET_STAGES = [
  { name: 'New', sortOrder: 0, stageType: 'open', color: '#0EA5E9' },
  { name: 'In Progress', sortOrder: 1, stageType: 'open', color: '#6366F1' },
  { name: 'Waiting on Customer', sortOrder: 2, stageType: 'open', color: '#F59E0B' },
  { name: 'Resolved', sortOrder: 3, stageType: 'resolved', color: '#10B981' },
  { name: 'Closed', sortOrder: 4, stageType: 'closed', color: '#94A3B8' },
];

/** Kept in step with DEFAULT_SLA_POLICY_TEMPLATE in @wizeworks/crm-schemas, by
 *  hand and for the same reason as the stages above: @wizeworks/db sits below
 *  @wizeworks/crm and must not depend upwards. */
const SLA_TEMPLATE = {
  name: 'Usual hours',
  description: 'Weekday business hours. Edit the hours and targets to match how your team works.',
  timezone: 'UTC',
  businessHours: [
    { day: 1, startMinute: 540, endMinute: 1020 },
    { day: 2, startMinute: 540, endMinute: 1020 },
    { day: 3, startMinute: 540, endMinute: 1020 },
    { day: 4, startMinute: 540, endMinute: 1020 },
    { day: 5, startMinute: 540, endMinute: 1020 },
  ],
  warnAtPercent: 80,
  targets: [
    { priority: 'urgent', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { priority: 'high', firstResponseMinutes: 240, resolutionMinutes: 960 },
    { priority: 'medium', firstResponseMinutes: 480, resolutionMinutes: 2400 },
    // No promise on low priority, expressed as the absence of one rather than a
    // number nobody intends to meet.
    { priority: 'low', firstResponseMinutes: null, resolutionMinutes: null },
  ],
};

/**
 * The starter promise, created if the tenant has none — the same row
 * `ticketService.ensureDefaultPolicy` makes the first time a real request comes
 * in, so a later real request finds this one rather than adding a second.
 *
 * Not removed by Clear, for the same reason the support queue above is not: it
 * is the setup a business keeps, not a sample row. Anything that survives Clear
 * has to be something the product would have created anyway, and this is.
 */
async function ensureSlaPolicy(ctx: ApplyCtx): Promise<string> {
  const { tx, tenantId } = ctx;

  const existing = await tx.ticketSlaPolicy.findFirst({
    where: { propertyId: null, archivedAt: null },
    select: { id: true },
  });
  if (existing) return existing.id;

  // In the business's OWN hours. "Open 9 to 5" is the only thing a person means
  // by it, and a promise bootstrapped in UTC counts those hours somewhere else.
  const business = await tx.tenantBusiness.findFirst({ select: { timezone: true } });

  const policy = await tx.ticketSlaPolicy.create({
    data: {
      tenantId,
      propertyId: null,
      name: SLA_TEMPLATE.name,
      description: SLA_TEMPLATE.description,
      isDefault: true,
      timezone: business?.timezone ?? SLA_TEMPLATE.timezone,
      businessHours: SLA_TEMPLATE.businessHours,
      holidays: [],
      warnAtPercent: SLA_TEMPLATE.warnAtPercent,
    },
    select: { id: true },
  });

  await tx.ticketSlaTarget.createMany({
    data: SLA_TEMPLATE.targets.map((target) => ({
      tenantId,
      policyId: policy.id,
      priority: target.priority,
      firstResponseMinutes: target.firstResponseMinutes,
      resolutionMinutes: target.resolutionMinutes,
    })),
  });

  return policy.id;
}

/**
 * The five requests, described by the SHAPE each one is meant to demonstrate
 * rather than by its wording. Subjects come from the pack (or the fallback
 * below) so a donut wholesaler's queue does not talk about brake calipers.
 */
const SHAPES = [
  {
    // Breached: past its reply deadline, and nobody has answered. The row a
    // support lead is supposed to see first.
    stage: 0,
    priority: 'urgent',
    source: 'email',
    dueHours: -6,
    warnHours: -8,
    responded: false,
    assigned: false,
    breached: true,
  },
  {
    // Amber: past the warning mark, still inside the deadline.
    stage: 1,
    priority: 'high',
    source: 'chat',
    dueHours: 1,
    warnHours: -1,
    responded: true,
    assigned: true,
    breached: false,
  },
  {
    // Unassigned and untouched — the "somebody pick this up" case.
    stage: 0,
    priority: 'medium',
    source: 'form',
    dueHours: 20,
    warnHours: 16,
    responded: false,
    assigned: false,
    breached: false,
  },
  {
    // Waiting on the customer: answered, ball in their court.
    stage: 2,
    priority: 'medium',
    source: 'phone',
    dueHours: 30,
    warnHours: 24,
    responded: true,
    assigned: true,
    breached: false,
  },
  {
    // Done. Present so the queue's "Everything" view is not all open work, and
    // so the resolved state has something to render.
    stage: 3,
    priority: 'low',
    source: 'email',
    dueHours: 48,
    warnHours: 40,
    responded: true,
    assigned: true,
    breached: false,
  },
] as const;

/** Subjects when a pack does not author its own. Written to be true of any
 *  business rather than vaguely true of none — every one of these is something
 *  a real customer says, whether the business sells parts or haircuts. */
function fallbackSubjects(pack: SampleDataPack): { subject: string; detail: string }[] {
  const thing = pack.products[0]?.title ?? 'my order';
  return [
    {
      subject: `Still waiting on ${thing}`,
      detail: 'Ordered last week and it has not turned up. Can somebody check where it is?',
    },
    {
      subject: 'Wrong item arrived',
      detail: 'What came is not what I ordered. Happy to send it back if you cover the postage.',
    },
    {
      subject: 'Question before I order',
      detail: 'Trying to work out whether this is the right thing for what I need.',
    },
    {
      subject: 'Invoice does not look right',
      detail: 'The total is higher than the quote I was given. Could someone take a look?',
    },
    {
      subject: 'Thanks: sorted now',
      detail: 'The replacement arrived this morning and it is exactly right. Appreciated.',
    },
  ];
}

export async function applySupportRequests(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('crm')) return;
  const { tx, tenantId } = ctx;

  // The support queue. findFirst rather than findUnique: the unique is
  // (tenant, property, object, slug) NULLS NOT DISTINCT, which Prisma cannot
  // reach through a compound-unique key when the property is null.
  const existing = await tx.pipeline.findFirst({
    where: { objectKey: 'ticket', propertyId: null, slug: 'support' },
    select: { id: true, stages: { orderBy: { sortOrder: 'asc' }, select: { id: true } } },
  });
  const pipeline =
    existing ??
    (await tx.pipeline.create({
      data: {
        tenantId,
        propertyId: null,
        objectKey: 'ticket',
        name: 'Support Queue',
        slug: 'support',
        isDefault: true,
        stages: {
          create: TICKET_STAGES.map((s) => ({
            tenantId,
            name: s.name,
            sortOrder: s.sortOrder,
            probability: 0,
            stageType: s.stageType,
            color: s.color,
          })),
        },
      },
      select: { id: true, stages: { orderBy: { sortOrder: 'asc' }, select: { id: true } } },
    }));
  if (pipeline.stages.length === 0) return;

  const personas = pack.personas;
  const customerIds = personas
    .map((p) => ctx.customerIdByPersona.get(p.key))
    .filter((id): id is string => Boolean(id));
  if (customerIds.length === 0) return;

  // Alongside the queue, not after it: the clocks written below are meaningless
  // to the owner unless the rule behind them exists on the Response times screen.
  const slaPolicyId = await ensureSlaPolicy(ctx);

  const subjects = pack.supportRequests ?? fallbackSubjects(pack);

  // Numbering continues from whatever is already there, so loading sample data
  // into a tenant with real requests cannot collide on (tenant, number).
  const already = await tx.ticket.count({ where: { tenantId } });

  for (let i = 0; i < SHAPES.length; i++) {
    const shape = SHAPES[i]!;
    const text = subjects[i % subjects.length]!;
    const stageId = pipeline.stages[Math.min(shape.stage, pipeline.stages.length - 1)]!.id;
    const openedAt = daysAgo(ctx, 2 - i * 0.25);
    const hoursFromNow = (h: number) => new Date(ctx.now + h * 3_600_000);

    await tx.ticket.create({
      data: {
        tenantId,
        number: already + i + 1,
        pipelineId: pipeline.id,
        stageId,
        slaPolicyId,
        customerId: customerIds[i % customerIds.length]!,
        assignedToUserId: shape.assigned ? ctx.ownerUserId : null,
        subject: text.subject,
        description: text.detail,
        priority: shape.priority,
        // `api` rather than the shape's own source: every sample row has to be
        // findable and removable as sample data, and `source` is half of the
        // key Clear uses. The shape's source rides in the tags instead, so the
        // list still shows a believable spread of where things came from.
        source: 'api',
        sourceRecordId: `sample-${String(i)}`,
        tags: ['sample', shape.source],
        createdAt: openedAt,
        firstResponseDueAt: hoursFromNow(shape.dueHours),
        firstResponseWarnAt: hoursFromNow(shape.warnHours),
        firstRespondedAt: shape.responded ? daysAgo(ctx, 1) : null,
        resolutionDueAt: hoursFromNow(shape.dueHours + 24),
        resolutionWarnAt: hoursFromNow(shape.dueHours + 16),
        resolvedAt: shape.stage >= 3 ? daysAgo(ctx, 0.5) : null,
        firstResponseBreachedAt: shape.breached ? daysAgo(ctx, 0.25) : null,
      },
    });
    ctx.counts.tickets += 1;
  }
}
