'use client';

// Client-side customer session state. Hydrates from /account/me on mount and
// exposes login / register / logout. The session itself lives in an httpOnly
// cookie (set by api-rest, relayed by the /api/sparx proxy) — this context only
// mirrors the resolved profile + status for the UI to react to.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as accountApi from '@/lib/customer-client';
import {
  NO_OFFERS,
  type AccountOffers,
  type CartHandoff,
  type Customer,
} from '@/lib/customer-client';
import { retryDelayMs, statusAfterUnansweredRead, type SessionStatus } from '@/lib/shop-reach';

/** `unreachable`: the session read got no answer (api-rest restarting, a network
 *  blip) and nothing had answered before it. It is NOT signed out: nothing may
 *  redirect to sign-in on it, and the provider keeps asking until it hears back
 *  (sparx persona issue 086). */
export type CustomerStatus = SessionStatus;

export interface CustomerContextValue {
  /** The active tenant slug — account pages pass it to the customer-client. */
  tenantSlug: string;
  /** The active site slug (docs/58 D2), if any — storefront islands (e.g. the
   *  newsletter signup) tag captures with their origin site. Undefined = primary. */
  propertySlug?: string;
  customer: Customer | null;
  /** What this shop offers this shopper. `NO_OFFERS` until the read answers, so
   *  nothing is advertised on the strength of not knowing yet. */
  offers: AccountOffers;
  status: CustomerStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Set right after a successful login/register when the server consolidated
   *  the shopper's cart onto a new identity (e.g. merged their guest cart into
   *  a pre-existing customer cart) — CartProvider (a descendant) picks this up
   *  to adopt the new cart id/token instead of showing a stale, now-deleted
   *  guest cart as empty. Null once consumed. */
  cartHandoff: CartHandoff | null;
  clearCartHandoff: () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function useCustomer(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used within <CustomerProvider>');
  return ctx;
}

export function CustomerProvider({
  tenantSlug,
  propertySlug,
  children,
}: {
  tenantSlug: string;
  /** Active site slug (docs/58 D2) — sent on login/register so the membership is
   *  created/resolved on this site. */
  propertySlug?: string;
  children: React.ReactNode;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [offers, setOffers] = useState<AccountOffers>(NO_OFFERS);
  const [status, setStatus] = useState<CustomerStatus>('loading');
  // Sister-site recognition (docs/58 D6): set when a login/register here created
  // a fresh, separate membership because the email already had an account on
  // another of the tenant's sites. Drives the one-time notice below.
  const [recognized, setRecognized] = useState(false);
  const [cartHandoff, setCartHandoff] = useState<CartHandoff | null>(null);
  const clearCartHandoff = useCallback(() => setCartHandoff(null), []);

  // The offers alone, after a sign-in has already said who this is. A failed
  // read keeps the defaults rather than signing her back out.
  const loadOffers = useCallback(async () => {
    try {
      const me = await accountApi.getMe(tenantSlug, propertySlug);
      if (me) setOffers(me.offers);
    } catch {
      // Keep NO_OFFERS: the sign-in itself succeeded.
    }
  }, [tenantSlug, propertySlug]);

  // Only a real "nobody is signed in" signs the page out. A read that got no
  // answer used to land here too, and the account area sent a trade buyer with
  // a valid session to the sign-in page while api-rest restarted (persona issue
  // 086). Now it keeps whatever the page already knew, or says it is retrying.
  //
  // `misses` counts reads in a row that got no answer. State, not a ref: an
  // unanswered retry leaves `status` as it was, and this is what schedules the
  // next one.
  const [misses, setMisses] = useState(0);
  const refresh = useCallback(async () => {
    const read = await accountApi.readSession(tenantSlug, propertySlug);
    if (read.kind === 'unreachable') {
      setStatus(statusAfterUnansweredRead);
      setMisses((n) => n + 1);
      return;
    }
    setMisses(0);
    if (read.kind === 'signed-in') {
      setCustomer(read.customer);
      setOffers(read.offers);
      setStatus('authenticated');
    } else {
      setCustomer(null);
      setOffers(NO_OFFERS);
      setStatus('anonymous');
    }
  }, [tenantSlug, propertySlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // "This page will try again" is a promise, kept here: while the read has no
  // answer, ask again on a backing-off timer, and at once when the browser comes
  // back online or the tab is looked at again. Stops the moment anything answers.
  useEffect(() => {
    if (status !== 'unreachable') return;
    const timer = window.setTimeout(() => void refresh(), retryDelayMs(misses - 1));
    const now = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', now);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', now);
      document.removeEventListener('visibilitychange', now);
    };
  }, [status, misses, refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const {
        customer: me,
        recognized: r,
        cart,
      } = await accountApi.login(tenantSlug, { email, password }, propertySlug);
      setCustomer(me);
      setStatus('authenticated');
      if (r) setRecognized(true);
      if (cart) setCartHandoff(cart);
      // What this shop offers this shopper comes from the account read, which
      // signing in never made. A trade buyer signed in to a menu with no
      // wholesale account in it until she reloaded the page (persona issue 084).
      // Not awaited: the sign-in has succeeded, and a slow read must not hold it.
      void loadOffers();
    },
    [tenantSlug, propertySlug, loadOffers]
  );

  const register = useCallback(
    async (input: { email: string; password: string; firstName?: string; lastName?: string }) => {
      const {
        customer: me,
        recognized: r,
        cart,
      } = await accountApi.register(tenantSlug, input, propertySlug);
      setCustomer(me);
      setStatus('authenticated');
      if (r) setRecognized(true);
      if (cart) setCartHandoff(cart);
      // What this shop offers this shopper comes from the account read, which
      // signing in never made. A trade buyer signed in to a menu with no
      // wholesale account in it until she reloaded the page (persona issue 084).
      // Not awaited: the sign-in has succeeded, and a slow read must not hold it.
      void loadOffers();
    },
    [tenantSlug, propertySlug, loadOffers]
  );

  const logout = useCallback(async () => {
    await accountApi.logout(tenantSlug);
    setCustomer(null);
    setStatus('anonymous');
    setRecognized(false);
  }, [tenantSlug]);

  const value = useMemo<CustomerContextValue>(
    () => ({
      tenantSlug,
      propertySlug,
      customer,
      offers,
      status,
      login,
      register,
      logout,
      refresh,
      cartHandoff,
      clearCartHandoff,
    }),
    [
      tenantSlug,
      propertySlug,
      customer,
      offers,
      status,
      login,
      register,
      logout,
      refresh,
      cartHandoff,
      clearCartHandoff,
    ]
  );

  return (
    <CustomerContext.Provider value={value}>
      {recognized ? (
        <div
          className="border-accent/30 bg-accent/10 text-base-content flex items-center justify-center gap-4 border-b px-5 py-[0.65rem] text-center text-sm"
          role="status"
        >
          <span>
            Welcome back! We recognized your email from another of our sites and created a separate
            account for you here. Your orders and preferences on this site stay private to it.
          </span>
          <button
            type="button"
            className="flex-none cursor-pointer border-0 bg-transparent px-1 text-xl leading-none text-inherit opacity-70 hover:opacity-100"
            aria-label="Dismiss"
            onClick={() => setRecognized(false)}
          >
            ×
          </button>
        </div>
      ) : null}
      {children}
    </CustomerContext.Provider>
  );
}
