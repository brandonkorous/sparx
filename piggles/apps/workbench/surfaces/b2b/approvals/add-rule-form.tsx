'use client';

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  NativeSelect,
  Select,
} from '@wizeworks/silicaui-react';
import { MoneyInput } from '../../../components/money-input';
import type { namableApprovers } from '../../../components/approver-choice';
import { accountApproversOption } from '../sign-off-words';
import { ApproverOptions } from './approver-options';
import { type RuleDraft } from './rule-draft';

export function AddRuleForm({
  draft,
  people,
  setAdding,
}: {
  draft: RuleDraft;
  people: ReturnType<typeof namableApprovers>;
  setAdding: (next: boolean) => void;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-3 rounded border p-3">
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <RuleScopeFields draft={draft} />
        <WhoSignsField draft={draft} people={people} />
      </div>
      <AddRuleActions draft={draft} setAdding={setAdding} />
    </div>
  );
}

function RuleScopeFields({ draft }: { draft: RuleDraft }) {
  const { amount, setAmount, accountId, setAccountId, accountItems } = draft;
  return (
    <>
      <Field>
        <FieldLabel>Hold orders over</FieldLabel>
        <FieldControl
          render={
            <div className="max-w-40">
              <MoneyInput
                color="module"
                value={amount}
                aria-label="Threshold amount"
                onValueChange={setAmount}
              />
            </div>
          }
        />
      </Field>
      <Field>
        <FieldLabel>For which customer</FieldLabel>
        <FieldControl
          render={
            <Select
              color="module"
              aria-label="Which customer this applies to"
              value={accountId}
              items={accountItems}
              onValueChange={(next) => {
                setAccountId((next as string | null) ?? '');
              }}
            />
          }
        />
      </Field>
    </>
  );
}

function WhoSignsField({
  draft,
  people,
}: {
  draft: RuleDraft;
  people: ReturnType<typeof namableApprovers>;
}) {
  const { approver, setApprover, draftSigner, draftNote } = draft;
  return (
    <Field className="@md:col-span-2">
      <FieldLabel>Who signs it off</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            className="max-w-full"
            value={approver}
            onChange={(event) => {
              setApprover(event.target.value);
            }}
          >
            <ApproverOptions people={people} accountOption={accountApproversOption(draftSigner)} />
          </NativeSelect>
        }
      />
      {draftNote === null ? (
        <FieldDescription>
          {draftSigner.signOffBy === 'account'
            ? 'The customer’s own approvers say yes on your site.'
            : 'Naming one person means only they can approve or turn down an order this rule holds.'}
        </FieldDescription>
      ) : (
        <FieldDescription>{draftNote.text}</FieldDescription>
      )}
    </Field>
  );
}

function AddRuleActions({
  draft,
  setAdding,
}: {
  draft: RuleDraft;
  setAdding: (next: boolean) => void;
}) {
  const { amount, createRule, onCreate } = draft;
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        color="module"
        disabled={amount <= 0}
        loading={createRule.isPending}
        onClick={onCreate}
      >
        Add rule
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setAdding(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
