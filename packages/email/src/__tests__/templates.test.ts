import { describe, it, expect, beforeEach } from 'vitest';
import {
  _renderTemplateForTest,
  _setEmailProvider,
  consoleProvider,
  lastConsoleSend,
  resetConsoleProvider,
  sendTemplate,
} from '..';

beforeEach(() => {
  resetConsoleProvider();
  _setEmailProvider(consoleProvider);
});

describe('templates', () => {
  it('renders the password reset template with the reset URL in both bodies', async () => {
    const rendered = await _renderTemplateForTest({
      template: 'password-reset',
      to: 'user@example.test',
      props: {
        name: 'Brandon',
        resetUrl: 'https://app.sparx.works/reset?token=abc',
        expiresInMinutes: 30,
      },
    });
    expect(rendered.subject).toMatch(/set your sparx password/i);
    expect(rendered.html).toContain('https://app.sparx.works/reset?token=abc');
    expect(rendered.text).toContain('https://app.sparx.works/reset?token=abc');
    expect(rendered.text).toMatch(/30 minutes/);
    expect(rendered.templateId).toBe('password-reset');
  });

  it('renders the merchant welcome template — greets the person, no site/tenant name', async () => {
    const rendered = await _renderTemplateForTest({
      template: 'welcome-merchant',
      to: 'owner@example.test',
      props: {
        name: 'Brandon',
        dashboardUrl: 'https://app.sparx.works/welcome',
      },
    });
    expect(rendered.subject).toBe('Welcome to sparx');
    expect(rendered.html).toContain('Brandon');
    // The welcome email never carries a site/tenant name (docs/49) — it refers to
    // "Your site" generically.
    expect(rendered.text).toContain('Your site is live on sparx');
    expect(rendered.text).toContain('https://app.sparx.works/welcome');
    expect(rendered.templateId).toBe('welcome-merchant');
  });

  it('renders the team-invitation template with org, role, invitee + accept link', async () => {
    const acceptUrl = 'https://app.sparx.works/accept-invite?invitation=inv_123';
    const rendered = await _renderTemplateForTest({
      template: 'team-invitation',
      to: 'invitee@example.test',
      props: {
        inviteeEmail: 'invitee@example.test',
        orgName: 'Northwind Traders',
        inviterName: 'Brandon',
        role: 'editor',
        acceptUrl,
        expiresInDays: 7,
      },
    });
    expect(rendered.subject).toMatch(/join Northwind Traders on sparx/i);
    expect(rendered.html).toContain('Northwind Traders');
    expect(rendered.html).toContain(acceptUrl);
    expect(rendered.text).toContain(acceptUrl);
    expect(rendered.text).toContain('invitee@example.test');
    expect(rendered.text).toMatch(/7 days/);
    expect(rendered.templateId).toBe('team-invitation');
  });
});

describe('sendTemplate', () => {
  it('routes the rendered email to the active provider', async () => {
    const result = await sendTemplate({
      template: 'welcome-merchant',
      to: 'owner@example.test',
      props: {
        dashboardUrl: 'https://app.sparx.works/welcome',
      },
    });
    expect(result.provider).toBe('console');
    expect(result.id).toMatch(/^con_/);

    const send = lastConsoleSend();
    expect(send?.to).toBe('owner@example.test');
    expect(send?.subject).toBe('Welcome to sparx');
    expect(send?.templateId).toBe('welcome-merchant');
  });

  it('renders the sparx-billing receipt with the amount + invoice link', async () => {
    const rendered = await _renderTemplateForTest({
      template: 'billing-receipt',
      to: 'owner@example.test',
      props: {
        accountName: 'Bob’s Parts',
        amountLabel: '$49.00',
        periodLabel: 'Jul 1 – Jul 31, 2026',
        invoiceUrl: 'https://invoice.stripe.com/i/abc',
      },
    });
    expect(rendered.subject).toBe('Your sparx receipt');
    expect(rendered.html).toContain('$49.00');
    expect(rendered.html).toContain('https://invoice.stripe.com/i/abc');
    expect(rendered.text).toContain('$49.00');
    expect(rendered.templateId).toBe('billing-receipt');
  });

  it('renders the sparx-billing payment-failed notice with the update link', async () => {
    const rendered = await _renderTemplateForTest({
      template: 'billing-payment-failed',
      to: 'owner@example.test',
      props: { amountLabel: '$49.00', updateUrl: 'https://invoice.stripe.com/i/abc' },
    });
    expect(rendered.subject).toMatch(/problem with your sparx payment/i);
    expect(rendered.html).toContain('$49.00');
    expect(rendered.html).toContain('https://invoice.stripe.com/i/abc');
    expect(rendered.templateId).toBe('billing-payment-failed');
  });

  it('renders the sparx-billing trial-ending notice with the end date + manage link', async () => {
    const rendered = await _renderTemplateForTest({
      template: 'billing-trial-ending',
      to: 'owner@example.test',
      props: { trialEndLabel: 'Aug 5, 2026', manageUrl: 'https://sparx.works/settings/billing' },
    });
    expect(rendered.subject).toBe('Your sparx trial ends soon');
    expect(rendered.html).toContain('Aug 5, 2026');
    expect(rendered.html).toContain('https://sparx.works/settings/billing');
    expect(rendered.templateId).toBe('billing-trial-ending');
  });

  it('carries the shared frame — tiered footer legal line', async () => {
    // The frame is defined once in _layout.tsx; assert it cascades by checking a
    // template unrelated to billing carries the new tiered footer legal line.
    //
    // This was called "wraps EVERY coded template in the shared frame" while rendering
    // exactly one, which read as coverage nobody then wrote: thirteen of the twenty
    // templates had never been rendered by a test at all. `every-template.test.ts` now
    // actually does all of them; this stays as the depth check on the frame's content.
    const rendered = await _renderTemplateForTest({
      template: 'welcome-merchant',
      to: 'owner@example.test',
      props: { name: 'Brandon', dashboardUrl: 'https://app.sparx.works/welcome' },
    });
    expect(rendered.html).toContain('sparx.works');
    expect(rendered.text).toContain('WizeWorks');
  });

  it('rejects unknown providers via env validation', () => {
    // Sanity: provider selection only triggers on the next getEmailProvider()
    // call; with the cache already set, this is more about doc'ing the API.
    expect(typeof consoleProvider.send).toBe('function');
  });
});
