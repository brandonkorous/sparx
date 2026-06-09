'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Textarea,
} from '@sparx/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPricingTier } from '../_lib/actions';

const TierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(127),
  description: z.string().max(2000).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(0),
  productScope: z.enum(['all', 'collections', 'products']),
  minOrderCents: z.number().int().min(0),
});

type TierFormValues = z.infer<typeof TierSchema>;

export function TierCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

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

  async function onSubmit(values: TierFormValues) {
    await createPricingTier(values);
    setOpen(false);
    form.reset();
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Button color="module" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        New tier
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Create pricing tier</ModalTitle>
          </ModalHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <Textarea placeholder="Optional description for staff" rows={2} {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Stack direction="row" gap={3}>
                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Discount type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">% off list price</SelectItem>
                          <SelectItem value="fixed">$ fixed amount off</SelectItem>
                        </SelectContent>
                      </Select>
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
              </Stack>

              <FormField
                control={form.control}
                name="productScope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product scope</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All products</SelectItem>
                        <SelectItem value="collections">Selected collections</SelectItem>
                        <SelectItem value="products">Selected products</SelectItem>
                      </SelectContent>
                    </Select>
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

              <Stack direction="row" justify="end" gap={2} className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" color="module" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Creating…' : 'Create tier'}
                </Button>
              </Stack>
            </form>
          </Form>
        </ModalContent>
      </Modal>
    </>
  );
}
