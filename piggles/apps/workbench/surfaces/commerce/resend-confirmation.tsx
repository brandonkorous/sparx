'use client';

// "She says she never got it" (sparx persona issue 336). The buyer's order
// confirmation, sent again from the order, to the address on it. Only WizeWorks
// support could do this before; the owner had to forward a screenshot.

import { Button, useToast } from '@wizeworks/silicaui-react';
import { useMutation } from '@wizeworks/query';

import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
import { resendRefusal, type ResendResult } from './resend-confirmation-words';

export function ResendConfirmation({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const toast = useToast();
  const resend = useMutation({
    mutationFn: () => api.post<ResendResult>(`/v1/orders/${orderId}/resend-confirmation`, {}),
  });

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        color="module"
        loading={resend.isPending}
        disabled={resend.isPending}
        onClick={() =>
          resend.mutate(undefined, {
            onSuccess: (result) => {
              if (result.sent) {
                toast.add({
                  title: `${orderNumber}'s confirmation is on its way to ${result.to}`,
                  type: 'success',
                });
              } else {
                toast.add({
                  title: 'Nothing was sent',
                  description: resendRefusal(result),
                  type: 'error',
                });
              }
            },
            onError: (error) => {
              toast.add({
                title: 'Nothing was sent',
                description: apiErrorMessage(error, 'The email could not be sent just now.'),
                type: 'error',
              });
            },
          })
        }
      >
        Email the confirmation again
      </Button>
    </div>
  );
}
