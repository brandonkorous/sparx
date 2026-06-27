// Finance → Receivables (docs/110 Slice 4c) — money owed TO the merchant: every open
// invoice across Invoicing documents and B2B accounts, in one aging rollup, with deep
// links to author or collect. AR is invoicing functionality, so the page is gated on
// the invoicing module (B2B/Commerce tenants get it free via BUNDLED_FREE) and tinted
// with the invoicing hue (color-follows-functionality). The aging report itself spans
// both systems — invoicing and B2B share the one BillingDocument substrate.

import Link from 'next/link';
import { ArrowRight, Building2, FileText, ReceiptText } from 'lucide-react';
import { isModuleEnabled, requireSession } from '@sparx/auth';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

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
      className="group flex items-center gap-3 rounded-lg border border-[var(--color-border-default)] p-4 transition-colors hover:border-[var(--module-active)]"
    >
      <span aria-hidden className="text-[var(--module-active)]">
        <Icon className="h-5 w-5" />
      </span>
      <Stack gap={0} className="flex-1">
        <Text weight="medium">{label}</Text>
        <Text size="xs" variant="muted">
          {description}
        </Text>
      </Stack>
      <ArrowRight className="h-4 w-4 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5" />
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
    <ModuleProvider module="invoicing">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<ReceiptText className="h-5 w-5" />}
            title="Receivables"
            description="Money owed to you. Every open invoice across Invoicing and B2B, aged so you know what to chase and what's still on terms."
          />

          {allCurrent ? (
            <Card variant="module">
              <CardHeader>
                <Stack direction="row" align="center" gap={2}>
                  <CardTitle>Accounts receivable</CardTitle>
                  <Badge color="success" variant="soft">
                    All current
                  </Badge>
                </Stack>
              </CardHeader>
              <CardContent>
                <Text size="sm" variant="muted" className="max-w-prose">
                  Nothing outstanding — every invoice is paid. New unpaid invoices and their aging
                  will appear here as you bill customers and accounts.
                </Text>
              </CardContent>
            </Card>
          ) : (
            <ArAgingPanel aging={aging} />
          )}

          <Stack gap={2}>
            <Text size="sm" weight="medium">
              Create &amp; collect
            </Text>
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
          </Stack>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
