'use client';

// Selling settings — the rules that apply to every sale on this site.
//
// A plain draft-then-Save form, like every editor in the app: the Save button
// lives in the toolbar, edits register as unsaved work so closing mid-change
// asks first, and the whole object is written back last-write-wins. Settings are
// per-site; the API client attaches the active site, so this pane never has to
// name which one it is editing. The fulfilment origin (a warehouse) is carried
// through untouched — it is set elsewhere, and saving here must not clear it.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  NumberField,
  Select,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { useToast } from '@wizeworks/silicaui-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  CURRENCY_OPTIONS,
  LOCALE_OPTIONS,
  settingsErrorMessage,
  useCommerceSettings,
  useUpdateCommerceSettings,
  type CommerceSettings,
} from './commerce-settings-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

const ABANDON_MIN = 15;
const ABANDON_MAX = 60 * 24 * 30;

interface Draft {
  defaultCurrency: string;
  defaultLocale: string;
  cartAbandonmentMinutes: number;
  showStockBelow: number;
  hidePricesWhenSignedOut: boolean;
  requireAuthForCheckout: boolean;
}

function toDraft(settings: CommerceSettings): Draft {
  return {
    defaultCurrency: settings.defaultCurrency,
    defaultLocale: settings.defaultLocale,
    cartAbandonmentMinutes: settings.cartAbandonmentMinutes,
    showStockBelow: settings.showStockBelow,
    hidePricesWhenSignedOut: settings.hidePricesWhenSignedOut,
    requireAuthForCheckout: settings.requireAuthForCheckout,
  };
}

