// The sign-in and sign-up pages name the business an invitee is joining
// (persona issue 124).

import { describe, expect, it, vi } from 'vitest';

const getInvitationDetail = vi.fn();
vi.mock('@wizeworks/auth', () => ({ getInvitationDetail }));

const { invitationIdFrom, joiningFrom } = await import('./invite-joining');

const ID = '367ea3c6-3866-48c8-a566-15091532d6c7';

describe('invitationIdFrom', () => {
  it('reads the invitation from the return address', () => {
    expect(invitationIdFrom(`/accept-invite?invitation=${ID}`)).toBe(ID);
  });

  it('is nothing for any other return address', () => {
    expect(invitationIdFrom('/')).toBeNull();
    expect(invitationIdFrom('/oauth/consent?client_id=x')).toBeNull();
    expect(invitationIdFrom('/accept-invite')).toBeNull();
    // An `invitation` on some other page is not an invitation link.
    expect(invitationIdFrom(`/settings/team?invitation=${ID}`)).toBeNull();
  });
});

describe('joiningFrom', () => {
  it('names the business and the invited address for a live invitation', async () => {
    getInvitationDetail.mockResolvedValue({
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000),
      orgName: 'Gillett Diesel Service, Inc.',
      email: 'kendra.ruiz@gillettdiesel.test',
    });
    expect(await joiningFrom(`/accept-invite?invitation=${ID}`)).toEqual({
      orgName: 'Gillett Diesel Service, Inc.',
      email: 'kendra.ruiz@gillettdiesel.test',
    });
  });

  it('says nothing about an invitation already used', async () => {
    getInvitationDetail.mockResolvedValue({
      status: 'accepted',
      expiresAt: new Date(Date.now() + 86_400_000),
      orgName: 'Gillett Diesel Service, Inc.',
      email: 'kendra.ruiz@gillettdiesel.test',
    });
    expect(await joiningFrom(`/accept-invite?invitation=${ID}`)).toBeNull();
  });
});
