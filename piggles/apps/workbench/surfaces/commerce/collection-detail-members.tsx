'use client';

// How products get into a group, and which ones did.
//
// The WAY of choosing is fixed at create: hand-picked and automatic are two
// different objects, and switching one for the other after products are in it
// would either throw the picks away or freeze the matches.

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
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { faArrowsRotate } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { CollectionRulesEditor } from './collection-rules';
import { CollectionProductsEditor } from './collection-products';
import type { CollectionDetail, CollectionType } from './collections-data';
import type { Draft } from './collection-draft';

export function CollectionMembers({
  id,
  isNew,
  isRules,
  collection,
  draft,
  set,
  ruleError,
  setRuleError,
  reindexing,
  onReindex,
}: {
  id: string;
  isNew: boolean;
  isRules: boolean;
  collection: CollectionDetail | null;
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  ruleError: string | null;
  setRuleError: (next: string | null) => void;
  reindexing: boolean;
  onReindex: () => void;
}) {
  return (
    <>
      {/* HOW the products get in. Chosen once on create; fixed after. */}
      {isNew ? (
        <FormSection
          title="How products get into it"
          description="This cannot be changed later, so it is worth a moment now."
        >
          <Field>
            <FieldLabel>Way of choosing</FieldLabel>
            <FieldControl
              render={
                <div className="max-w-xs">
                  <Select
                    color="module"
                    aria-label="Way of choosing products"
                    value={draft.type}
                    items={[
                      { value: 'manual', label: 'I pick the products myself' },
                      { value: 'rules', label: 'Rules pick the products for me' },
                    ]}
                    onValueChange={(next) => {
                      set('type', (next as CollectionType) ?? 'manual');
                    }}
                  />
                </div>
              }
            />
            <FieldDescription>
              {isRules
                ? 'You describe what belongs — say, everything under a set price from a certain brand — and matching products are pulled in automatically, and drop out again when they stop matching.'
                : 'You choose each product by hand. Good for a curated set that will not change on its own.'}
            </FieldDescription>
          </Field>
        </FormSection>
      ) : null}

      {isRules ? (
        <FormSection
          title="Which products belong here"
          description="Describe the products this group should contain. Anything matching is added for you."
          action={
            !isNew && collection ? (
              <Button
                size="sm"
                variant="outline"
                loading={reindexing}
                title="Re-check which products match these conditions"
                onClick={onReindex}
              >
                <Icon glyph={faArrowsRotate} className="size-4" aria-hidden />
                Update matches
              </Button>
            ) : undefined
          }
        >
          {ruleError ? (
            <Alert color="warning">
              <AlertContent>
                <AlertTitle>These conditions are not ready yet</AlertTitle>
                <AlertDescription>{ruleError}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {!isNew && collection ? (
            <Text className="text-sm">
              {collection.productCount === 0
                ? 'No products match these conditions yet — or the last check has not run. Membership is worked out in the background after you save.'
                : `${String(collection.productCount)} product${collection.productCount === 1 ? '' : 's'} matched when membership was last worked out. It refreshes in the background after a change.`}
            </Text>
          ) : null}

          <CollectionRulesEditor
            value={draft.ruleSet}
            onChange={(next) => {
              setRuleError(null);
              set('ruleSet', next);
            }}
          />
        </FormSection>
      ) : (
        <FormSection
          title="The products in it"
          description="Pick the products that belong in this group."
        >
          <CollectionProductsEditor
            collectionId={isNew ? null : id}
            value={draft.productIds}
            onChange={(next) => {
              set('productIds', next);
            }}
          />
        </FormSection>
      )}
    </>
  );
}
