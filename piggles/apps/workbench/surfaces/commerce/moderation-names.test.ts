import { describe, expect, it } from 'vitest';
import { customerAccountNote, customerLabel } from './moderation-names';

// The row this exists for: a question signed "Tomas Villalobos" on her website,
// which her console called "Marguerite Adeyemi" — the account it came from. If
// that shopper writes in, the name they used finds nothing (issue 641).

const marguerite = {
  firstName: 'Marguerite',
  lastName: 'Adeyemi',
  email: 'marguerite.adeyemi@example.com',
};

describe('whose words these are', () => {
  it('leads with the name her website publishes', () => {
    expect(customerLabel(marguerite, 'Tomas Villalobos')).toBe('Tomas Villalobos');
  });

  it('still names the account underneath, so nothing is lost', () => {
    expect(customerAccountNote(marguerite, 'Tomas Villalobos')).toBe(
      "from Marguerite Adeyemi's account"
    );
  });

  it('says nothing extra when the two names are the same', () => {
    // A shopper who signed with their own name gains no second line repeating it.
    expect(customerAccountNote(marguerite, 'Marguerite Adeyemi')).toBeNull();
  });

  it('says nothing extra for a guest, who has no account to name', () => {
    expect(customerLabel(null, 'Tessa Wren')).toBe('Tessa Wren');
    expect(customerAccountNote(null, 'Tessa Wren')).toBeNull();
  });

  it('never leaves two signed reviews reading the same', () => {
    // sparx's table ignored the signed name entirely, so every guest was
    // "A guest" and two different people were indistinguishable.
    expect(customerLabel(null, 'Tessa Wren')).not.toBe(customerLabel(null, 'Nia Okonkwo'));
  });

  it('falls back to the account, then the email, then a plain word', () => {
    expect(customerLabel(marguerite, null)).toBe('Marguerite Adeyemi');
    expect(customerLabel({ firstName: null, lastName: null, email: 'nia@example.com' }, null)).toBe(
      'nia@example.com'
    );
    expect(customerLabel(null, null)).toBe('A guest');
  });

  it('treats a name of only spaces as no name', () => {
    expect(customerLabel(marguerite, '   ')).toBe('Marguerite Adeyemi');
    expect(customerAccountNote(marguerite, '   ')).toBeNull();
  });
});
