import { requireSession } from '@sparx/auth';
import { Badge } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';
import { loadOnboardingProgress } from './onboarding';
import { WelcomeChecklist } from './welcome-checklist';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const { user } = await requireSession();
  const progress = await loadOnboardingProgress(user.tenantId);

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-10">
        <PageHeader
          title="Welcome to sparx"
          badge={progress.state.finishedAt ? <Badge color="success">All set</Badge> : undefined}
          description="A short checklist to get your site production-ready. You can skip and come back any time."
        />

        <WelcomeChecklist progress={progress} />
      </div>
    </div>
  );
}
