'use client';

import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';

// Browser-side Better Auth client for the operator console. wizeworks/apps/admin mounts
// the operator handler at /api/auth/*, so no baseURL config is needed. No
// additionalFields (operators carry no tenantId/role — capabilities are loaded
// server-side, never trusted from the client).
//
// twoFactorClient is configured with neither `twoFactorPage` nor
// `onTwoFactorRedirect`: both navigate the browser on the app's behalf, and
// `twoFactorPage` does it with a full reload. Left off, `signIn.email` simply
// answers `{ twoFactorRedirect: true }` and the sign-in page swaps to its own
// challenge step in place.

export const operatorAuthClient = createAuthClient({ plugins: [twoFactorClient()] });

export const { signIn, signOut, useSession, resetPassword, twoFactor } = operatorAuthClient;

// better-auth 1.6 renamed the reset-request client method to `requestPasswordReset`;
// re-export it under the conventional `forgetPassword` name the console UI uses.
export const forgetPassword = operatorAuthClient.requestPasswordReset;
