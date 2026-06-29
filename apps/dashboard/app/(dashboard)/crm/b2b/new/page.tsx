import { redirect } from 'next/navigation';

// B2B account creation is canonical at /b2b/accounts/new — the B2B module's own
// collapsed single-page wizard (also what the drawer/modal overlay renders). This
// legacy CRM create route consolidates into it (WS2): kept as a redirect so any
// existing deep link, bookmark, or overlay "maximize" target still resolves to
// the one canonical create surface instead of a second, divergent form.

export default function NewB2bAccountPage() {
  redirect('/b2b/accounts/new');
}
