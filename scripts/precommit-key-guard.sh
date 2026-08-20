#!/usr/bin/env sh
# Refuses a commit that stages something shaped like an EODHD API key.
#
# The shape is a run of lowercase hex, a dot, then a run of digits. There is deliberately
# no example of one written out below: the first version of this file carried a sample key
# in a comment, and the guard then blocked the repository's own first commit, on itself.
#
# Install once:
#   cp scripts/precommit-key-guard.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# This is a seatbelt, not a lock. It cannot see a key you never staged, and it cannot see
# one already in your history. Keys belong in .env.local, which is gitignored.

# Added lines only. Diff context includes unchanged neighbouring lines, so matching the
# whole diff would fail a commit for a string that is already in the file and that this
# commit does not touch.
#
# The guard's own file is excluded because it has to describe the pattern to match it.
staged=$(git diff --cached --unified=0 -- . ':(exclude)scripts/precommit-key-guard.sh' \
  | grep '^+' | grep -v '^+++')

if printf '%s' "$staged" | grep -Eq '[0-9a-f]{12,}\.[0-9]{6,}'; then
  echo "Refusing to commit: a line you are adding looks like an EODHD API key."
  echo
  echo "Offending line(s):"
  printf '%s' "$staged" | grep -En '[0-9a-f]{12,}\.[0-9]{6,}' | head -5
  echo
  echo "Keys belong in .env.local, which is gitignored. Never in git."
  echo "If this is a false positive, commit with --no-verify and fix the pattern."
  exit 1
fi
