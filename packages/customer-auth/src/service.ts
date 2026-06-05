// Customer-auth service — register / authenticate / session lifecycle /
// password reset for storefront shoppers. See docs/27.
//
// Every function takes a tenant-scoped context `{ tenantId }` and runs inside
// withTenant(), so Postgres RLS isolates all reads/writes to that tenant. The
// tenant is always known up front (the storefront hostname), so there is no
// pre-tenant lookup and no global-email requirement — the same email can be a
// separate account at every tenant.
//
// Hard rules: passwords stored ONLY as Argon2id hashes; session/reset tokens
// stored ONLY as SHA-256 hashes; login + reset-request are enumeration-safe.

import { withTenant, type TxClient } from '@sparx/db';
import { z } from 'zod';

import { CustomerAuthError } from './errors';
import { dummyVerify, hashPassword, verifyPassword } from './hash';
import {
  RESET_TTL_SECONDS,
  SESSION_REFRESH_THRESHOLD_SECONDS,
  SESSION_TTL_SECONDS,
  expiryFromNow,
  hashToken,
  mintToken,
} from './session';

export interface CustomerAuthContext {
  tenantId: string;
}

/** Optional request metadata recorded on the session row for audit/security. */
export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IssuedSession {
  /** The per-site MEMBERSHIP (a `customers` row) this session belongs to. */
  customerId: string;
  /** Plaintext session token — set as the cookie value; never stored. */
  sessionToken: string;
  expiresAt: Date;
  /** True when this call created the membership for the active site — i.e. the
   *  person already had a login on a SISTER site and we recognized + linked them
   *  here (docs/58 D6). The new membership starts with FRESH consent. */
  recognized?: boolean;
}

const emailSchema = z.string().trim().toLowerCase().email().max(255);

const passwordSchema = z.string().min(8).max(200);

const RegisterInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().max(255).optional(),
  lastName: z.string().trim().max(255).optional(),
});

const LoginInput = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

const ForgotInput = z.object({ email: emailSchema });

const ResetInput = z.object({
  token: z.string().min(1).max(512),
  password: passwordSchema,
});

// ─── session helper ──────────────────────────────────────────────────────

