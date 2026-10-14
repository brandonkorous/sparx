import { describe, expect, it } from 'vitest';
import { publishDescription } from './email-publish-words';

/**
 * WHAT PUBLISHING DOES, said for the email in hand (sparx persona issue 156).
 *
 * Every email's Publish confirm said "makes this exact design the one your
 * customers receive from now on". True of the Welcome email sparx sends by
 * itself. Said over a fleet newsletter it reads as "this emails everyone now",
 * and publishing one sends nothing.
 */
describe('the Publish confirm', () => {
  it('says an automatic email is what sparx sends from now on', () => {
    const words = publishDescription({ key: 'welcome-customer' });
    expect(words).toContain('sends by itself');
    expect(words).not.toMatch(/sends nothing/);
  });

  it('says publishing an email you send yourself sends nothing', () => {
    const words = publishDescription({ key: null });
    expect(words).toMatch(/sends nothing/i);
    expect(words).toContain('Write an email');
    expect(words).not.toContain('receive from now on');
  });
});
