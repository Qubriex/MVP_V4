#!/usr/bin/env bash
# Renders the audience videos in order; one line per video in the log.
# Usage: bash video/render-all.sh id1 id2 …   (PYTHON = a Python with pocketsphinx)
cd "$(dirname "$0")/.."
for id in "$@"; do
  out=$(node video/make.mjs "$id" 2>&1)
  echo "$out" | grep -E "QA passed|QA failed|✗|Error|quota" | grep -v "^\s*at " | head -8 | sed "s/^/[$id] /"
done
