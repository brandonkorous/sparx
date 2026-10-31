import { accountOperationHandlers } from '@wizeworks/auth-client-server';

// The Security surface's calls: change password, devices, sign-in methods, and
// the four two-step steps.
//
// Each used to be its own route holding a Better Auth instance. They run in
// api-rest now (`/auth/sparx/platform/account/<op>`), which holds the only
// instance, so this one route forwards every `/api/account/*` call there with
// the session cookie and relays the answer as it came, including any new
// session cookie: a password change or a two-step step replaces the session.
//
// What may be done is api-rest's list, not this route's. An address with no
// operation behind it answers 404 from there.

export const dynamic = 'force-dynamic';

export const { GET, POST } = accountOperationHandlers();
