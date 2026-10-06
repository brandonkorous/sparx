'use client';

// The money line under a booking (sparx persona issue 087): a plain sentence
// when nothing needs doing, a warning when a fee or a refund did not go through
// and somebody has to act. The words live in booking-money.ts.

import { Alert, AlertContent, AlertDescription, AlertTitle, Text } from '@wizeworks/silicaui-react';

import type { MoneyLine } from './booking-money';

export function BookingMoneyLine({ money }: { money: MoneyLine }) {
  if (money.kind === 'line') return <Text className="text-sm">{money.text}</Text>;
  return (
    <Alert color="warning" variant="soft">
      <AlertContent>
        <AlertTitle>{money.title}</AlertTitle>
        <AlertDescription>{money.detail}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
