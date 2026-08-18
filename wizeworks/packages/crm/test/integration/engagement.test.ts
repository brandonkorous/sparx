// engagementService — what was SAID (docs/144 §5).
//
// The four things this file exists to hold, none of which are visible from a
// signature:
//
//   • THREADING ORDER. In-Reply-To, then References, then the provider's thread
//     id, then subject narrowed to one customer. Subject is LAST on purpose —
//     "Re: Quote" from two different people is one subject and two
//     conversations, and a threader that leads with it merges strangers' mail.
//   • THE PRIVACY GATE. A personal mailbox stores only messages involving a
//     known contact. Everything else is discarded — never stored, never indexed.
//   • IDEMPOTENCE. Mail sync delivers the same message twice; the timeline must
//     not double.
//   • ONE TIMELINE. Every message also writes a crm_activities row.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@wizeworks/db';
import {
  customerService,
  engagementService,
  mailboxService,
  RecordingMailSink,
  salesTemplateService,
  setOutboundMailSink,
} from '../../src/services/index.js';
import { htmlToText } from '../../src/services/outbound-mail.js';
import { disposeTestContext, makeTestContext, type TestContext } from '../helpers.js';

/** The activity rows on a customer, under the tenant (crm_activities is FORCE RLS). */
async function activitiesFor(tenantId: string, customerId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    return tx.crmActivity.findMany({ where: { customerId }, orderBy: { occurredAt: 'asc' } });
  });
}

describe('engagementService — sending and logging', () => {
  let test: TestContext;
  let mail: RecordingMailSink;
  let customerId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    mail = new RecordingMailSink();
    setOutboundMailSink(mail);

    const customer = await customerService.create(test.ctx, {
      type: 'b2b',
      email: 'rae@northwind.test',
      firstName: 'Rae',
      lastName: 'Sandoval',
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
    mail.clear();
  });

  it('sends an email, records it, and hands exactly one message to the wire', async () => {
    const { thread, message } = await engagementService.sendEmail(test.ctx, {
      customerId,
      subject: 'Your quote',
      bodyHtml: '<p>Hi Rae — the numbers are attached.</p>',
    });

    expect(thread.customerId).toBe(customerId);
    expect(message.direction).toBe('out');
    // A plain-text alternative is what a screen reader and several corporate
    // gateways actually show; its absence is a spam signal on its own.
    expect(message.bodyText).toContain('the numbers are attached');
    expect(message.rfcMessageId).toMatch(/^<.+@.+>$/);

    expect(mail.sent).toHaveLength(1);
    // The address comes from the RECORD, not the request.
    expect(mail.sent[0]?.to).toBe('rae@northwind.test');
    expect(mail.sent[0]?.rfcMessageId).toBe(message.rfcMessageId);
  });

  it('files the email on the ONE timeline', async () => {
    const activities = await activitiesFor(test.ctx.tenantId, customerId);
    const sent = activities.filter((row) => row.type === 'email.sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.description).toBe('Your quote');
  });

  it('refuses to email someone who asked not to be contacted', async () => {
    const quiet = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'quiet@northwind.test',
      doNotContact: true,
    });
    await expect(
      engagementService.sendEmail(test.ctx, {
        customerId: quiet.id,
        subject: 'Just checking in',
        bodyHtml: '<p>Hello?</p>',
      })
    ).rejects.toThrow(/asked not to be contacted/i);
    // And nothing reached the wire.
    expect(mail.sent).toHaveLength(0);
  });

  it('refuses to email a customer with no address, rather than sending nowhere', async () => {
    const anonymous = await customerService.create(test.ctx, { type: 'retail' });
    await expect(
      engagementService.sendEmail(test.ctx, {
        customerId: anonymous.id,
        subject: 'Hello',
        bodyHtml: '<p>Hi</p>',
      })
    ).rejects.toThrow(/no email address/i);
  });

  it('replying into a thread chains In-Reply-To to the previous message', async () => {
    const first = await engagementService.sendEmail(test.ctx, {
      customerId,
      subject: 'Following up',
      bodyHtml: '<p>Any thoughts?</p>',
    });
    const second = await engagementService.sendEmail(test.ctx, {
      customerId,
      threadId: first.thread.id,
      subject: 'Following up',
      bodyHtml: '<p>Bumping this.</p>',
    });

    expect(second.thread.id).toBe(first.thread.id);
    expect(second.message.inReplyTo).toBe(first.message.rfcMessageId);
    expect(second.message.references).toContain(first.message.rfcMessageId!);
  });

  it('logs a call, and distinguishes one nobody answered from a conversation', async () => {
    await engagementService.logCall(test.ctx, {
      customerId,
      direction: 'out',
      outcome: 'connected',
      durationSec: 420,
      notes: 'Walked through pricing. Wants it in writing.',
    });
    await engagementService.logCall(test.ctx, {
      customerId,
      direction: 'out',
      outcome: 'no_answer',
    });

    const activities = await activitiesFor(test.ctx.tenantId, customerId);
    expect(activities.filter((row) => row.type === 'call.logged')).toHaveLength(1);
    expect(activities.filter((row) => row.type === 'call.missed')).toHaveLength(1);
    // A call with no note still reads as a sentence, not a log line.
    const missed = activities.find((row) => row.type === 'call.missed');
    expect(missed?.description).toBe('Called them — no answer');
  });

  it('writes a note onto the same timeline as everything else', async () => {
    await engagementService.logNote(test.ctx, {
      customerId,
      body: 'Prefers to be called after 4pm.',
    });
    const activities = await activitiesFor(test.ctx.tenantId, customerId);
    expect(activities.some((row) => row.type === 'note')).toBe(true);
  });
});

