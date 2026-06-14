import { Suspense } from 'react';

import { AuthPanel } from '@/components/auth-panel';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Create account', robots: { index: false, follow: false } };

export default function RegisterPage() {
  return (
    <div className="st-container">
      <Suspense fallback={<div className="st-skeleton" style={{ height: 420, maxWidth: 560 }} />}>
        <AuthPanel initial="register" />
      </Suspense>
    </div>
  );
}
