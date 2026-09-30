'use client';

// Choosing one record out of an address book you cannot see the end of.
//
// Every picker in the console used to load a fixed window of rows and filter it
// in the browser, which quietly turned "nothing matches that" into a statement
// about the first hundred rows (issue 183). Searching belongs on the server, so
// this control never holds a list — it shows what it was handed and reports
// what was typed.

import { Badge, Button, SearchInput, Text } from '@wizeworks/silicaui-react';
import { faPlus, faUser, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

/** A one-letter query matches half the book and is not a search anyone means. */
export const MIN_QUERY = 2;

/**
 * A short state word for a row, e.g. "Wholesale".
 *
 * A picker is where somebody commits to a record, so a fact that CHANGES what
 * happens next belongs on the row rather than one screen away — and it has to
 * survive being picked, which is why the chosen row carries it too.
 */
export interface PickerMark {
  label: string;
  color: string;
}

/** One row, already reduced to the two lines a person reads. */
export interface PickerRow {
  id: string;
  primary: string;
  /** The email, the company, whatever tells two same-named rows apart. */
  secondary: string | null;
  /** Optional. Left out on the rows where nothing about this one is notable. */
  mark?: PickerMark | null;
}

export interface SearchPickerProps {
  /** What is on the record now. Null means nothing is chosen yet. */
  chosen: PickerRow | null;
  /** True while the chosen row is still being read, so the field can say so
   *  instead of looking empty over a record that has one. */
  loadingChosen?: boolean;
  /** Shown in place of the chosen row when it could not be read at all. */
  chosenError?: string | null;
  results: PickerRow[];
  searching: boolean;
  query: string;
  onQuery: (next: string) => void;
  disabled?: boolean;
  /** Names the field for a screen reader, e.g. "Search customers". */
  label: string;
  placeholder: string;
  /** Says which record kind is missing, and what to do about it. Safe to give
   *  advice here only because the search is the whole book, not a window. */
  nothingFound: string;
  /**
   * The way out, when the answer is "make one". Advice that names a screen and
   * cannot open it sends a person off to find it, remember what they typed, and
   * come back to a box they have to fill in again — which is a dead end wearing
   * a helpful sentence (issue 745).
   *
   * Given the text that was typed, so the button can name the thing being made
   * and the screen it opens can arrive with the name already in it. Optional:
   * a picker over records a person genuinely cannot create from here leaves it
   * out and keeps the plain sentence.
   */
  nothingFoundAction?: { label: (typed: string) => string; onAct: (typed: string) => void };
  /** Prompt before the query is long enough to ask with. */
  tooShort: string;
  clearLabel: string;
  onSelect: (id: string) => void;
  onClear: () => void;
}

function Chosen({
  row,
  disabled,
  clearLabel,
  onClear,
}: Pick<SearchPickerProps, 'disabled' | 'clearLabel' | 'onClear'> & { row: PickerRow }) {
  return (
    <div className="border-base-300 bg-base-100 flex items-center gap-2 rounded-md border p-2">
      <Icon glyph={faUser} className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="font-medium">{row.primary}</span>
          {row.mark ? (
            <Badge color={row.mark.color} variant="soft" size="sm">
              {row.mark.label}
            </Badge>
          ) : null}
        </span>
        {row.secondary ? (
          <Text as="span" className="block text-sm">
            {row.secondary}
          </Text>
        ) : null}
      </span>
      <Button
        size="sm"
        shape="square"
        disabled={disabled}
        aria-label={clearLabel}
        onClick={onClear}
      >
        <Icon glyph={faXmark} className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function Results({ rows, onSelect }: { rows: PickerRow[]; onSelect: (id: string) => void }) {
  return (
    <div className="border-base-300 max-h-56 overflow-y-auto rounded-md border p-1">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-2 text-left"
          onClick={() => {
            onSelect(row.id);
          }}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="truncate font-medium">{row.primary}</span>
            {row.mark ? (
              <Badge color={row.mark.color} variant="soft" size="sm">
                {row.mark.label}
              </Badge>
            ) : null}
          </span>
          {row.secondary ? (
            <Text as="span" className="shrink-0 text-sm">
              {row.secondary}
            </Text>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** The line under the box when there is no list to show yet. */
function Hint({
  typed,
  searching,
  tooShort,
  nothingFound,
  nothingFoundAction,
}: Pick<SearchPickerProps, 'searching' | 'tooShort' | 'nothingFound' | 'nothingFoundAction'> & {
  typed: string;
}) {
  if (typed.length < MIN_QUERY) return <Text className="text-sm">{tooShort}</Text>;
  if (searching)
    return (
      <Text className="text-sm" role="status">
        Searching…
      </Text>
    );
  if (!nothingFoundAction) return <Text className="text-sm">{nothingFound}</Text>;
  return (
    <div className="flex flex-col items-start gap-2">
      <Text className="text-sm">{nothingFound}</Text>
      <Button
        size="sm"
        color="module"
        onClick={() => {
          nothingFoundAction.onAct(typed);
        }}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        {nothingFoundAction.label(typed)}
      </Button>
    </div>
  );
}

export function SearchPicker(props: SearchPickerProps) {
  const { chosen, loadingChosen, chosenError, results, query, onQuery, disabled } = props;

  if (chosen)
    return (
      <Chosen
        row={chosen}
        disabled={disabled}
        clearLabel={props.clearLabel}
        onClear={props.onClear}
      />
    );

  if (loadingChosen || chosenError) {
    return (
      <Text className="text-sm" role="status">
        {chosenError ?? 'Loading…'}
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        size="sm"
        color="module"
        disabled={disabled}
        aria-label={props.label}
        placeholder={props.placeholder}
        value={query}
        onValueChange={onQuery}
      />
      {results.length > 0 ? (
        <Results rows={results} onSelect={props.onSelect} />
      ) : (
        <Hint
          typed={query.trim()}
          searching={props.searching}
          tooShort={props.tooShort}
          nothingFound={props.nothingFound}
          {...(props.nothingFoundAction ? { nothingFoundAction: props.nothingFoundAction } : {})}
        />
      )}
    </div>
  );
}
