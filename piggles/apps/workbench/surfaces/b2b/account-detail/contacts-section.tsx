'use client';

import { useState } from 'react';
import { Button, Heading, Select, Text, useToast } from '@wizeworks/silicaui-react';
import { faUserPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../../components/form-section';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import {
  CustomerPicker,
  customerName,
  type CustomerSummary,
} from '../../invoicing/customer-picker';
import {
  alreadyOnAccount,
  accountErrorMessage,
  useAccountContacts,
  type AccountContact,
  type ContactRole,
} from '../accounts-data';
import { useAddContact, useUpdateContact } from '../accounts/contact-writes';
import { APPROVER_ROLE_MEANING } from '../sign-off-words';
import { ROLE_OPTIONS, ContactRow } from './contact-row';

// "Can approve orders" is explained in the section's description, read with every
// picker in it: the role signs held orders on the site (sparx persona issue 087).
export function ContactsSection({ ctx, accountId }: { ctx: SurfaceContext; accountId: string }) {
  const contactsQuery = useAccountContacts(accountId);
  const updateContact = useUpdateContact(accountId);
  const adder = useContactAdd(accountId);

  const contacts = contactsQuery.data?.items ?? [];
  const active = contacts.filter((contact) => contact.isActive);
  const inactive = contacts.filter((contact) => !contact.isActive);

  return (
    <FormSection
      title="Who can order"
      description={`The people at this business allowed to place orders on its behalf, and what each is allowed to do. ${APPROVER_ROLE_MEANING}`}
    >
      <ContactList
        contactsQuery={contactsQuery}
        active={active}
        inactive={inactive}
        updateContact={updateContact}
      />

      <AddContactForm ctx={ctx} accountId={accountId} contacts={contacts} adder={adder} />
    </FormSection>
  );
}

// Picking someone, their role, and adding them.
function useContactAdd(accountId: string) {
  const toast = useToast();
  const addContact = useAddContact(accountId);

  const [picked, setPicked] = useState<CustomerSummary | null>(null);
  // Bumped after each add, so the picker starts empty again instead of still
  // showing the name just added and offering them a second time (sparx persona
  // issue 086).
  const [pickerRound, setPickerRound] = useState(0);
  const [role, setRole] = useState<ContactRole>('buyer');

  const onAdd = () => {
    if (!picked) return;
    addContact.mutate(
      { customerId: picked.id, role },
      {
        onSuccess: () => {
          setPicked(null);
          setPickerRound((round) => round + 1);
          setRole('buyer');
          toast.add({ title: `${customerName(picked)} added`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add that person',
            description: accountErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };
  return { addContact, picked, setPicked, pickerRound, role, setRole, onAdd };
}

function ContactList({
  contactsQuery,
  active,
  inactive,
  updateContact,
}: {
  contactsQuery: ReturnType<typeof useAccountContacts>;
  active: AccountContact[];
  inactive: AccountContact[];
  updateContact: ReturnType<typeof useUpdateContact>;
}) {
  return contactsQuery.isError ? (
    <Text className="text-sm">Their contacts could not be loaded just now.</Text>
  ) : contactsQuery.isPending ? (
    <Text className="text-sm" role="status">
      Loading contacts…
    </Text>
  ) : active.length === 0 && inactive.length === 0 ? (
    <Text className="text-sm">
      No one is set up to order for this customer yet. Add someone below. They must already be a
      customer of yours.
    </Text>
  ) : (
    <ul className="flex flex-col gap-2">
      {[...active, ...inactive].map((contact) => (
        <ContactRow
          key={contact.id}
          contact={contact}
          busy={updateContact.isPending}
          onRole={(next) => {
            updateContact.mutate({ contactId: contact.id, role: next });
          }}
          onToggleActive={() => {
            updateContact.mutate({ contactId: contact.id, isActive: !contact.isActive });
          }}
        />
      ))}
    </ul>
  );
}

function AddContactForm({
  ctx,
  accountId,
  contacts,
  adder,
}: {
  ctx: SurfaceContext;
  accountId: string;
  contacts: AccountContact[];
  adder: ReturnType<typeof useContactAdd>;
}) {
  const { picked, setPicked, pickerRound } = adder;
  return (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <Heading level={3} className="text-base font-semibold">
        Add someone
      </Heading>
      <div className="flex flex-col gap-3">
        <CustomerPicker
          key={pickerRound}
          value={picked?.id ?? null}
          unavailable={alreadyOnAccount(contacts)}
          onSelect={(customer) => {
            setPicked(customer);
          }}
          onClear={() => {
            setPicked(null);
          }}
          onAddNew={(typed) => {
            // Opened with the name already typed and this business already
            // chosen, so she saves once and comes back to a person who is
            // already a member. Issue 745.
            ctx.open('crm.customer.detail', { id: 'new', name: typed, companyId: accountId });
          }}
        />
        <AddContactRow adder={adder} />
      </div>
    </div>
  );
}

function AddContactRow({ adder }: { adder: ReturnType<typeof useContactAdd> }) {
  const { addContact, picked, role, setRole, onAdd } = adder;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-56">
        <Select
          size="sm"
          color="module"
          aria-label="What this person can do"
          value={role}
          items={ROLE_OPTIONS}
          onValueChange={(next) => {
            setRole((next as ContactRole | null) ?? 'buyer');
          }}
        />
      </div>
      <Button
        size="sm"
        color="module"
        disabled={!picked}
        loading={addContact.isPending}
        onClick={onAdd}
      >
        <Icon glyph={faUserPlus} className="size-4" aria-hidden />
        Add
      </Button>
    </div>
  );
}
