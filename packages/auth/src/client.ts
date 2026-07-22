'use client';

import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, inferAdditionalFields, magicLinkClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import type { Auth } from './server';

// Browser-side Better Auth client. The Next.js dev server proxies
// /api/auth/* to the server-side `auth` handler — so as long as the calling
// app mounts the handler at that path (apps/dashboard does), the client just
// works with no baseURL config.
//
// `inferAdditionalFields<Auth>` lifts the server-side `tenantId` / `role`
// shape onto the client so `useSession()` returns the sparx extensions
// fully typed.
//
// magicLinkClient / emailOTPClient add the passwordless methods that pair with the
// server plugins: `signIn.magicLink({ email, callbackURL })` and
// `emailOtp.sendVerificationOtp` / `signIn.emailOtp`. passkeyClient adds the
// WebAuthn methods (`signIn.passkey`, `passkey.addPasskey`, `passkey.listUserPasskeys`,
// conditional-UI autofill). One Tap is NOT here — its Google client-id is
// app-specific (a NEXT_PUBLIC on the dashboard, a runtime /api/token value on
// the portable workbench image), so each app wires One Tap itself rather than
// baking a client-id into this shared singleton.

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), magicLinkClient(), emailOTPClient(), passkeyClient()],
});

export const { signIn, signUp, signOut, useSession, getSession, emailOtp, passkey } = authClient;
