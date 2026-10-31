import 'server-only';

import { platformRequest, PlatformRequestError } from '@wizeworks/auth-client-server';

// A team invitation, read from api-rest (docs/154). Anyone holding the link may
// see who invited them and to what, which is what the email already said.

export interface InvitationDetail {
  id: string;
  email: string;
  organizationId: string;
  orgName: string;
  role: string;
  inviterName: string;
  status: string;
  expiresAt: Date;
}

/** The invitation, or null when there is none (or it belongs to another
 *  product's business, which reads the same). */
export async function readInvitation(id: string): Promise<InvitationDetail | null> {
  try {
    const { invitation } = await platformRequest<{
      invitation: Omit<InvitationDetail, 'expiresAt'> & { expiresAt: string };
    }>(`invitations/${encodeURIComponent(id)}`);
    return { ...invitation, expiresAt: new Date(invitation.expiresAt) };
  } catch (err) {
    if (err instanceof PlatformRequestError && err.status === 404) return null;
    throw err;
  }
}
