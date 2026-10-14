import { describe, expect, it } from 'vitest';
import { emailToShow, renameToCommit, withCreatedEmail } from './email-switching';

/**
 * NAMING A NEW EMAIL RENAMED THE WELCOME EMAIL (sparx persona issue 153).
 *
 * "+" made "Untitled email" and opened its name box. The list had not been
 * refetched yet, so the designer fell back to the first email, the automatic
 * Welcome email, and the name typed for the new one went onto Welcome.
 */
describe('a new email', () => {
  const welcome = { id: 'welcome', name: 'Welcome' };
  const dayThree = { id: 'day-3', name: 'Welcome: day 3' };
  const made = { id: 'fleet', name: 'Untitled email' };

  it('is in the list the moment it is made, so the designer stays on it', () => {
    const list = withCreatedEmail([welcome, dayThree], made);
    expect(emailToShow(list, made.id, undefined)).toBe(made.id);
  });

  it('is not listed twice once the refetch brings it back', () => {
    const list = withCreatedEmail([welcome, dayThree, made], made);
    expect(list.filter((email) => email.id === made.id)).toHaveLength(1);
  });

  it('takes the name typed for it, even if another email is showing by then', () => {
    const list = [welcome, dayThree, made];
    expect(renameToCommit(list, made.id, 'Fleet winter readiness, November 2026')).toEqual({
      id: made.id,
      name: 'Fleet winter readiness, November 2026',
    });
  });

  it('renames nothing when the box was opened for an email that is gone', () => {
    expect(renameToCommit([welcome], made.id, 'Fleet winter readiness')).toBeNull();
  });
});

describe('the email to show', () => {
  const welcome = { id: 'welcome', name: 'Welcome' };
  const reminder = { id: 'reminder', name: 'Invoice reminder' };

  it('keeps the active email, else the linked one, else the first', () => {
    expect(emailToShow([welcome, reminder], 'reminder', undefined)).toBe('reminder');
    expect(emailToShow([welcome, reminder], null, 'reminder')).toBe('reminder');
    expect(emailToShow([welcome, reminder], null, undefined)).toBe('welcome');
    expect(emailToShow([], null, undefined)).toBeNull();
  });
});
