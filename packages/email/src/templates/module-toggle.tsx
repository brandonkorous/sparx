import * as React from 'react';
import { PlatformEmailLayout } from './_layout';
import {
  EmailActionButton,
  EmailDisplayHeading,
  EmailFinePrint,
  EmailParagraph,
  usePlatformName,
} from '../components';

export interface ModuleToggleEmailProps {
  /** true = activated, false = deactivated. */
  enabled: boolean;
  /** Account/business name (falls back to "there"). */
  accountName?: string;
  /** The module's human name, e.g. "Commerce", "Email", "Bookings". */
  moduleName: string;
  /** Dashboard link (the module, when enabled; billing, when disabled). */
  dashboardUrl: string;
}

// PLATFORM email (sparx → account owner) — a module was turned on or off. Modules
// carry a billing implication, so the owner gets a confirmation either way.
export function ModuleToggleEmail({
  enabled,
  accountName,
  moduleName,
  dashboardUrl,
}: ModuleToggleEmailProps) {
  const platform = usePlatformName();
  const hi = accountName ? `Hi ${accountName}, ` : '';
  return (
    <PlatformEmailLayout
      preview={enabled ? `${moduleName} is now on` : `${moduleName} has been turned off`}
      footerLinks={[{ label: 'Manage modules', href: dashboardUrl }]}
      footerReason={`You're receiving this because a module on your ${platform} account changed.`}
    >
      {enabled ? (
        <>
          <EmailDisplayHeading>{moduleName} is ready</EmailDisplayHeading>
          <EmailParagraph>
            {hi}the {moduleName} module is now switched on for your account — everything it adds is
            available in your dashboard right away.
          </EmailParagraph>
          <EmailActionButton href={dashboardUrl}>Open {moduleName}</EmailActionButton>
          <EmailFinePrint>
            {moduleName} is now included on your plan. You can turn it off any time from your
            settings.
          </EmailFinePrint>
        </>
      ) : (
        <>
          <EmailDisplayHeading>{moduleName} was turned off</EmailDisplayHeading>
          <EmailParagraph>
            {hi}the {moduleName} module has been switched off for your account. Its features are no
            longer active, and you won&apos;t be billed for it going forward.
          </EmailParagraph>
          <EmailActionButton href={dashboardUrl} variant="ghost">
            Manage modules
          </EmailActionButton>
          <EmailFinePrint>
            Your data isn&apos;t deleted — turn {moduleName} back on any time to pick up where you
            left off.
          </EmailFinePrint>
        </>
      )}
    </PlatformEmailLayout>
  );
}

export function moduleToggleSubject(enabled: boolean, moduleName: string): string {
  return enabled ? `${moduleName} is now on` : `${moduleName} has been turned off`;
}
