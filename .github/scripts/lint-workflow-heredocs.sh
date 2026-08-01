#!/usr/bin/env bash
#
# Fails if an UNQUOTED heredoc in a workflow contains a backtick.
#
# In `cmd <<EOF`, bash performs command substitution on the body — including on
# lines that are YAML or shell COMMENTS. A comment that names a field in
# backticks is therefore executed. This is not hypothetical:
#
#   * db-migrate-azure.yml wrote two Kubernetes field names in backticks inside
#     a `kubectl apply -f - <<YAML` body. bash ran `env`, spliced the entire
#     process environment into the manifest, and kubectl failed with
#     "error converting YAML to JSON: could not find expected ':'" pointing at a
#     line nobody wrote. The deploy failed at the migration step.
#   * restore-from-export.yml had the same mistake and PASSED, because its two
#     fragments happened to produce empty output. It restored production data
#     while carrying a live footgun.
#
# The second case is why this is a linter and not a code review note: the
# failure mode is silent until the day the substituted command prints something.
#
# The fix is one of:
#   1. Quote the delimiter — `<<'YAML'` — when the body needs no shell
#      expansion. Preferred: GitHub expressions are substituted before bash, so
#      most of these bodies never needed an unquoted heredoc at all.
#   2. Keep it unquoted (required when the body uses escaped-dollar variables
#      for a container to expand later) and write comments without backticks.
set -uo pipefail

status=0

for file in .github/workflows/*.yml; do
  # awk over the raw file: track whether we are inside an unquoted heredoc and
  # flag backticks in the body. Quoted delimiters (<<'X' or <<"X") are safe and
  # deliberately ignored.
  out=$(awk -v FNAME="$file" '
    # A heredoc opener on a COMMENT line is prose, not a redirection. Without
    # this the linter reports itself: the CI job that runs it describes the bug
    # in a YAML comment containing "<<EOF", which the naive scan below would
    # treat as opening a heredoc and then flag every backtick after it.
    #
    # Only skipped when NOT already inside a heredoc — comment lines in a
    # heredoc BODY are exactly what needs checking, since that is where the
    # executed backticks lived in both real incidents.
    !inhd && /^[ \t]*#/ { next }

    # Opening an unquoted heredoc: <<WORD or <<-WORD, no quotes around WORD.
    !inhd && match($0, /<<-?[A-Za-z_][A-Za-z0-9_]*/) {
      frag = substr($0, RSTART, RLENGTH)
      sub(/^<<-?/, "", frag)
      inhd = 1; delim = frag; startline = NR; next
    }
    inhd {
      stripped = $0
      sub(/^[ \t]+/, "", stripped)
      sub(/[ \t]+$/, "", stripped)
      if (stripped == delim) { inhd = 0; next }
      if (index($0, "`") > 0) {
        printf "%s:%d: backtick inside unquoted heredoc <<%s (opened line %d)\n", FNAME, NR, delim, startline
      }
    }
  ' "$file")

  if [ -n "$out" ]; then
    echo "$out"
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo
  echo "Backticks in an unquoted heredoc are executed by bash." >&2
  echo "Quote the delimiter (<<'EOF') or drop the backticks. See the header of" >&2
  echo "$0 for what this already cost." >&2
else
  echo "OK: no backticks in unquoted workflow heredocs."
fi

exit "$status"
