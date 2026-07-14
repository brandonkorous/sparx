'use client';

// Client-side customer session state. Hydrates from /account/me on mount and
// exposes login / register / logout. The session itself lives in an httpOnly
// cookie (set by api-rest, relayed by the /api/sparx proxy) — this context only
// mirrors the resolved profile + status for the UI to react to.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as accountApi from '@/lib/customer-client';
import type { CartHandoff, Customer } from '@/lib/customer-client';

export type CustomerStatus = 'loading' | 'authenticated' | 'anonymous';

export interface CustomerContextValue {
  /** The active tenant slug — account pages pass it to the customer-client. */
  tenantSlug: string;
  /** The active site slug (docs/58 D2), if any — storefront islands (e.g. the
   *  newsletter signup) tag captures with their origin site. Undefined = primary. */
  propertySlug?: string;
  customer: Customer | null;
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
  const [status, setStatus] = useState<CustomerStatus>('loading');
  // Sister-site recognition (docs/58 D6): set when a login/register here created
  // a fresh, separate membership because the email already had an account on
  // another of the tenant's sites. Drives the one-time notice below.
  const [recognized, setRecognized] = useState(false);
  const [cartHandoff, setCartHandoff] = useState<CartHandoff | null>(null);
  const clearCartHandoff = useCallback(() => setCartHandoff(null), []);

  const refresh = useCallback(async () => {
    try {
      const me = await accountApi.getMe(tenantSlug);
      setCustomer(me);
      setStatus(me ? 'authenticated' : 'anonymous');
    } catch {
      setCustomer(null);
      setStatus('anonymous');
    }
  }, [tenantSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    },
    [tenantSlug, propertySlug]
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
    },
    [tenantSlug, propertySlug]
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
        <div className="st-recognition" role="status">
          <span>
            Welcome back! We recognized your email from another of our sites and created a separate
            account for you here — your orders and preferences on this site stay private to it.
          </span>
          <button
            type="button"
            className="st-recognition__close"
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
