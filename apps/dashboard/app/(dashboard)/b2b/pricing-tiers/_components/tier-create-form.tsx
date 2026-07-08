'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  ModuleProvider,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';
import { Card, CardBody, CardTitle, Input, Select, Textarea } from 'silicaui-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createPricingTier } from '../_lib/actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// Pricing-tier create on the standard form surface (docs/86 F layout). Create-only
// — tiers are read-only reference data in the list, so this drives just
// page / overlay. Validation stays on react-hook-form + zod; the frame's primary
// button submits the form by id (Enter-to-save works), Cancel is frame-owned.

const TierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(127),
  description: z.string().max(2000).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0),
  productScope: z.enum(['all', 'collections', 'products']),
  minOrderCents: z.number().int().min(0),
});

type TierFormValues = z.infer<typeof TierSchema>;

type Presentation = 'page' | 'overlay';

const FORM_ID = 'b2b-tier-create-form';
const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function TierCreateForm({ presentation }: { presentation: Presentation }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const form = useForm<TierFormValues>({
    resolver: zodResolver(TierSchema),
    defaultValues: {
      name: '',
      discountType: 'percentage',
      discountValue: 0,
      productScope: 'all',
      minOrderCents: 0,
    },
  });

  const guardLeave = useUnsavedGuard(form.formState.isDirty, {
    kind: 'create',
    noun: 'pricing tier',
  });

  const close = useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
      return;
    }
    router.push('/b2b/pricing-tiers');
  }, [presentation, pathname, searchParams, router]);

  const cancel = useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  async function onSubmit(values: TierFormValues) {
    const { error } = await createPricingTier(values);
    if (error) {
      form.setError('root', { message: error });
      return;
    }
    close();
    router.refresh();
  }

  return (
    <ModuleProvider module="b2b" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title="New pricing tier"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'New pricing tier',
            supporting:
              'A named discount applied to B2B accounts. Product-level overrides take precedence over tier discounts.',
          }}
          actions={{
            nextForm: FORM_ID,
            nextLabel: 'Create tier',
            nextLoading: form.formState.isSubmitting,
            nextDisabled: form.formState.isSubmitting,
          }}
        >
          <Card>
            <CardBody>
              <CardTitle>Tier details</CardTitle>
              <Form {...form}>
                <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <Input placeholder="e.g. Wholesale Tier 1" {...field} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <Textarea
                          placeholder="Optional description for staff"
                          rows={2}
                          {...field}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-row gap-3">
                    <FormField
                      control={form.control}
                      name="discountType"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Discount type</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            items={{
                              percentage: '% off list price',
                              fixed: '$ fixed amount off',
                            }}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discountValue"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Value</FormLabel>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="productScope"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product scope</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          items={{
                            all: 'All products',
                            collections: 'Selected collections',
                            products: 'Selected products',
                          }}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="minOrderCents"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum order (cents)</FormLabel>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="0 (no minimum)"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.formState.errors.root && (
                    <p className="text-danger text-sm" role="alert" aria-live="polite">
                      {form.formState.errors.root.message}
                    </p>
                  )}
                </form>
              </Form>
            </CardBody>
          </Card>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
