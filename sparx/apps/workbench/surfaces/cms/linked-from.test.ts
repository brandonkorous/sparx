import { describe, expect, it } from 'vitest';
import { brokenLinksSentence, type LinkingThing } from './linked-from';

const mill: LinkingThing = {
  kind: 'entry',
  id: 'e1',
  title: 'The last mill on the Nene',
  live: true,
};
const page = (title: string): LinkingThing => ({ kind: 'page', id: title, title, live: true });

describe('brokenLinksSentence', () => {
  it('says nothing when nothing links here', () => {
    expect(brokenLinksSentence([], 'delete')).toBeNull();
  });

  it('names the one piece whose link would break', () => {
    expect(brokenLinksSentence([mill], 'delete')).toBe(
      '“The last mill on the Nene” links to this. After you delete it, that link will lead readers to a page that is not there.'
    );
    expect(brokenLinksSentence([mill], 'take down')).toMatch(/^“The last mill.* While it is down,/);
  });

  it('counts many and names the first three', () => {
    const sentence = brokenLinksSentence(
      [mill, page('About'), page('Contributors'), page('Archive'), page('Ledger')],
      'delete'
    );
    expect(sentence).toBe(
      '5 of your pages link to this: “The last mill on the Nene”, “About”, “Contributors” and 2 more. After you delete it, those links will lead readers to a page that is not there.'
    );
  });

  it('calls a layout what she sees it as', () => {
    expect(
      brokenLinksSentence([{ kind: 'layout', id: 'l', title: 'Default', live: true }], 'delete')
    ).toMatch(/^Your site’s header or footer links to this/);
  });
});
