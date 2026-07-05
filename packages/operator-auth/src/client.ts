'use client';

import { createAuthClient } from 'better-auth/react';

// Browser-side Better Auth client for the operator console. apps/admin mounts
// the operator handler at /api/auth/*, so no baseURL config is needed. No
// additionalFields (operators carry no tenantId/role — capabilities are loaded
// server-side, never trusted from the client).

export const operatorAuthClient = createAuthClient({});

export const { signIn, signOut, useSession, resetPassword } = operatorAuthClient;

// better-auth 1.6 renamed the reset-request client method to `requestPasswordReset`;
// re-export it under the conventional `forgetPassword` name the console UI uses.
export const forgetPassword = operatorAuthClient.requestPasswordReset;
