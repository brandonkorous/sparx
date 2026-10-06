'use client';

// The statement section on a wholesale customer.
//
// What the account owed at the start of a period, everything billed and paid in
// it, and what it owes at the end, with the buyer's own PO number on every line.
// That PO number is what their accounts department matches against, and the B2B
// page promises it "rides onto the invoice and every statement, so AP can
// reconcile without a phone call". This is where the shop sees the statement,
// prints it, and emails it to them.

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldLabel,
  Select,
  Table,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faEnvelope, faPrint } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { openServerHtml } from '../../lib/api/html-artifact';
import { apiErrorMessage } from '../../lib/api-error';
import { FormSection } from '../../components/form-section';
import { DayInput } from '../../components/day-input';
import { formatCents } from './accounts-data';
import {
  STATEMENT_PRESETS,
  openItemState,
  presetPeriod,
  recipientsText,
  statementDay,
  statementPrintPath,
  useAccountStatement,
  useSendStatement,
  type AccountStatement,
  type StatementPeriodQuery,
  type StatementPreset,
} from './statement-data';

export function AccountStatementSection({
  accountId,
  companyName,
}: {
  accountId: string;
  companyName: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [preset, setPreset] = useState<StatementPreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [halfTyped, setHalfTyped] = useState(false);

  // The period asked of the server. A custom period is asked only once both
  // days are whole dates in the right order; until then the last statement
  // stays on screen and the boxes say what is missing.
  const customProblem =
    preset !== 'custom'
      ? null
      : halfTyped
        ? null
        : customFrom === '' || customTo === ''
          ? 'Fill in both days to see the statement for them.'
          : customFrom > customTo
            ? 'The first day has to be on or before the last day.'
            : null;
  const period: StatementPeriodQuery | null = useMemo(() => {
    if (preset !== 'custom') return presetPeriod(preset);
    if (halfTyped || customProblem) return null;
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo, halfTyped, customProblem]);

  const statementQuery = useAccountStatement(accountId, period);
  const send = useSendStatement(accountId);
  const statement = statementQuery.data;
  const asked: StatementPeriodQuery = statement
    ? { from: statement.period.from, to: statement.period.to }
    : (period ?? {});

  const onPrint = () => {
    openServerHtml(statementPrintPath(accountId, asked)).catch((error: unknown) => {
      toast.add({
        title: 'Could not open the statement to print',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        type: 'error',
      });
    });
  };

  const onSend = async () => {
    if (!statement || statement.recipients.length === 0) return;
    const ok = await confirm({
      title: `Email this statement to ${companyName}?`,
      description: `It goes to ${recipientsText(statement.recipients)}. It covers ${statementDay(statement.period.from)} to ${statementDay(statement.period.to)}, lists every open invoice with their PO number, and links to the full statement on your site.`,
      confirmLabel: 'Email it',
      cancelLabel: 'Not now',
      color: 'module',
    });
    if (!ok) return;
    send.mutate(asked, {
      onSuccess: (result) => {
        toast.add({
          title: 'Statement sent',
          description: `Emailed to ${result.sentTo.join(', ')}.`,
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not email the statement',
          description: apiErrorMessage(error, 'Nothing was sent.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <FormSection
      title="Statement"
      description="What they owed at the start of a period, every invoice and payment in it with their PO numbers, and what they owe at the end. Print it or email it to them."
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-56">
          <FieldLabel>Period</FieldLabel>
          <FieldControl
            render={
              <div>
                <Select
                  color="module"
                  aria-label="Statement period"
                  value={preset}
                  items={STATEMENT_PRESETS}
                  onValueChange={(next) => {
                    const chosen = (next as StatementPreset | null) ?? 'this_month';
                    if (chosen === 'custom' && statement) {
                      // Start from the dates on screen, so picking dates is an
                      // edit of what she is looking at, not two empty boxes.
                      setCustomFrom(statement.period.from);
                      setCustomTo(statement.period.to);
                      setHalfTyped(false);
                    }
                    setPreset(chosen);
                  }}
                />
              </div>
            }
          />
        </Field>
        {preset === 'custom' ? (
          <>
            <Field className="w-44">
              <FieldLabel>From</FieldLabel>
              <FieldControl
                render={
                  <div>
                    <DayInput
                      color="module"
                      aria-label="First day of the statement"
                      value={customFrom}
                      onValueChange={(value, incomplete) => {
                        setCustomFrom(value);
                        setHalfTyped(incomplete);
                      }}
                    />
                  </div>
                }
              />
            </Field>
            <Field className="w-44">
              <FieldLabel>To</FieldLabel>
              <FieldControl
                render={
                  <div>
                    <DayInput
                      color="module"
                      aria-label="Last day of the statement"
                      value={customTo}
                      onValueChange={(value, incomplete) => {
                        setCustomTo(value);
                        setHalfTyped(incomplete);
                      }}
                    />
                  </div>
                }
              />
            </Field>
          </>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="soft" color="module" disabled={!statement} onClick={onPrint}>
            <Icon glyph={faPrint} className="size-4" aria-hidden />
            Print or save as PDF
          </Button>
          <Button
            size="sm"
            color="module"
            disabled={!statement || statement.recipients.length === 0}
            loading={send.isPending}
            onClick={() => {
              void onSend();
            }}
          >
            <Icon glyph={faEnvelope} className="size-4" aria-hidden />
            Email it to them
          </Button>
        </div>
      </div>
      {customProblem ? <Text className="text-sm">{customProblem}</Text> : null}

      {statementQuery.isError ? (
        <Text className="text-sm" role="alert">
          {apiErrorMessage(statementQuery.error, 'The statement could not be worked out just now.')}
        </Text>
      ) : !statement ? (
        <Text className="text-sm" role="status">
          Working out the statement…
        </Text>
      ) : (
        <StatementBody statement={statement} />
      )}
    </FormSection>
  );
}

function StatementBody({ statement }: { statement: AccountStatement }) {
  const c = statement.currency;
  const money = (cents: number) => formatCents(cents, c);
  return (
    <div className="flex flex-col gap-4">
      <Text className="text-sm">
        {statementDay(statement.period.from)} to {statementDay(statement.period.to)}
        {statement.account.paymentTermsWords ? ` · ${statement.account.paymentTermsWords}` : ''}
      </Text>

      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
        <Figure label="Owed at the start" value={money(statement.openingCents)} />
        <Figure label="New charges" value={money(statement.chargesCents)} />
        <Figure label="Payments and credits" value={money(statement.creditsCents)} />
        <Figure label="Owed at the end" value={money(statement.closingCents)} emphasis />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statement.pastDueCents > 0 ? (
          <Badge color="danger" variant="soft">
            {money(statement.pastDueCents)} is late
          </Badge>
        ) : null}
        {statement.dueNowCents > 0 ? (
          <Badge color="warning" variant="soft">
            {money(statement.dueNowCents)} due now
          </Badge>
        ) : statement.closingCents > 0 ? (
          <Badge color="info" variant="soft">
            Nothing due yet
          </Badge>
        ) : (
          <Badge color="success" variant="soft">
            Nothing owed
          </Badge>
        )}
      </div>

      {/* Six columns, not eight: the pane's reading column is narrow, and the
          balance is the one figure that must never scroll out of sight. The
          charges and the payments are totalled in the figures above; here they
          share one column, a payment shown taken off. The due dates are on the
          open invoices below. The printed statement keeps all eight. */}
      <Table size="sm">
        <thead>
          <tr>
            <th>Date</th>
            <th>What happened</th>
            <th>Invoice</th>
            <th>Their PO number</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="font-medium">
            <td className="whitespace-nowrap">{statementDay(statement.period.from)}</td>
            <td>Owed at the start</td>
            <td />
            <td />
            <td />
            <td className="text-right tabular-nums">{money(statement.openingCents)}</td>
          </tr>
          {statement.rows.map((row, index) => (
            <tr key={`${row.documentId}-${row.kind}-${String(index)}`}>
              <td className="whitespace-nowrap">{statementDay(row.at)}</td>
              <td>{row.description}</td>
              <td className="whitespace-nowrap">{row.documentNumber ?? ''}</td>
              <td className="font-medium whitespace-nowrap">{row.poNumber ?? ''}</td>
              <td className="text-right whitespace-nowrap tabular-nums">
                {row.creditCents > 0 ? `-${money(row.creditCents)}` : money(row.chargeCents)}
              </td>
              <td className="text-right whitespace-nowrap tabular-nums">
                {money(row.balanceCents)}
              </td>
            </tr>
          ))}
          {statement.rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-sm">
                Nothing was billed or paid in this period.
              </td>
            </tr>
          ) : null}
          <tr className="font-semibold">
            <td className="whitespace-nowrap">{statementDay(statement.period.to)}</td>
            <td>Owed at the end</td>
            <td />
            <td />
            <td />
            <td className="text-right whitespace-nowrap tabular-nums">
              {money(statement.closingCents)}
            </td>
          </tr>
        </tbody>
      </Table>

      <div className="flex flex-col gap-2">
        <Text className="font-semibold">Still open at the end of the period</Text>
        {statement.openItems.length === 0 ? (
          <Text className="text-sm">Nothing was owed at the end of this period.</Text>
        ) : (
          <ul className="flex flex-col gap-2">
            {statement.openItems.map((item) => {
              const state = openItemState(item);
              return (
                <li
                  key={item.documentId}
                  className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {item.number ?? 'Invoice'}
                      {item.poNumber ? `, their PO ${item.poNumber}` : ''}
                    </span>
                    <Text as="span" className="block text-sm">
                      {item.dueAt ? `Due ${statementDay(item.dueAt)}` : 'Due on receipt'}
                      {item.openCents < item.totalCents
                        ? ` · ${money(item.openCents)} left of ${money(item.totalCents)}`
                        : ''}
                    </Text>
                  </span>
                  <Badge color={state.tone} variant="soft" size="sm">
                    {state.label}
                  </Badge>
                  <span className="font-medium whitespace-nowrap tabular-nums">
                    {money(item.openCents)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Text className="font-semibold">How late, at the end of the period</Text>
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-5">
          {statement.aging.map((bucket) => (
            <div key={bucket.key} className="border-base-300 rounded-box border p-3">
              <Text as="span" className="block text-sm">
                {bucket.label}
              </Text>
              <span
                className={`block font-semibold tabular-nums${
                  bucket.key !== 'current' && bucket.cents > 0 ? 'text-danger' : ''
                }`}
              >
                {money(bucket.cents)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Text className="text-sm">
        {statement.recipients.length > 0
          ? `Emailing it sends it to ${recipientsText(statement.recipients)}.`
          : 'Nobody at this business has an email address yet, so it cannot be emailed. Add one to a person under Who can order, or print it.'}
      </Text>
    </div>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-box flex flex-col gap-1 border p-3 ${
        emphasis ? 'border-module' : 'border-base-300'
      }`}
    >
      <Text as="span" className="text-sm">
        {label}
      </Text>
      <span
        className={`font-semibold tabular-nums ${emphasis ? 'text-module text-lg' : 'text-base'}`}
      >
        {value}
      </span>
    </div>
  );
}
