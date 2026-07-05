import { Card, Heading, Stack, Text } from '@sparx/ui';
import type { OperatorSearchIndexStatus } from '@sparx/operator';
import { collectionLabel } from '@/lib/support';
import { ReindexButton } from './reindex-button';

// The tenant's search-index health — per-collection Typesense document counts,
// straight from the engine, plus a rebuild (support:act). Read-only otherwise.
export function SearchIndexCard({
  tenantId,
  index,
  canAct,
}: {
  tenantId: string;
  index: OperatorSearchIndexStatus;
  canAct: boolean;
}) {
  return (
    <Card>
      <Stack gap={4}>
        <Stack direction="row" align="center" justify="between" className="flex-wrap gap-3">
          <Heading level={3}>Search index</Heading>
          {canAct ? <ReindexButton tenantId={tenantId} /> : null}
        </Stack>
        {index.unavailable ? (
          <Text variant="muted">
            The search index is currently unavailable — document counts can’t be read right now.
          </Text>
        ) : index.collections.length === 0 ? (
          <Text variant="muted">No indexed collections for this tenant yet.</Text>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {index.collections.map((c) => (
              <Stack key={c.collection} gap={1}>
                <Text size="sm" variant="muted">
                  {collectionLabel(c.collection)}
                </Text>
                <Text className="text-2xl font-medium tabular-nums">
                  {c.documents.toLocaleString('en-US')}
                </Text>
              </Stack>
            ))}
          </div>
        )}
        <Text size="xs" variant="muted">
          Counts come straight from the search engine. A rebuild re-projects every product,
          customer, and order from the database and runs in the background.
        </Text>
      </Stack>
    </Card>
  );
}