describe('engagementService — receiving', () => {
  let test: TestContext;
  let personalMailboxId: string;
  let sharedMailboxId: string;
  let customerId: string;

  beforeAll(async () => {
    test = await makeTestContext('owner');
    setOutboundMailSink(new RecordingMailSink());

    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'known@customer.test',
      firstName: 'Known',
      lastName: 'Customer',
    });
    customerId = customer.id;

    // The ciphertext is supplied by the caller — this service never holds a key
    // and never does crypto, which is exactly why a test needs no key material.
    const personal = await mailboxService.connect(
      test.ctx,
      {
        scope: 'personal',
        emailAddress: 'rep@business.test',
        userId: test.ctx.userId,
        imapHost: 'imap.business.test',
        smtpHost: 'smtp.business.test',
        appPassword: 'app-password',
      },
      { appPasswordEnc: 'ciphertext-bundle' }
    );
    personalMailboxId = personal.id;

    const shared = await mailboxService.connect(
      test.ctx,
      {
        scope: 'shared',
        emailAddress: 'sales@business.test',
        imapHost: 'imap.business.test',
        smtpHost: 'smtp.business.test',
        appPassword: 'app-password',
      },
      { appPasswordEnc: 'ciphertext-bundle' }
    );
    sharedMailboxId = shared.id;
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  beforeEach(() => {
    test.publisher.clear();
  });

  it('a personal mailbox tells you it only keeps known contacts', async () => {
    const personal = await mailboxService.get(test.ctx, personalMailboxId);
    expect(personal.syncGate).toBe('known_contacts_only');
    const shared = await mailboxService.get(test.ctx, sharedMailboxId);
    // A shared address exists to receive mail from strangers — a first email
    // from a new prospect is exactly what it is for.
    expect(shared.syncGate).toBe('everything');
  });

  it('never stores a personal-mailbox message from someone who is not a contact', async () => {
    const outcome = await engagementService.recordInbound(test.ctx, {
      mailboxConnectionId: personalMailboxId,
      rfcMessageId: '<dentist-1@example.test>',
      subject: 'Your appointment on Thursday',
      fromAddress: 'reception@dentist.test',
      toAddresses: ['rep@business.test'],
      bodyText: 'See you at 3.',
      sentAt: new Date().toISOString(),
    });

    expect(outcome).toEqual({ stored: false, reason: 'unknown_contact' });

    // Not stored ANYWHERE — the promise is "we do not keep it", not "we do not
    // show it".
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${test.ctx.tenantId}'`);
      return tx.engagementMessage.findMany({ where: { rfcMessageId: '<dentist-1@example.test>' } });
    });
    expect(rows).toHaveLength(0);
  });

  it('a SHARED address keeps mail from a stranger — that is what it is for', async () => {
    const outcome = await engagementService.recordInbound(test.ctx, {
      mailboxConnectionId: sharedMailboxId,
      rfcMessageId: '<prospect-1@example.test>',
      subject: 'Do you deliver to Ohio?',
      fromAddress: 'someone@new.test',
      toAddresses: ['sales@business.test'],
      bodyText: 'Asking before I order.',
      sentAt: new Date().toISOString(),
    });
    expect(outcome.stored).toBe(true);
  });

  it('stores a reply from a known contact and files it as a REPLY', async () => {
    const sent = await engagementService.sendEmail(test.ctx, {
      customerId,
      subject: 'Your order',
      bodyHtml: '<p>On its way.</p>',
    });

    const outcome = await engagementService.recordInbound(test.ctx, {
      mailboxConnectionId: personalMailboxId,
      rfcMessageId: '<reply-1@customer.test>',
      inReplyTo: sent.message.rfcMessageId,
      subject: 'Re: Your order',
      fromAddress: 'known@customer.test',
      toAddresses: ['rep@business.test'],
      bodyText: 'Thanks!',
      sentAt: new Date().toISOString(),
    });

    expect(outcome.stored).toBe(true);
    if (!outcome.stored) return;
    // In-Reply-To wins: it lands in the conversation it answers.
    expect(outcome.threadId).toBe(sent.thread.id);
    expect(outcome.customerId).toBe(customerId);

    const activities = await activitiesFor(test.ctx.tenantId, customerId);
    // A reply is distinguished from a first contact — it is the strongest signal
    // in a sales pipeline.
    expect(activities.some((row) => row.type === 'email.replied')).toBe(true);
    expect(test.publisher.events.map((event) => event.topic)).toContain('crm.engagement.received');
  });

  it('does not double the timeline when sync delivers the same message twice', async () => {
    const again = await engagementService.recordInbound(test.ctx, {
      mailboxConnectionId: personalMailboxId,
      rfcMessageId: '<reply-1@customer.test>',
      subject: 'Re: Your order',
      fromAddress: 'known@customer.test',
      toAddresses: ['rep@business.test'],
      sentAt: new Date().toISOString(),
    });
    expect(again).toEqual({ stored: false, reason: 'duplicate' });
  });

  it('threads on subject only within ONE customer, never across strangers', async () => {
    const other = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'other@customer.test',
    });
    const mine = await engagementService.sendEmail(test.ctx, {
      customerId,
      subject: 'Quote',
      bodyHtml: '<p>Attached.</p>',
    });

    // A different customer, the same subject, no In-Reply-To. This is the case
    // a subject-first threader gets wrong, and getting it wrong shows one
    // customer another customer's mail.
    const outcome = await engagementService.recordInbound(test.ctx, {
      mailboxConnectionId: sharedMailboxId,
      rfcMessageId: '<stranger-quote@customer.test>',
      subject: 'Re: Quote',
      fromAddress: 'other@customer.test',
      toAddresses: ['sales@business.test'],
      sentAt: new Date().toISOString(),
    });

    expect(outcome.stored).toBe(true);
    if (!outcome.stored) return;
    expect(outcome.threadId).not.toBe(mine.thread.id);
    expect(outcome.customerId).toBe(other.id);
  });

  it('refuses an inbound message for a mailbox that is not connected', async () => {
    const outcome = await engagementService.recordInbound(test.ctx, {
      mailboxConnectionId: '00000000-0000-4000-8000-000000000000',
      rfcMessageId: '<orphan@example.test>',
      fromAddress: 'someone@nowhere.test',
      sentAt: new Date().toISOString(),
    });
    expect(outcome).toEqual({ stored: false, reason: 'no_connection' });
  });

  it('never lets a token out of the service', async () => {
    const view = await mailboxService.get(test.ctx, personalMailboxId);
    // A view carries the address and the state, and nothing that could be
    // captured from a log aggregator.
    expect(Object.keys(view)).not.toContain('accessTokenEnc');
    expect(Object.keys(view)).not.toContain('appPasswordEnc');
  });

  it('only offers a person their OWN mailbox plus the shared ones', async () => {
    const sendable = await mailboxService.sendableBy(test.ctx, test.ctx.userId);
    expect(sendable.map((box) => box.emailAddress).sort()).toEqual([
      'rep@business.test',
      'sales@business.test',
    ]);

    // Someone else gets the shared address only — sending as a colleague's
    // personal address is impersonation.
    const other = await mailboxService.sendableBy(test.ctx, '00000000-0000-4000-8000-000000000001');
    expect(other.map((box) => box.emailAddress)).toEqual(['sales@business.test']);
  });
});

