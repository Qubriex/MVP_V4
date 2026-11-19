#!/usr/bin/env bash
# Renders the audience videos in order; one line per video in the log.
# Usage: bash video/render-all.sh id1 id2 …   (PYTHON = a Python with pocketsphinx)
cd "$(dirname "$0")/.."
# Forced alignment (word timing, brand splice) needs a Python with pocketsphinx.
: "${PYTHON:=$(ls -d /tmp/claude-0/*/*/scratchpad/venv-ps/bin/python 2>/dev/null | head -1)}"; export PYTHON
[ -x "$PYTHON" ] || { echo "PYTHON with pocketsphinx not found: set PYTHON=..." >&2; exit 1; }
for id in "$@"; do
  out=$(node video/make.mjs "$id" 2>&1)
  echo "$out" | grep -E "QA passed|QA failed|✗|Error|quota" | grep -v "^\s*at " | head -8 | sed "s/^/[$id] /"
done
