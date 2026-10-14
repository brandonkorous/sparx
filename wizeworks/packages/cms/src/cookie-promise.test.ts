// Does a Cookie Policy tell visitors where to make cookie choices? The starter one
// does; a journal's, rewritten for a site with only the cookies it needs, does not,
// and its owner must not be told it promises a banner (persona issue 947).

import { describe, expect, it } from 'vitest';

import { LEGAL_TEMPLATES } from '@wizeworks/legal-templates';
import { promisesCookieChoices } from './legal-service';

const doc = (...paragraphs: string[]) => ({
  body: {
    type: 'doc',
    content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  },
});

describe('promisesCookieChoices', () => {
  it('is true for the starter Cookie Policy', () => {
    const starter = LEGAL_TEMPLATES.find((t) => t.legalKind === 'cookie-policy')!;
    expect(promisesCookieChoices({ body: starter.doc })).toBe(true);
  });

  it('is false for a policy that promises no banner and no button', () => {
    expect(
      promisesCookieChoices(
        doc(
          'Only the cookies the site needs to work.',
          'Because we use only the cookies the site needs, there is nothing for you to switch on or off.'
        )
      )
    ).toBe(false);
  });
});
