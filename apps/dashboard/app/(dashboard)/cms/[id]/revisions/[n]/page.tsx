// Side-by-side diff of a historical revision against the current entry.
//
// Title + SEO fields render as a "before / after" pair with inline cues
// when they differ. The body is harder to diff char-by-char (it's a
// nested TipTap doc), so we render both bodies through the cms-editor
// sanitizing serializer and let the eye compare them. Restore lives on
// the same page so the editor can review then act in one step.

import { notFound } from 'next/navigation';
import { renderDocToHtml } from '@sparx/cms-editor';
import { PageHeader, statusLabel, statusTone } from '@sparx/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { RestoreButton } from '../restore-button';

export const dynamic = 'force-dynamic';

interface RevisionFull {
  revision_number: number;
  kind: 'autosave' | 'manual';
  status: string;
  summary: string | null;
  author_id: string | null;
  created_at: string;
  body: Record<string, unknown>;
  seo: Record<string, unknown>;
}

interface CurrentEntry {
  id: string;
  slug: string | null;
  body: Record<string, unknown>;
  seo: Record<string, unknown>;
  status: string;
  updated_at: string;
}

interface PageParams {
  params: Promise<{ id: string; n: string }>;
}

export default async function RevisionDiffPage({ params }: PageParams) {
  const { id, n } = await params;
  const revisionNumber = Number.parseInt(n, 10);
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) notFound();

  let revision: RevisionFull;
  let current: CurrentEntry;
  try {
    [revision, current] = await Promise.all([
      api.get<RevisionFull>(`/v1/content/entries/${id}/revisions/${revisionNumber}`),
      api.get<CurrentEntry>(`/v1/content/entries/${id}`),
    ]);
  } catch (err) {
    if ((err as ApiRestError).status === 404) notFound();
    throw err;
  }

  const revBody = revision.body;
  const curBody = current.body;
  const revTitle = typeof revBody.title === 'string' ? revBody.title : '';
  const curTitle = typeof curBody.title === 'string' ? curBody.title : '';
  const revDoc =
    revBody.body && typeof revBody.body === 'object'
      ? (revBody.body as { type: string; content?: unknown[] })
      : { type: 'doc', content: [] };
  const curDoc =
    curBody.body && typeof curBody.body === 'object'
      ? (curBody.body as { type: string; content?: unknown[] })
      : { type: 'doc', content: [] };

  const revHtml = renderDocToHtml(revDoc);
  const curHtml = renderDocToHtml(curDoc);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <div className="flex flex-col gap-2">
          <PageHeader
            className="mb-0"
            title={`Revision #${revision.revision_number}`}
            badge={
              <>
                <Badge
                  color={revision.kind === 'manual' ? 'module' : 'neutral'}
                  variant="soft"
                  size="sm"
                >
                  {statusLabel(revision.kind)}
                </Badge>
                <Badge color={statusTone(revision.status)} variant="soft" size="sm">
                  {statusLabel(revision.status)}
                </Badge>
              </>
            }
            description={
              <>
                Saved{' '}
                {new Date(revision.created_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {revision.summary ? ` — ${revision.summary}` : ''}
              </>
            }
          />
          <div className="flex flex-row items-center gap-2">
            <RestoreButton entryId={id} revisionNumber={revision.revision_number} />
          </div>
        </div>

        <FieldDiff label="Title" revision={revTitle} current={curTitle} />

        <SeoDiff revision={revision.seo} current={current.seo} />

        <Card>
          <CardBody>
            <div className="flex flex-row items-center gap-2">
              <h3 className="text-xl font-semibold">Body</h3>
              {revHtml === curHtml ? (
                <Badge color="neutral" variant="soft" size="sm">
                  unchanged
                </Badge>
              ) : (
                <Badge color="module" variant="soft" size="sm">
                  changed
                </Badge>
              )}
            </div>
            {revHtml === curHtml ? (
              <p className="text-base-content text-base">
                The body is identical between this revision and the current entry.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <BodyPanel title={`Revision #${revision.revision_number}`} html={revHtml} />
                <BodyPanel title="Current" html={curHtml} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function FieldDiff({
  label,
  revision,
  current,
}: {
  label: string;
  revision: string;
  current: string;
}) {
  const changed = revision !== current;
  return (
    <Card>
      <CardBody>
        <div className="flex flex-row items-center gap-2">
          <h4 className="text-lg font-semibold">{label}</h4>
          {changed ? (
            <Badge color="module" variant="soft" size="sm">
              changed
            </Badge>
          ) : (
            <Badge color="neutral" variant="soft" size="sm">
              unchanged
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="text-base-content text-xs">Revision</p>
            <p className="text-sm">{revision || <em>empty</em>}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base-content text-xs">Current</p>
            <p className="text-sm">{current || <em>empty</em>}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function SeoDiff({
  revision,
  current,
}: {
  revision: Record<string, unknown>;
  current: Record<string, unknown>;
}) {
  const keys = ['title', 'description', 'canonical', 'robots', 'ogImage'] as const;
  const rows = keys.map((k) => ({
    key: k,
    rev: typeof revision[k] === 'string' ? revision[k] : '',
    cur: typeof current[k] === 'string' ? current[k] : '',
  }));
  const anyChanged = rows.some((r) => r.rev !== r.cur);

  const changedRows = rows.filter((r) => r.rev !== r.cur);
  const unchangedRows = rows.filter((r) => r.rev === r.cur);

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row items-center gap-2">
          <h4 className="text-lg font-semibold">SEO</h4>
          {anyChanged ? (
            <Badge color="module" variant="soft" size="sm">
              {changedRows.length} changed
            </Badge>
          ) : (
            <Badge color="neutral" variant="soft" size="sm">
              unchanged
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {changedRows.map(({ key, rev, cur }) => (
            <SeoDiffRow key={key} fieldKey={key} rev={rev} cur={cur} />
          ))}
          {unchangedRows.length > 0 && (
            <details>
              <summary className="text-base-content cursor-pointer text-sm">
                Show {unchangedRows.length} unchanged{' '}
                {unchangedRows.length === 1 ? 'field' : 'fields'}
              </summary>
              <div className="flex flex-col gap-3 pt-3">
                {unchangedRows.map(({ key, rev, cur }) => (
                  <SeoDiffRow key={key} fieldKey={key} rev={rev} cur={cur} />
                ))}
              </div>
            </details>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function SeoDiffRow({ fieldKey, rev, cur }: { fieldKey: string; rev: string; cur: string }) {
  return (
    <div className="border-base-300 grid grid-cols-1 gap-4 border-b pb-2 md:grid-cols-3">
      <p className="text-sm">{fieldKey}</p>
      <p className="font-mono text-sm break-all">{rev || <em>empty</em>}</p>
      <p className="font-mono text-sm break-all">{cur || <em>empty</em>}</p>
    </div>
  );
}

function BodyPanel({ title, html }: { title: string; html: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base-content text-xs">{title}</p>
      <div
        className="sparx-content border-base-300 bg-base-100 max-h-[600px] min-h-[200px] overflow-auto rounded-lg border p-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