describe('salesTemplateService', () => {
  let test: TestContext;

  beforeAll(async () => {
    test = await makeTestContext('owner');
  });

  afterAll(async () => {
    await disposeTestContext(test);
  });

  it('counts a send against the template that was used', async () => {
    const customer = await customerService.create(test.ctx, {
      type: 'retail',
      email: 'tpl@customer.test',
    });
    const template = await salesTemplateService.createTemplate(test.ctx, {
      name: 'Follow-up',
      subject: 'Still interested?',
      bodyHtml: '<p>Just checking in.</p>',
    });

    await engagementService.sendEmail(test.ctx, {
      customerId: customer.id,
      subject: 'Still interested?',
      bodyHtml: '<p>Just checking in.</p>',
      templateId: template.id,
    });

    const after = await salesTemplateService.getTemplate(test.ctx, template.id);
    expect(after.sendCount).toBe(1);
  });

  it('reports no rate at all below the floor, rather than a wild one', async () => {
    // One send and one reply is not a 100% reply rate, and showing it as one
    // would have a business standardise on something that worked once.
    const performance = await salesTemplateService.templatePerformance(test.ctx);
    expect(performance[0]?.replyRate).toBeNull();
  });

  it('refuses a duplicate name in words a person can act on', async () => {
    await expect(
      salesTemplateService.createTemplate(test.ctx, {
        name: 'Follow-up',
        subject: 'Another',
        bodyHtml: '<p>x</p>',
      })
    ).rejects.toThrow(/already have a template/i);
  });

  it('archives rather than deletes, so what the business learned survives', async () => {
    const list = await salesTemplateService.listTemplates(test.ctx);
    const template = list[0]!;
    await salesTemplateService.archiveTemplate(test.ctx, template.id);

    const visible = await salesTemplateService.listTemplates(test.ctx);
    expect(visible.map((row) => row.id)).not.toContain(template.id);

    const withArchived = await salesTemplateService.listTemplates(test.ctx, {
      includeArchived: true,
    });
    const found = withArchived.find((row) => row.id === template.id);
    expect(found?.sendCount).toBe(1);
  });

  it('normalises a snippet shortcut however the person typed it', async () => {
    const snippet = await salesTemplateService.createSnippet(test.ctx, {
      shortcut: ';hours',
      name: 'Opening hours',
      body: 'We are open 8–6 weekdays.',
    });
    expect(snippet.shortcut).toBe('hours');

    await expect(
      salesTemplateService.createSnippet(test.ctx, {
        shortcut: 'hours',
        name: 'Something else',
        body: 'x',
      })
    ).rejects.toThrow(/already in use/i);
  });
});

describe('htmlToText', () => {
  it('keeps paragraphs as paragraphs and drops the markup', () => {
    const text = htmlToText('<p>First line.</p><p>Second <b>line</b>.</p>');
    expect(text).toBe('First line.\n\nSecond line.');
  });

  it('strips script and style rather than reading them out', () => {
    const text = htmlToText('<style>p{color:red}</style><p>Hello</p><script>x()</script>');
    expect(text).toBe('Hello');
  });

  it('unescapes the entities a person would otherwise see raw', () => {
    expect(htmlToText('<p>Terms &amp; conditions &lt;here&gt;</p>')).toBe(
      'Terms & conditions <here>'
    );
  });
});
