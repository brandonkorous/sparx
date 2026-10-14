// The unsubscribe link carries the campaign it came from, signed, and a campaign drawn
// once for every reader gets each reader's own link (piggles persona issue 985).

import { describe, expect, it } from 'vitest';
import { UNSUBSCRIBE_PLACEHOLDER } from '@wizeworks/email/silica';

import {
  personalizeUnsubscribe,
  signUnsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from './email-unsubscribe.js';

const TENANT = 'a4a12945-5721-4599-a0ca-631a9e9a8afe';
const CAMPAIGN = 'ba093c6b-eb72-44fb-8f04-f10dc3b6b024';

describe('the unsubscribe token', () => {
  it('carries the campaign it came from', () => {
    expect(
      verifyUnsubscribeToken(signUnsubscribeToken(TENANT, 'Owen@Example.net', CAMPAIGN))
    ).toEqual({
      tenantId: TENANT,
      email: 'owen@example.net',
      broadcastId: CAMPAIGN,
    });
  });

  it('still reads a link sent before it carried one', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken(TENANT, 'owen@example.net'))).toEqual({
      tenantId: TENANT,
      email: 'owen@example.net',
      broadcastId: null,
    });
  });

  it('refuses a campaign swapped into somebody else’s link', () => {
    const real = signUnsubscribeToken(TENANT, 'owen@example.net', CAMPAIGN);
    const other = signUnsubscribeToken(TENANT, 'owen@example.net', 'another-campaign');
    const forged = `${real.split('.')[0]!.split('~')[0]}~${other.split('~')[1]!.split('.')[0]}.${real.split('.')[1]}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });
});

describe('a campaign drawn once for every reader', () => {
  const body = {
    html: `<a href="${UNSUBSCRIBE_PLACEHOLDER}">Unsubscribe</a>`,
    text: `Unsubscribe (${UNSUBSCRIBE_PLACEHOLDER})`,
  };

  it('gets this reader’s own link, in the HTML and the text, and the mail-app header', () => {
    const url = unsubscribeUrl(TENANT, 'owen@example.net', CAMPAIGN);
    const own = personalizeUnsubscribe(body, UNSUBSCRIBE_PLACEHOLDER, url);
    expect(own.html).toBe(`<a href="${url}">Unsubscribe</a>`);
    expect(own.text).toBe(`Unsubscribe (${url})`);
    expect(own.headers).toEqual({
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('leaves a body with no placeholder alone, and adds no header', () => {
    const plain = { html: '<p>Hi</p>', text: 'Hi' };
    expect(personalizeUnsubscribe(plain, UNSUBSCRIBE_PLACEHOLDER, 'https://x.test/u')).toEqual(
      plain
    );
  });
});
