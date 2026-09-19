// A CHOICE THE SCREEN OFFERS HAS TO BE READ BACK.
//
// The compose form asks "Where it is offered: this site only, or all my sites".
// The list then showed the name, the shortcut and the message, and nothing about
// the answer — on an account running seven websites, where the list is a
// deliberate mix of both tiers.
//
// And the delete confirm described a one-site loss for a reply that goes from
// every site at once.

import { describe, expect, it } from 'vitest';

import {
  changedReplyFields,
  deleteReplyWarning,
  editFormWords,
  fixedShortcutNote,
  isSharedReply,
  replyScopeNote,
  savedReplyWords,
  scopeOf,
  shortcutIsFixed,
  type EditableReply,
  type ReplyDraft,
} from './quick-reply-words';

const shared = { title: 'Greeting', propertyId: null };
const mine = { title: 'Autumn drop', propertyId: 'site-1' };

describe('a business with one site', () => {
  it('reads nothing about sites it does not have', () => {
    // The same rule the shared SiteScopeField states: an always-on note reading
    // "every site" is noise on the one-site case.
    expect(replyScopeNote(shared, 1)).toBe(null);
    expect(replyScopeNote(mine, 1)).toBe(null);
  });

  it('is not warned about six other shops when deleting', () => {
    expect(deleteReplyWarning(shared, 1)).toBe(
      'Your team will no longer be able to send this saved reply. This cannot be undone.'
    );
  });
});

describe('a business running several sites', () => {
  it('names BOTH states, so a bare row never means the other thing', () => {
    expect(replyScopeNote(shared, 7)).toBe('All my sites');
    expect(replyScopeNote(mine, 7)).toBe('This site only');
  });

  it('uses the same words the compose form offered', () => {
    // She picked one of two labels. The list has to say one of those two labels
    // back, not a synonym.
    const labels = ['This site only', 'All my sites'];
    expect(labels).toContain(replyScopeNote(shared, 7));
    expect(labels).toContain(replyScopeNote(mine, 7));
  });
});

describe('deleting a reply that every site offers', () => {
  it('says how many sites it goes from', () => {
    const line = deleteReplyWarning(shared, 7);
    expect(line).toContain('all 7 of your sites');
    expect(line).toContain('every one of them');
  });

  it('leaves a one-site reply described as the one-site loss it is', () => {
    expect(deleteReplyWarning(mine, 7)).toBe(
      'Your team will no longer be able to send this saved reply. This cannot be undone.'
    );
  });
});

describe('the shared flag itself', () => {
  it('is the null property, not a missing one', () => {
    expect(isSharedReply(shared)).toBe(true);
    expect(isSharedReply(mine)).toBe(false);
  });
});

// ─── CHANGING ONE RATHER THAN DELETING IT AND TYPING IT AGAIN ───────────────
//
// Every row on this screen had exactly one button: a red bin. The seven replies
// the platform seeds when the chat box is switched on are deliberately generic
// starting copy, and one of them says "Business hours: Monday to Friday, 9am to
// 5pm". A shop open Thursday to Sunday had to DELETE that reply and retype it
// from nothing, remembering the shortcut and the site choice, with the reply
// missing from her team's inbox in between.

const saved: EditableReply = {
  title: 'Business hours',
  body: 'Our team is here Monday to Friday, 9am to 5pm.',
  shortcut: 'hours',
  propertyId: null,
};

const unshortcut: EditableReply = {
  title: 'Linen care',
  body: 'Cool machine wash, line dry.',
  shortcut: null,
  propertyId: 'site-1',
};

const asDraft = (reply: EditableReply): ReplyDraft => ({
  title: reply.title,
  body: reply.body,
  shortcut: reply.shortcut ?? '',
  scope: scopeOf(reply),
});

describe('what the boxes would actually change', () => {
  it('finds nothing in a reply she only opened and read', () => {
    // The rule the review queue learnt the hard way: a decision that changes
    // nothing is not recorded as one, and is not reported as one either.
    expect(changedReplyFields(saved, asDraft(saved), 'site-1')).toEqual([]);
  });

  it('names the wording when she fixes the hours', () => {
    const draft = { ...asDraft(saved), body: 'We are open Thursday to Sunday, 10am to 6pm.' };
    expect(changedReplyFields(saved, draft, 'site-1')).toEqual(['body']);
  });

  it('ignores space she typed and then removed', () => {
    const draft = { ...asDraft(saved), title: '  Business hours  ' };
    expect(changedReplyFields(saved, draft, 'site-1')).toEqual([]);
  });

  it('never reports the shortcut of a reply already in use', () => {
    // It is shown as a fact, not as a box, so it cannot have been edited — and
    // a difference reported here would be sent and refused by the server.
    const draft = { ...asDraft(saved), shortcut: 'opening' };
    expect(changedReplyFields(saved, draft, 'site-1')).toEqual([]);
  });

  it('does report the FIRST shortcut on a reply that had none', () => {
    const draft = { ...asDraft(unshortcut), shortcut: 'linen' };
    expect(changedReplyFields(unshortcut, draft, 'site-1')).toEqual(['shortcut']);
  });

  it('reports a move between her businesses', () => {
    const draft = { ...asDraft(unshortcut), scope: 'all' as const };
    expect(changedReplyFields(unshortcut, draft, 'site-1')).toEqual(['scope']);
  });

  it('leaves scope alone while it does not yet know which site it is on', () => {
    // A guess here silently drags a reply between her seven businesses. Not
    // knowing is a reason to leave it where it is, never to pick one.
    const draft = { ...asDraft(unshortcut), scope: 'all' as const };
    expect(changedReplyFields(unshortcut, draft, null)).toEqual([]);
  });
});

describe('the shortcut, once people are typing it', () => {
  it('is fixed on a reply that has one', () => {
    expect(shortcutIsFixed(saved)).toBe(true);
  });

  it('is still open on a reply that never had one', () => {
    // Giving a reply its first shortcut breaks no habit, because there is no
    // habit. This is the whole reason the rule is not simply "never".
    expect(shortcutIsFixed(unshortcut)).toBe(false);
    expect(shortcutIsFixed({ ...saved, shortcut: '   ' })).toBe(false);
  });

  it('says WHY it is fixed, and what to do instead', () => {
    const note = fixedShortcutNote(saved);
    expect(note).toContain('/hours');
    expect(note).toContain('Delete this reply and make another');
  });
});

describe('what the form calls itself', () => {
  it('is an add form until a reply is loaded into it', () => {
    expect(editFormWords(null)).toEqual({
      heading: 'Add a quick reply',
      submit: 'Add quick reply',
      note: null,
    });
  });

  it('names the reply it is changing, so the same three boxes are not ambiguous', () => {
    const words = editFormWords(saved);
    expect(words.heading).toContain('Business hours');
    expect(words.submit).toBe('Save changes');
    expect(words.note).toContain('Conversations already sent are untouched');
  });
});

describe('what it says after Save', () => {
  it('does not report work it did not do', () => {
    const words = savedReplyWords(saved, 0);
    expect(words.title).toBe('Nothing to change');
    expect(words.type).toBe('info');
  });

  it('names the reply that moved', () => {
    const words = savedReplyWords(saved, 1);
    expect(words.title).toContain('Business hours');
    expect(words.type).toBe('success');
  });
});
