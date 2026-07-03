import Link from 'next/link';
import { GraduationCap, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Container,
  EmptyState,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { PartnerLocked } from '../_components/partner-locked';
import { PartnerAccessLocked } from '../_components/partner-access-locked';
import { getPartnerAccess } from '../_lib/access';
import type { Bootcamp, PartnerProfile } from '../_lib/types';
import { BootcampsList } from './_components/bootcamps-list';

// Partner Portal — Bootcamps (docs/114 §B.7). The host's cohort list, with create/
// edit on full-page `embedded` SurfaceFrame routes (never the @detail overlay —
// partner isn't a module). Hosting requires an active partner; a pending partner
// sees the list but the "New" action waits until they're active.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PartnerBootcampsPage({ searchParams }: PageProps) {
  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);
  if (!profile) return <PartnerLocked section="Bootcamps" />;
  const { canOperate } = await getPartnerAccess();
  if (!canOperate) return <PartnerAccessLocked section="Bootcamps" />;

  const params = await searchParams;
  const [prefs, bootcamps] = await Promise.all([
    getUserPreferences(),
    api.get<Bootcamp[]>('/v1/partner/bootcamps').catch(() => [] as Bootcamp[]),
  ]);
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';
  const canHost = profile.status === 'active';

  const newButton = canHost ? (
    <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
      <Link href="/partner/bootcamps/new">New bootcamp</Link>
    </Button>
  ) : undefined;

  return (
    <ModuleProvider module="partner">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<GraduationCap className="h-5 w-5" />}
            title="Bootcamps"
            badge={
              <Badge color="module">
                {bootcamps.length} bootcamp{bootcamps.length === 1 ? '' : 's'}
              </Badge>
            }
            description="Host training cohorts on Sparx. On-platform RSVPs land as leads in your CRM; Certified partners can publish theirs to the public directory."
            actions={newButton}
          />

          {!canHost && (
            <Card>
              <Stack gap={1}>
                <Text size="sm" weight="medium">
                  Hosting unlocks when your partner account is active
                </Text>
                <Text size="sm" variant="muted">
                  Your application is in review. Once you’re an active partner you’ll be able to
                  create and run bootcamps here.
                </Text>
              </Stack>
            </Card>
          )}

          {bootcamps.length === 0 ? (
            <Card padding="none">
              <EmptyState
                icon={<GraduationCap className="h-5 w-5" />}
                title="No bootcamps yet"
                description="Create your first cohort. Save it as a draft, then publish when you’re ready to take registrations."
                action={newButton}
              />
            </Card>
          ) : (
            <>
              <ListToolbar enableViewToggle searchable={false} />
              <BootcampsList rows={bootcamps} view={view} />
            </>
          )}
        </Stack>
      </Container>
    </ModuleProvider>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
