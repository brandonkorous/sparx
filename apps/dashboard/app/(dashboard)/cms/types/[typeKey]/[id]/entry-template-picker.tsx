'use client';

// Per-record template override (docs/51 §6). Lets THIS entry render through a
// specific published collection template, or fall back to its content type's
// default. The server only mounts this when the Builder module is on AND the
// type has ≥1 collection template, so an empty/absent option set means "no
// picker" rather than a dead control.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  NativeSelect,
  Stack,
  Text,
} from '@sparx/ui';
import type { BuilderTemplateOption } from '@sparx/builder-schemas';

import { setEntryTemplate } from '../../actions';

export function EntryTemplatePicker({
  typeKey,
  itemRef,
  typeName,
  options,
  current,
}: {
  typeKey: string;
  itemRef: string;
  typeName: string;
  options: BuilderTemplateOption[];
  /** The currently-pinned template id, or null when the entry uses the default. */
  current: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState<string>(current ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const defaultName = options.find((o) => o.isDefault)?.name;

  async function onChange(next: string) {
    const prev = value;
    setValue(next);
    setSaving(true);
    setError(null);
    const res = await setEntryTemplate(typeKey, itemRef, next || null);
    setSaving(false);
    if (!res.ok) {
      setValue(prev);
      setError(res.error ?? 'Could not update the template.');
      return;
    }
    router.refresh();
  }

  return (
    <Card variant="module">
      <CardHeader>
        <Heading level={3}>Page template</Heading>
        <CardDescription>
          Which builder template renders this {typeName.toLowerCase()} on your site. Leave it on the
          default unless this one needs a different layout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap={2}>
          <NativeSelect
            value={value}
            aria-label="Page template"
            disabled={saving}
            onChange={(e) => void onChange(e.target.value)}
          >
            <option value="">
              {defaultName ? `Use default — ${defaultName}` : 'Use default template'}
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.isDefault ? ' (default)' : ''}
                {o.published ? '' : ' — draft'}
              </option>
            ))}
          </NativeSelect>
          {error && (
            <Text size="sm" variant="danger" role="alert">
              {error}
            </Text>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
