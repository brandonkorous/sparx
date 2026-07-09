import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader, statusLabel, statusTone } from '@sparx/ui';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { GitCompare, History } from 'lucide-react';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import { RestoreButton } from './restore-button';

export const dynamic = 'force-dynamic';

interface RevisionMeta {
  revision_number: number;
  kind: 'autosave' | 'manual';
  status: string;
  summary: string | null;
  author_id: string | null;
  created_at: string;
}

interface EntryBasics {
  id: string;
  slug: string | null;
  body: { title?: string } & Record<string, unknown>;
  status: string;
}

interface TenantUser {
  id: string;
  name: string | null;
  email: string | null;
}

export default async function RevisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let entry: EntryBasics;
  let revisions: RevisionMeta[];
  let users: TenantUser[];
  try {
    [entry, revisions, users] = await Promise.all([
      api.get<EntryBasics>(`/v1/content/entries/${id}`),
      api.get<RevisionMeta[]>(`/v1/content/entries/${id}/revisions`),
      // Resolve each revision's author_id → a person, not a raw id.
      api.get<TenantUser[]>('/v1/users?take=200'),
    ]);
  } catch (err) {
    if ((err as ApiRestError).status === 404) notFound();
    throw err;
  }
  const authorNameById = new Map(users.map((u) => [u.id, u.name ?? u.email ?? null]));

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <div className="flex flex-col gap-2">
          <PageHeader
            className="mb-0"
            icon={<History className="h-5 w-5" />}
            title="Revision history"
            badge={
              <Badge color="neutral" variant="soft" size="sm">
                {revisions.length}
              </Badge>
            }
            description={
              <>
                Every save creates a revision. Click <strong>Restore</strong> to copy that
                revision&apos;s content back onto the current entry — your edits never disappear;
                restores create a fresh revision instead of overwriting history.
              </>
            }
          />
          <p className="text-base-content/70 text-sm">
            Editing: <strong>{entry.body.title ?? '(untitled)'}</strong>
            {entry.slug && (
              <>
                {' '}
                <code>/{entry.slug}</code>
              </>
            )}
          </p>
        </div>

        {revisions.length === 0 ? (
          <Card className="bg-module bg-soft">
            <CardBody>
              <p>No revisions yet. Save the entry to create the first one.</p>
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {revisions.map((r) => (
              <Card key={r.revision_number}>
                <CardBody>
                  <div className="flex flex-row items-center justify-between gap-4">
                    <div className="flex flex-row items-center gap-3">
                      <h4 className="text-lg font-semibold">#{r.revision_number}</h4>
                      <Badge
                        color={r.kind === 'manual' ? 'module' : 'neutral'}
                        variant="soft"
                        size="sm"
                      >
                        {statusLabel(r.kind)}
                      </Badge>
                      <Badge color={statusTone(r.status)} variant="soft" size="sm">
                        {statusLabel(r.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-row items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/cms/${id}/revisions/${r.revision_number}`} />}
                        iconStart={<GitCompare className="h-3.5 w-3.5" />}
                      >
                        Compare
                      </Button>
                      <RestoreButton entryId={id} revisionNumber={r.revision_number} />
                    </div>
                  </div>
                  <p className="opacity-70">
                    {r.summary ?? 'Autosaved'} —{' '}
                    {new Date(r.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                    {r.author_id
                      ? ` · ${authorNameById.get(r.author_id) ?? `author ${r.author_id.slice(0, 8)}`}`
                      : ' · system'}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
