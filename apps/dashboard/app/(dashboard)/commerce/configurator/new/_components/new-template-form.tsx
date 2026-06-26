'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createTemplateAction } from '../../../configurator-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

// Surface-aware create form for a configurator template, on the standard create
// surface (docs/86 F layout). The SAME component renders in both presentations,
// picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the two module-tinted Cards (Basics,
// Definition) sit in the step body. No bespoke card-footer toolbar, no repeated
// page title — that drift is what docs/86 standardizes away.
//
// Templates have a detail view, so create flows INTO it: the overlay swaps the
// token to the new record (preserving drawer vs modal); the page navigates to it.

export interface ProductOption {
  id: string;
  title: string;
  handle: string;
  status: string;
}

const STARTER_PAYLOAD = {
  layout: {
    steps: [{ key: 'main', label: 'Configure', optionKeys: ['size'] }],
  },
  options: [
    {
      key: 'size',
      label: 'Size',
      type: 'single_choice',
      required: true,
      position: 0,
      choices: [
        { key: 'small', label: 'Small', position: 0 },
        { key: 'large', label: 'Large', position: 1, priceDeltaCents: 1000 },
      ],
    },
  ],
  rules: [],
  addOns: [],
};

// Pretty-printed starter, computed once. Doubles as the textarea's initial value
// and the dirty-check baseline (an untouched starter is not "entered work").
const STARTER_JSON = JSON.stringify(STARTER_PAYLOAD, null, 2);

interface NewTemplateFormProps {
  products: ProductOption[];
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'definition', label: 'Definition' }];

export function NewTemplateForm({ products, surface }: NewTemplateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  // Pre-select when launched from a product's Configurator tab (?product=<id>),
  // but only if that product is actually in the configurable list.
  const [productId, setProductId] = React.useState(() => {
    const requested = searchParams?.get('product') ?? '';
    return products.some((p) => p.id === requested) ? requested : '';
  });
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [json, setJson] = React.useState(STARTER_JSON);

  // Unsaved-changes guard. A create form starts blank (bar the starter JSON), so
  // "dirty" is "the user has changed anything from the defaults" — guard a Cancel
  // / Close / Switch / backdrop so typed work isn't silently dropped.
  const dirty =
    productId !== '' || name.trim() !== '' || description.trim() !== '' || json !== STARTER_JSON;

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'template' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path (a created template isn't a discard) and,
  // through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/configurator');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: in an overlay, transition the token to the new record's detail
  // (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `configurator-template:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/configurator/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    if (!productId) {
      setError('Pick a product');
      return;
    }
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
      return;
    }
    const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    const payload = {
      productId,
      name: name.trim(),
      description: description.trim() || undefined,
      layout: obj.layout ?? {},
      options: obj.options ?? [],
      rules: obj.rules ?? [],
      addOns: obj.addOns ?? [],
    };
    startTransition(async () => {
      const result = await createTemplateAction(payload);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onCreated(result.data.id);
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New configurator template"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Template basics',
            supporting:
              'Bind a template to a configurable product. Start with one option to learn the grammar, then add rules + add-ons from the detail page.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create template',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Stack gap={6}>
            <Card variant="module">
              <CardHeader>
                <CardTitle>Basics</CardTitle>
                <CardDescription>
                  Pick the configurable product and name this template.
                </CardDescription>
              </CardHeader>
              <CardContent className="py-6">
                <Stack gap={4}>
                  <Stack gap={1}>
                    <Label htmlFor="productId" required>
                      Product
                    </Label>
                    <NativeSelect
                      id="productId"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">— select a product —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.status})
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                  <Stack gap={1}>
                    <Label htmlFor="name" required>
                      Template name
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Default configuration"
                    />
                  </Stack>
                  <Stack gap={1}>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="module">
              <CardHeader>
                <CardTitle>Definition</CardTitle>
                <CardDescription>
                  The starter payload below is a minimal valid template. Edit it as JSON, save, then
                  expand from the detail editor.
                </CardDescription>
              </CardHeader>
              <CardContent className="py-6">
                <Stack gap={2}>
                  <Label htmlFor="json">Definition (JSON)</Label>
                  <Textarea
                    id="json"
                    value={json}
                    onChange={(e) => setJson(e.target.value)}
                    rows={20}
                    className="font-mono text-xs"
                  />
                  <Text size="xs" variant="muted">
                    Must validate against CreateConfigurationTemplateInput in
                    @sparx/commerce-schemas. The starter has one option with two choices — edit,
                    then iterate after save.
                  </Text>
                </Stack>
              </CardContent>
            </Card>
            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            )}
          </Stack>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