async function openSession(
  tx: TxClient,
  tenantId: string,
  customerId: string,
  credentialId: string,
  meta: SessionMeta
): Promise<IssuedSession> {
  const { token, tokenHash } = mintToken();
  const expiresAt = expiryFromNow(SESSION_TTL_SECONDS);
  await tx.customerSession.create({
    data: {
      tenantId,
      customerId,
      credentialId,
      tokenHash,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return { customerId, sessionToken: token, expiresAt };
}

// ─── membership helper ─────────────────────────────────────────────────────

/**
 * Find or create the per-site MEMBERSHIP (`customers` row) for (property, email)
 * and link it to the tenant-wide identity (docs/58 D2). A pre-existing row on
 * this site (e.g. a guest checkout) is adopted: linked to the identity and
 * promoted prospect → retail. Returns whether the membership was newly created
 * (drives the D6 "recognized" signal). Consent is NEVER copied across sites — a
 * brand-new membership starts with empty `gdprConsent`.
 */
async function ensureMembership(
  tx: TxClient,
  tenantId: string,
  propertyId: string | null,
  email: string,
  identityId: string,
  names: { firstName?: string; lastName?: string }
): Promise<{ customerId: string; created: boolean }> {
  const existing = await tx.customer.findFirst({
    where: { propertyId, email, deletedAt: null },
    select: { id: true, type: true, firstName: true, lastName: true, identityId: true },
  });
  if (existing) {
    await tx.customer.update({
      where: { id: existing.id },
      data: {
        ...(existing.identityId ? {} : { identityId }),
        ...(existing.type === 'prospect' ? { type: 'retail' } : {}),
        ...(names.firstName && !existing.firstName ? { firstName: names.firstName } : {}),
        ...(names.lastName && !existing.lastName ? { lastName: names.lastName } : {}),
      },
    });
    return { customerId: existing.id, created: false };
  }
  const created = await tx.customer.create({
    data: {
      tenantId,
      propertyId,
      identityId,
      type: 'retail',
      email,
      firstName: names.firstName ?? null,
      lastName: names.lastName ?? null,
    },
    select: { id: true },
  });
  return { customerId: created.id, created: true };
}

// ─── register ──────────────────────────────────────────────────────────────

/**
 * Create a storefront account on the active SITE (docs/58 D2). Resolves the
 * tenant-wide IDENTITY for the email:
 *  - No identity / no credential yet → create the identity + credential + a
 *    membership on this site, and open a session.
 *  - Identity already has a credential AND a membership on THIS site → EMAIL_TAKEN.
 *  - Identity has a credential but NO membership here → the person has an account
 *    on a SISTER site. Link them here only if the supplied password matches their
 *    existing login (we can't silently adopt an account); the new membership gets
 *    FRESH consent (D6). Wrong password → EMAIL_TAKEN ("sign in instead").
 * `propertyId` is the active site (null only for tenants with no sites, e.g.
 * tests); a guest `customers` row on this site is adopted, not duplicated.
 */
export function registerCustomer(
  ctx: CustomerAuthContext,
  propertyId: string | null,
  rawInput: unknown,
  meta: SessionMeta = {}
): Promise<IssuedSession> {
  const input = parse(RegisterInput, rawInput);

  return withTenant(ctx, async (tx) => {
    const identity = await tx.customerIdentity.findFirst({
      where: { email: input.email },
      select: { id: true, credential: { select: { id: true, passwordHash: true } } },
    });

    // The email already has a login somewhere in this tenant.
    if (identity?.credential) {
      const membershipHere = await tx.customer.findFirst({
        where: { propertyId, email: input.email, deletedAt: null },
        select: { id: true },
      });
      if (membershipHere) {
        throw new CustomerAuthError('EMAIL_TAKEN', 'An account with that email already exists.');
      }
      // Cross-site link — only if they prove ownership with the right password.
      const ownsAccount = await verifyPassword(identity.credential.passwordHash, input.password);
      if (!ownsAccount) {
        throw new CustomerAuthError('EMAIL_TAKEN', 'An account with that email already exists.');
      }
      const { customerId } = await ensureMembership(
        tx,
        ctx.tenantId,
        propertyId,
        input.email,
        identity.id,
        input
      );
      const session = await openSession(tx, ctx.tenantId, customerId, identity.credential.id, meta);
      return { ...session, recognized: true };
    }

    // No login yet — create the identity (if absent) + its credential.
    const identityId =
      identity?.id ??
      (
        await tx.customerIdentity.create({
          data: { tenantId: ctx.tenantId, email: input.email },
          select: { id: true },
        })
      ).id;

    const passwordHash = await hashPassword(input.password);
    const credential = await tx.customerCredential.create({
      data: { tenantId: ctx.tenantId, identityId, passwordHash },
      select: { id: true },
    });
    const { customerId } = await ensureMembership(
      tx,
      ctx.tenantId,
      propertyId,
      input.email,
      identityId,
      input
    );

    return openSession(tx, ctx.tenantId, customerId, credential.id, meta);
  });
}

// ─── authenticate ────────────────────────────────────────────────────────

/**
 * Verify email + password and open a session. Returns null on any failure
 * (unknown email, no credential, wrong password) — the caller surfaces a single
 * generic "invalid credentials" message. Spends roughly equal CPU whether or
 * not the account exists (dummy verify) to flatten the timing signal.
 */
export function authenticateCustomer(
  ctx: CustomerAuthContext,
  propertyId: string | null,
  rawInput: unknown,
  meta: SessionMeta = {}
): Promise<IssuedSession | null> {
  const input = parse(LoginInput, rawInput);

  return withTenant(ctx, async (tx) => {
    const identity = await tx.customerIdentity.findFirst({
      where: { email: input.email },
      select: { id: true, credential: { select: { id: true, passwordHash: true } } },
    });

    if (!identity?.credential) {
      // No account / no password set — burn equivalent time, then fail.
      await dummyVerify(input.password);
      return null;
    }

    const ok = await verifyPassword(identity.credential.passwordHash, input.password);
    if (!ok) return null;

    await tx.customerCredential.update({
      where: { id: identity.credential.id },
      data: { lastLoginAt: new Date() },
    });

    // Recognition (docs/58 D6): ensure a membership on the active site. A first
    // sign-in here creates one with FRESH consent — never inheriting another
    // site's consent.
    const { customerId, created } = await ensureMembership(
      tx,
      ctx.tenantId,
      propertyId,
      input.email,
      identity.id,
      {}
    );
    const session = await openSession(tx, ctx.tenantId, customerId, identity.credential.id, meta);
    return { ...session, recognized: created };
  });
}

// ─── session verify / revoke ───────────────────────────────────────────────

export interface VerifiedSession {
  customerId: string;
  credentialId: string;
}

/**
 * Resolve a session token to its customer, or null if missing/expired. Slides
 * the expiry forward when it's within the refresh threshold so active shoppers
 * stay logged in.
 */
export function verifyCustomerSession(
  ctx: CustomerAuthContext,
  token: string
): Promise<VerifiedSession | null> {
  if (!token) return Promise.resolve(null);
  const tokenHash = hashToken(token);

  return withTenant(ctx, async (tx) => {
    const session = await tx.customerSession.findFirst({
      where: { tokenHash },
      select: { id: true, customerId: true, credentialId: true, expiresAt: true },
    });
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt.getTime() <= now) {
      // Expired — best-effort cleanup, then deny.
      await tx.customerSession.deleteMany({ where: { id: session.id } });
      return null;
    }

    if (session.expiresAt.getTime() - now < SESSION_REFRESH_THRESHOLD_SECONDS * 1000) {
      await tx.customerSession.update({
        where: { id: session.id },
        data: { expiresAt: expiryFromNow(SESSION_TTL_SECONDS) },
      });
    }

    return { customerId: session.customerId, credentialId: session.credentialId };
  });
}

/** Revoke (delete) the session for a token. Idempotent. */
export function revokeCustomerSession(ctx: CustomerAuthContext, token: string): Promise<void> {
  if (!token) return Promise.resolve();
  const tokenHash = hashToken(token);
  return withTenant(ctx, async (tx) => {
    await tx.customerSession.deleteMany({ where: { tokenHash } });
  });
}

// ─── password reset ──────────────────────────────────────────────────────

export interface ResetRequest {
  /** The tenant-wide identity whose login is being reset. */
  identityId: string;
  email: string;
  /** Plaintext reset token — put in the emailed link; never stored. */
  resetToken: string;
  expiresAt: Date;
}

/**
 * Begin a password reset. Returns the reset token + recipient ONLY when a
 * registered account exists; returns null otherwise. The caller ALWAYS responds
 * with a generic 200 (enumeration-safe) and only sends the email when this
 * returns non-null.
 */
export function requestPasswordReset(
  ctx: CustomerAuthContext,
  rawInput: unknown
): Promise<ResetRequest | null> {
  const input = parse(ForgotInput, rawInput);

  return withTenant(ctx, async (tx) => {
    const identity = await tx.customerIdentity.findFirst({
      where: { email: input.email },
      select: { id: true, email: true, credential: { select: { id: true } } },
    });
    if (!identity?.credential || !identity.email) return null;

    const { token, tokenHash } = mintToken();
    const expiresAt = expiryFromNow(RESET_TTL_SECONDS);
    await tx.customerPasswordReset.create({
      data: { tenantId: ctx.tenantId, identityId: identity.id, tokenHash, expiresAt },
    });

    return { identityId: identity.id, email: identity.email, resetToken: token, expiresAt };
  });
}

/**
 * Consume a reset token and set a new password. Returns true on success, false
 * if the token is unknown, expired, or already used. Invalidates all of the
 * customer's existing sessions on success (force re-login everywhere).
 */
export function resetPassword(ctx: CustomerAuthContext, rawInput: unknown): Promise<boolean> {
  const input = parse(ResetInput, rawInput);
  const tokenHash = hashToken(input.token);

  return withTenant(ctx, async (tx) => {
    const reset = await tx.customerPasswordReset.findFirst({
      where: { tokenHash },
      select: { id: true, identityId: true, expiresAt: true, usedAt: true },
    });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) return false;

    const passwordHash = await hashPassword(input.password);
    const credential = await tx.customerCredential.update({
      where: { identityId: reset.identityId },
      data: { passwordHash },
      select: { id: true },
    });
    await tx.customerPasswordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });
    // Revoke every active session for this IDENTITY (across all its site
    // memberships) — a reset implies the old credential may be compromised.
    await tx.customerSession.deleteMany({ where: { credentialId: credential.id } });
    return true;
  });
}

// ─── helpers ───────────────────────────────────────────────────────────────

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new CustomerAuthError(
      'INVALID_INPUT',
      result.error.issues[0]?.message ?? 'Invalid input.'
    );
  }
  return result.data;
}
