'use client';

// Print templates — what a bill looks like when the customer opens it.
//
// Same shape as the invoices and workflows lists next door, deliberately:
// recessed pane, Toolbar card, table card. Three lists in one module that
// disagree about what a list looks like is worse than any one of the choices.
//
// The column that matters is NOT "Default". A template is only what customers
// actually receive when it is both the chosen one AND published, and those are
// two separate booleans — so the badge is the COMBINED answer and nothing here
// prints either flag on its own. ./template-standing.ts holds the rule.
//
// Unpaged and unsorted by the server: templates are a handful per business by
// construction (a letterhead is a design decision, not a record), the endpoint
// offers no sort, and inventing a client-side one here would claim to have
// sorted a set that the window may not hold. The window controls are still real
// because nothing FORBIDS a hundred.

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Table,
  Text,
} from '@wizeworks/silicaui-react';
import { FileText, Plus } from 'lucide-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import { useSites } from '../sites/data';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { templateErrorMessage, useTemplates } from './template-data';
import { templateStanding } from './template-standing';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** The day something was published, in the form the rest of the app uses for a
 *  date with no time attached to it. */
function publishedOn(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function TemplatesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  // Absent means the business being worked in, which is the house default for
  // every scoped list. 'all' is the deliberate cross-business read.
  const [property, setProperty] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [take, setTake] = useState<number>(25);

  const { data: sites } = useSites();
  const manySites = (sites ?? []).length > 1;

  const needle = search.trim();
  const skip = (page - 1) * pageSize;

  const { data, isPending, isFetching, isError, error, dataUpdatedAt, refetch } = useTemplates({
    q: needle || undefined,
    property: property || undefined,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('invoicing.template.edit', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Print templates controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search templates"
              placeholder="Search templates…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        primaryAction={{
          label: 'New template',
          icon: Plus,
          onClick: (event) => {
            ctx.open('invoicing.template.edit', { id: 'new' }, { target: targetFor(event) });
          },
          title: 'New template: hold Shift to open alongside, Alt for a new window',
        }}
        /* Only where there is more than one business to choose between. On a
           single-business account the filter would offer one option and a
           synonym for it. */
        filters={
          manySites
            ? [
                {
                  label: 'Business',
                  key: 'property',
                  value: property,
                  onValueChange: (next) => {
                    setProperty(next ?? '');
                    resetWindow();
                  },
                  options: [
                    { value: '', label: 'The one I am in' },
                    { value: 'all', label: 'Every business' },
                    ...(sites ?? []).map((site) => ({ value: site.id, label: site.name })),
                  ],
                },
              ]
            : undefined
        }
        views={{
          target: '/invoicing/templates',
          params: { q: needle, property },
          onApply: (next) => {
            setSearch(next.q ?? '');
            setProperty(next.property ?? '');
            resetWindow();
          },
        }}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            icon={<FileText className="size-6" aria-hidden />}
            title="Could not load your templates"
            description={templateErrorMessage(
              error,
              'Something went wrong reaching the server. Your invoices are unaffected and keep printing as they do now.'
            )}
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : isPending ? (
          <PaneWaiting label="Loading templates…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" aria-hidden />}
            title={needle ? 'Nothing matches that' : 'No templates yet'}
            description={
              needle
                ? 'Try a different word.'
                : 'A template is the page your customer sees when they open a bill: what goes on it, and in what order. Everyone starts with one, so this being empty is unusual.'
            }
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Name</th>
                {manySites ? <th className="hidden @xl:table-cell">Business</th> : null}
                <th>Customers get</th>
                <th className="hidden @2xl:table-cell">Published</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((template) => {
                const standing = templateStanding({
                  isDefault: template.isDefault,
                  published: template.published,
                  propertyName: template.propertyName,
                });
                return (
                  <tr
                    key={template.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    title={standing.sentence}
                    onClick={(event) => {
                      open(template.id, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(template.id, event);
                    }}
                  >
                    <td>
                      <span className="flex flex-col gap-1">
                        <span className="font-medium">{template.name}</span>
                        {/* The Business column hides below @xl, so on a narrow
                            pane this is the only place it can be read — and
                            which business a letterhead carries the name of is
                            not something to discover by widening the pane. */}
                        {manySites ? (
                          <Text as="span" className="text-sm @xl:hidden">
                            {template.propertyName ?? 'Every business'}
                          </Text>
                        ) : null}
                      </span>
                    </td>
                    {manySites ? (
                      <td className="hidden @xl:table-cell">
                        {template.propertyName ?? 'Every business'}
                      </td>
                    ) : null}
                    <td>
                      {/* The combined answer, never the two flags. A tone of
                          null is a colorless badge: a draft is the absence of a
                          standing rather than one of its own. */}
                      <Badge
                        {...(standing.tone ? { color: standing.tone } : {})}
                        variant="soft"
                        size="sm"
                      >
                        {standing.label}
                      </Badge>
                    </td>
                    <td className="hidden @2xl:table-cell">{publishedOn(template.publishedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </div>
  );
}
