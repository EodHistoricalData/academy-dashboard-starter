#!/usr/bin/env sh
# Scans tracked files for anything shaped like an EODHD API key.
#
# The shape — a run of lowercase hex, a dot, a run of digits — is the same one the
# pre-commit hook uses, and it lives in exactly one place on purpose. Two copies of a
# pattern drift, and the copy that drifts is always the one nobody is watching.
#
# WHY THE WHOLE TREE AND NOT THE DIFF. The hook already covers the diff, at the moment
# the line is written. CI runs after the hook can be skipped (`--no-verify` is one flag),
# after a branch was pushed from a machine that never installed it, and after a key was
# committed months ago by someone who did not know. Scanning only the diff here would
# reproduce exactly the blind spot CI exists to cover.
#
# This is a seatbelt, not a lock. A key already public is public; rotate it.

set -eu

matches=$(
  git ls-files -z \
    | grep -zv '^scripts/key-scan\.sh$' \
    | grep -zv '^scripts/precommit-key-guard\.sh$' \
    | xargs -0 grep -EnI '[0-9a-f]{12,}\.[0-9]{6,}' 2>/dev/null || true
)

if [ -n "$matches" ]; then
  echo "Refusing the build: something in the tree looks like an EODHD API key."
  echo
  echo "$matches" | head -10
  echo
  echo "Keys belong in .env.local, which is gitignored. If this key was ever pushed,"
  echo "rotate it now — removing the line does not un-publish it."
  exit 1
fi

echo "Key scan clean: no key-shaped string in any tracked file."
