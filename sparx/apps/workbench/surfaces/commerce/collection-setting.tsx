'use client';

// Collecting in person, beside delivery.
//
// Checkout offers "Collect in person" on its own while a shop has no delivery
// set up. Setting up delivery used to take it away for good, though the shop's
// counter was still open: Gillett Diesel added a US region and his walk-in
// customers lost the choice to pick a part up (sparx persona issue 129). This is
// where a shop that does both says so. Per site.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { useCollectionSetting, useSetCollectionSetting } from './shipping-data';

export function CollectionSetting({ delivers }: { delivers: boolean }) {
  const setting = useCollectionSetting();
  const save = useSetCollectionSetting();
  const toast = useToast();

  return (
    <FormSection
      title="Collecting in person"
      description="Free, at checkout, for anyone who would rather pick their order up. No address is asked for."
    >
      {delivers ? (
        <Field>
          <FieldLabel>Customers can also collect</FieldLabel>
          <FieldControl
            render={
              <Switch
                color="module"
                checked={setting.data?.offersCollection ?? false}
                disabled={setting.isPending || save.isPending}
                onCheckedChange={(next: boolean) => {
                  save.mutate(next, {
                    onSuccess: () => {
                      toast.add({
                        title: next
                          ? 'Customers can collect at checkout'
                          : 'Collecting is off: delivery only',
                        type: 'success',
                      });
                    },
                    onError: () => {
                      toast.add({
                        title: 'That did not save',
                        description: 'Collecting is as it was. Try again.',
                        type: 'error',
                      });
                    },
                  });
                }}
              />
            }
          />
          <FieldDescription>Shown beside your delivery options, for any address.</FieldDescription>
        </Field>
      ) : (
        <Text>
          You don’t deliver yet, so collecting is the only choice at checkout. Once you add a
          delivery region, you can keep offering it here.
        </Text>
      )}
    </FormSection>
  );
}
