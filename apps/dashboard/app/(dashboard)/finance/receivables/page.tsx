// Finance → Receivables (docs/110 Slice 4c) — money owed TO the merchant: every open
// invoice across Invoicing documents and B2B accounts, in one aging rollup, with deep
// links to author or collect. AR is invoicing functionality, so the page is gated on
// the invoicing module (B2B/Commerce tenants get it free via BUNDLED_FREE) but wears the
// Finance hue — a Finance section, and Finance owns its color (docs/109). The report spans
// both systems — invoicing and B2B share the one BillingDocument substrate.

import Link from 'next/link';
import { ArrowRight, Building2, FileText, ReceiptText } from 'lucide-react';
import { isModuleEnabled, requireSession } from '@sparx/auth';
import { Badge, Card, CardBody, CardTitle } from 'silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { requireModuleOrUpsell } from '@/components/module-gate';

import { getArAging } from './actions';
import { ArAgingPanel } from './_components/ar-aging-panel';

export const dynamic = 'force-dynamic';

function CollectLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-box border-base-300 hover:border-module flex items-center gap-3 border p-4 transition-colors"
    >
      <span aria-hidden className="text-module">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex flex-1 flex-col">
        <p className="font-medium">{label}</p>
        <p className="text-base-content/70 text-xs">{description}</p>
      </div>
      <ArrowRight className="text-base-content/50 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default async function ReceivablesPage(): Promise<React.JSX.Element> {
  const upsell = await requireModuleOrUpsell('invoicing');
  if (upsell) return <>{upsell}</>;

  const session = await requireSession();
  const [aging, hasB2b] = await Promise.all([
    getArAging(),
    isModuleEnabled(session.user.tenantId, 'b2b'),
  ]);
  const allCurrent = !aging || aging.totalCount === 0;

  return (
    <ModuleProvider module="finance">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<ReceiptText className="h-5 w-5" />}
            title="Receivables"
            description="Money owed to you. Every open invoice across Invoicing and B2B, aged so you know what to chase and what's still on terms."
          />

          {allCurrent ? (
            <Card className="bg-module bg-soft">
              <CardBody>
                <div className="flex items-center gap-2">
                  <CardTitle>Accounts receivable</CardTitle>
                  <Badge color="success" variant="soft">
                    All current
                  </Badge>
                </div>
                <p className="text-base-content/70 max-w-prose text-sm">
                  Nothing outstanding — every invoice is paid. New unpaid invoices and their aging
                  will appear here as you bill customers and accounts.
                </p>
              </CardBody>
            </Card>
          ) : (
            <ArAgingPanel aging={aging} />
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Create &amp; collect</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CollectLink
                href="/invoicing/documents"
                icon={FileText}
                label="Invoicing documents"
                description="Estimates, invoices, and receipts — author and record payments."
              />
              {hasB2b && (
                <CollectLink
                  href="/b2b/invoices"
                  icon={Building2}
                  label="B2B invoices"
                  description="Net-terms invoices by account — track and collect."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </ModuleProvider>
  );
}
