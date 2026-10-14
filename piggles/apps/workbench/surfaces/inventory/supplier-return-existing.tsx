'use client';

// Working an existing return: send it, then chase the credit. The credit is the
// point; a return with no cost on it quietly writes the money off.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Field,
  FieldControl,
  FieldLabel,
  Heading,
  Input,
  Text,
} from '@wizeworks/silicaui-react';
import { faBan, faMoneyBill, faPaperPlane } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { MoneyTextInput } from '../../components/money-input';
import { PANE_SHELL_SCROLL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  returnReasonLabel,
  returnReasonTone,
  returnSettledTitle,
  returnStatusLabel,
  returnStatusTone,
  type SupplierReturnDetail,
} from './supplier-returns-data';
import { ReturnLinesCard, ReturnStats } from './supplier-return-summary';
import {
  returnActions,
  useExistingReturn,
  type ExistingReturnState,
  type ReturnActions,
} from './use-supplier-return-existing';

interface WorkProps {
  state: ExistingReturnState;
  actions: ReturnActions;
}

/** A return that has stopped being a chase, and which of the three ways it
 *  stopped. Absent while it is still open, which the card reads as "Waiting". */
export function ExistingReturn({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const state = useExistingReturn(id);
  const data = state.data;

  if (!data) return null;
  const settledTitle = returnSettledTitle(data.status);
  const actions = returnActions(ctx, state, data);

  return (
    <div className={PANE_SHELL_SCROLL}>
      <ReturnHeader data={data} />
      <ReturnStats data={data} settledTitle={settledTitle} />
      {data.status === 'sent' && (data.awaitingCreditDays ?? 0) >= 30 ? <OverdueAlert /> : null}
      <ReturnLinesCard data={data} />
      {data.status === 'draft' ? <DraftActions state={state} actions={actions} /> : null}
      {data.status === 'sent' ? <CreditCard state={state} actions={actions} /> : null}
      {data.notes ? <Text className="text-sm">{data.notes}</Text> : null}
    </div>
  );
}

function ReturnHeader({ data }: { data: SupplierReturnDetail }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Heading level={2} className="text-lg">
        <span className="font-mono">{data.number}</span> · {data.supplierName ?? 'Supplier'}
      </Heading>
      <div className="flex items-center gap-2">
        <Badge color={returnReasonTone(data.reason)} variant="soft">
          {returnReasonLabel(data.reason)}
        </Badge>
        <Badge color={returnStatusTone(data.status)} variant="soft">
          {returnStatusLabel(data.status)}
        </Badge>
      </div>
    </div>
  );
}

function OverdueAlert() {
  return (
    <Alert color="danger" variant="soft">
      <AlertContent>
        <AlertTitle>This has been outstanding for over a month</AlertTitle>
        <AlertDescription>
          Most suppliers&apos; own terms say a credit should have been issued by now. Either chase
          it, or write it off deliberately so it stops sitting on your list.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

// Stock only moves on "It has gone back", a button of its own rather than a
// status dropdown: taking units off a shelf must not be reachable by editing a form.
function DraftActions({ state, actions }: WorkProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <Button
        color="warning"
        loading={state.send.isPending}
        onClick={() => {
          void actions.onSend();
        }}
      >
        <Icon glyph={faPaperPlane} className="size-4" aria-hidden />
        It has gone back
      </Button>
      <Button
        className="ml-auto"
        variant="outline"
        color="danger"
        loading={state.cancel.isPending}
        onClick={() => {
          void actions.onCancel();
        }}
      >
        <Icon glyph={faBan} className="size-4" aria-hidden />
        Abandon
      </Button>
    </div>
  );
}

function CreditCard({ state, actions }: WorkProps) {
  return (
    <Card className="flex flex-col gap-3 p-3">
      <Heading level={3} className="text-base">
        When the credit comes
      </Heading>
      <CreditRow state={state} actions={actions} />
      <TrackingRow state={state} actions={actions} />
    </Card>
  );
}

function CreditRow({ state, actions }: WorkProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field className="max-w-48">
        <FieldLabel>They credited</FieldLabel>
        <FieldControl
          render={
            <MoneyTextInput
              color="module"
              aria-label="What they credited you"
              text={state.creditAmount}
              onTextChange={state.setCreditAmount}
            />
          }
        />
      </Field>
      <Button color="success" loading={state.credit.isPending} onClick={actions.onCredit}>
        <Icon glyph={faMoneyBill} className="size-4" aria-hidden />
        Record the credit
      </Button>
      <Button
        className="ml-auto"
        variant="outline"
        color="danger"
        loading={state.close.isPending}
        onClick={() => {
          void actions.onClose();
        }}
      >
        Write it off
      </Button>
    </div>
  );
}

function TrackingRow({ state, actions }: WorkProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field className="max-w-64">
        <FieldLabel>Tracking number</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={state.tracking}
              placeholder="Added after the carrier collects"
              onChange={(event) => {
                state.setTracking(event.target.value);
                state.setTrackingDirty(true);
              }}
            />
          }
        />
      </Field>
      <Button
        variant="outline"
        color="module"
        disabled={!state.trackingDirty}
        loading={state.update.isPending}
        onClick={actions.onSaveTracking}
      >
        Save
      </Button>
    </div>
  );
}
