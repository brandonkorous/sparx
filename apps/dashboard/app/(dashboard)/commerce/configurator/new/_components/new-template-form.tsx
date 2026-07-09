'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createTemplateAction } from '../../../configurator-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { CREATE_SENTINEL } from '../../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../../_components/detail-panel';

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

  // Field validation. A configurable product must be chosen and the template must
  // be named; the JSON definition is parse-checked at submit (a form-level error).
  const values = { productId, name };
  const v = useFieldValidation(values, {
    productId: rule.required('Pick a product.'),
    name: rule.required('Name is required.'),
  });

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
    if (!v.validate()) return;
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
        backLabel="Configurator"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher
              typeId="configurator-template"
              entityId={CREATE_SENTINEL}
              current="page"
            />
          ) : undefined
        }
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
          <div className="flex flex-col gap-6">
            <Card>
              <CardBody className="py-6">
                <CardTitle>Basics</CardTitle>
                <p className="opacity-70">Pick the configurable product and name this template.</p>
                <div className="flex flex-col gap-4">
                  <Field {...v.field('productId')}>
                    <FieldLabel required>Product</FieldLabel>
                    <FieldControl
                      name="productId"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      {...v.control('productId')}
                      render={
                        <NativeSelect>
                          <option value="">— select a product —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} ({p.status})
                            </option>
                          ))}
                        </NativeSelect>
                      }
                    />
                  </Field>
                  <Field {...v.field('name')}>
                    <FieldLabel required>Template name</FieldLabel>
                    <FieldControl
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Default configuration"
                      {...v.control('name')}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Description</FieldLabel>
                    <FieldControl
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="py-6">
                <CardTitle>Definition</CardTitle>
                <p className="opacity-70">
                  The starter payload below is a minimal valid template. Edit it as JSON, save, then
                  expand from the detail editor.
                </p>
                <Field>
                  <FieldLabel>Definition (JSON)</FieldLabel>
                  <FieldControl
                    name="json"
                    value={json}
                    onChange={(e) => setJson(e.target.value)}
                    render={<Textarea rows={20} className="font-mono text-xs" />}
                  />
                  <FieldDescription>
                    Must validate against CreateConfigurationTemplateInput in
                    @sparx/commerce-schemas. The starter has one option with two choices — edit,
                    then iterate after save.
                  </FieldDescription>
                </Field>
              </CardBody>
            </Card>
            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
          </div>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
