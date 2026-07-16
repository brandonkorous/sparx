import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Copy } from 'lucide-react';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { SchemaEditor } from './schema/schema-editor';

// Detail-view body for a content TYPE definition (the `@detail` drawer/modal,
// or the full-page route at /cms/types/[typeKey]/schema reuses SchemaEditor
// directly). Keyed by the type `key`. Custom types render the live editor
// (identity + schema JSON + delete) — this is where "edit a content type"
// lives now; built-in types are read-only (their schema is platform-owned).

interface ApiContentType {
  key: string;
  name: string;
  plural_name: string;
  description: string | null;
  url_pattern: string | null;
  is_singleton: boolean;
  is_built_in: boolean;
  schema_json: unknown;
}

export const dynamic = 'force-dynamic';

export async function ContentTypeDetailContent({ id }: { id: string }) {
  let type: ApiContentType;
  try {
    type = await api.get<ApiContentType>(`/v1/content/types/${encodeURIComponent(id)}`);
  } catch (err) {
    if ((err as ApiRestError).status === 404) notFound();
    throw err;
  }

  const schemaText = JSON.stringify(type.schema_json ?? { fields: [] }, null, 2);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{type.name}</h1>
          <Badge color={type.is_built_in ? 'neutral' : 'module'} variant="soft" size="sm">
            {type.is_built_in ? 'built-in' : 'custom'}
          </Badge>
          {type.is_singleton && (
            <Badge color="info" variant="soft" size="sm">
              singleton
            </Badge>
          )}
        </div>
        <div className="flex flex-row flex-wrap items-center gap-2">
          <p className="text-base-content text-sm">
            <code>{type.key}</code>
          </p>
          {type.description && <p className="text-base-content text-sm">· {type.description}</p>}
        </div>
        <div className="flex flex-row flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconEnd={<ArrowRight className="h-3.5 w-3.5" />}
            render={<Link href={`/cms/content?type=${type.key}`} />}
          >
            View {type.plural_name.toLowerCase()}
          </Button>
          {/* Fork this type's schema into a new editable custom type (docs/51
              §7). Works for built-in and custom sources alike; the original is
              left untouched. */}
          <Button
            variant="outline"
            size="sm"
            iconStart={<Copy className="h-3.5 w-3.5" />}
            render={<Link href={`/cms/types/new?from=${type.key}`} />}
          >
            Duplicate
          </Button>
        </div>
      </div>

      {type.is_built_in ? (
        <Card className="bg-module bg-soft">
          <CardBody>
            <h3 className="text-xl font-semibold">Schema (read-only)</h3>
            <div className="flex flex-col gap-3">
              <p className="text-base-content text-sm">
                Built-in types are maintained in <code>packages/cms-schemas</code> and can&apos;t be
                edited directly. Use <strong>Duplicate</strong> above to fork it into a custom type
                you can tailor.
              </p>
              <pre className="border-base-300 bg-base-200 overflow-auto rounded border p-3 font-mono text-xs">
                {schemaText}
              </pre>
            </div>
          </CardBody>
        </Card>
      ) : (
        <SchemaEditor
          typeKey={type.key}
          initial={{
            name: type.name,
            pluralName: type.plural_name,
            description: type.description ?? '',
            urlPattern: type.url_pattern ?? '',
            isSingleton: type.is_singleton,
            schemaText,
          }}
        />
      )}
    </div>
  );
}