export function CommerceSettingsSurface({ ctx }: { ctx: SurfaceContext }) {
  const { data: settings, isPending, isError, error, refetch } = useCommerceSettings();

  useEffect(() => {
    ctx.setTitle('Selling settings');
  }, [ctx]);

  if (isError) {
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <Alert color="error" variant="soft" className="max-w-md">
            <AlertContent>
              <AlertTitle>Could not load your selling settings</AlertTitle>
              <AlertDescription>
                {settingsErrorMessage(
                  error,
                  'This is a problem reaching the server. Your settings are unaffected.'
                )}
              </AlertDescription>
            </AlertContent>
            <Button
              size="sm"
              color="error"
              variant="soft"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  if (isPending || !settings) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-sm" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: CommerceSettings }) {
  const toast = useToast();
  const update = useUpdateCommerceSettings();

  const saved = useMemo(() => toDraft(settings), [settings]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const dirty =
    draft.defaultCurrency !== saved.defaultCurrency ||
    draft.defaultLocale !== saved.defaultLocale ||
    draft.cartAbandonmentMinutes !== saved.cartAbandonmentMinutes ||
    draft.showStockBelow !== saved.showStockBelow ||
    draft.hidePricesWhenSignedOut !== saved.hidePricesWhenSignedOut ||
    draft.requireAuthForCheckout !== saved.requireAuthForCheckout;

  useDirtySource(dirty, 'Your selling settings have unsaved changes. Close anyway?');

  const failure = update.isError
    ? settingsErrorMessage(update.error, 'Could not save your settings. Nothing was changed.')
    : null;

  const submit = () => {
    update.mutate(
      {
        defaultCurrency: draft.defaultCurrency,
        defaultLocale: draft.defaultLocale,
        ...(settings.defaultWarehouseId ? { defaultWarehouseId: settings.defaultWarehouseId } : {}),
        channelsEnabled: settings.channelsEnabled,
        cartAbandonmentMinutes: Math.min(
          ABANDON_MAX,
          Math.max(ABANDON_MIN, draft.cartAbandonmentMinutes)
        ),
        showStockBelow: Math.max(0, draft.showStockBelow),
        hidePricesWhenSignedOut: draft.hidePricesWhenSignedOut,
        requireAuthForCheckout: draft.requireAuthForCheckout,
      },
      {
        onSuccess: () => {
          setTouched(false);
          toast.add({ title: 'Selling settings saved', type: 'success' });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Selling settings actions">
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          loading={update.isPending}
          disabled={!dirty}
          onClick={submit}
        >
          Save
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Heading level={1} className="text-2xl font-semibold">
              Selling settings
            </Heading>
            <Text className="text-sm">
              The rules that apply to every sale on this site. These affect what shoppers see and
              how checkout works.
            </Text>
          </div>

          {failure ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not save your settings</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection
            title="Currency and language"
            description="What your prices are shown in, and the language used for dates and numbers."
          >
            <Field>
              <FieldLabel>Currency</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <Select
                      color="module"
                      aria-label="Currency"
                      value={draft.defaultCurrency}
                      items={CURRENCY_OPTIONS}
                      onValueChange={(next) => {
                        set('defaultCurrency', (next as string) ?? 'USD');
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>
                All prices on this site are shown and charged in this currency.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Language and formatting</FieldLabel>
              <FieldControl
                render={
                  <div className="max-w-sm">
                    <Select
                      color="module"
                      aria-label="Language and formatting"
                      value={draft.defaultLocale}
                      items={LOCALE_OPTIONS}
                      onValueChange={(next) => {
                        set('defaultLocale', (next as string) ?? 'en-US');
                      }}
                    />
                  </div>
                }
              />
              <FieldDescription>Sets how dates, numbers and prices are formatted.</FieldDescription>
            </Field>
          </FormSection>

          <FormSection title="At checkout" description="What a customer has to do to buy from you.">
            <Field>
              <FieldLabel>Require an account to check out</FieldLabel>
              <FieldControl
                render={
                  <Switch
                    color="module"
                    checked={draft.requireAuthForCheckout}
                    onCheckedChange={(next: boolean) => {
                      set('requireAuthForCheckout', next);
                    }}
                  />
                }
              />
              <FieldDescription>
                On, shoppers must sign in or create an account before paying. Off, they can check
                out as a guest — usually the smoother choice.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Hide prices until a shopper signs in</FieldLabel>
              <FieldControl
                render={
                  <Switch
                    color="module"
                    checked={draft.hidePricesWhenSignedOut}
                    onCheckedChange={(next: boolean) => {
                      set('hidePricesWhenSignedOut', next);
                    }}
                  />
                }
              />
              <FieldDescription>
                For trade or members-only sites where prices should only show to signed-in
                customers. Leave off for a normal shop.
              </FieldDescription>
            </Field>
          </FormSection>

          <FormSection title="Stock and carts">
            <Field>
              <FieldLabel>Show a &ldquo;low stock&rdquo; note when stock falls below</FieldLabel>
              <FieldControl
                render={
                  <NumberField
                    label="Low stock threshold"
                    className="max-w-[10rem]"
                    min={0}
                    value={draft.showStockBelow}
                    onValueChange={(next) => {
                      set(
                        'showStockBelow',
                        typeof next === 'number' && !Number.isNaN(next) ? next : 0
                      );
                    }}
                  />
                }
              />
              <FieldDescription>
                Nudges shoppers to buy before it runs out. Set to 0 to never show it.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Count an unfinished cart as abandoned after (minutes)</FieldLabel>
              <FieldControl
                render={
                  <NumberField
                    label="Cart abandonment minutes"
                    className="max-w-[10rem]"
                    min={ABANDON_MIN}
                    max={ABANDON_MAX}
                    value={draft.cartAbandonmentMinutes}
                    onValueChange={(next) => {
                      set(
                        'cartAbandonmentMinutes',
                        typeof next === 'number' && !Number.isNaN(next) ? next : ABANDON_MIN
                      );
                    }}
                  />
                }
              />
              <FieldDescription>
                How long a cart can sit untouched before it counts as abandoned in your reports and
                reminder emails. Between 15 minutes and 30 days.
              </FieldDescription>
            </Field>
          </FormSection>
        </div>
      </div>
    </div>
  );
}
