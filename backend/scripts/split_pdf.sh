#!/bin/bash
# Split a PDF into N-page chunks (default 5 pages per chunk)
# Requires: poppler-utils (pdfinfo, pdfseparate, pdfunite)
#
# Usage:
#   split_pdf.sh <input.pdf> <output_dir> [chunk_size]
#
# Example:
#   split_pdf.sh /app/uploads/scripts/script.pdf /tmp/chunks 5

set -euo pipefail

usage() {
  echo "Usage: $0 <input.pdf> <output_dir> [chunk_size=5]" >&2
  exit 2
}

require_cmd() {
  local c="$1"
  if ! command -v "$c" >/dev/null 2>&1; then
    echo "Error: required command not found: $c" >&2
    exit 1
  fi
}

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  usage
fi

INPUT="$1"
OUTDIR="$2"
CHUNK_SIZE="${3:-5}"

if [ ! -f "$INPUT" ]; then
  echo "Error: input file not found: $INPUT" >&2
  exit 1
fi

case "$INPUT" in
  *.pdf|*.PDF) ;;
  *) echo "Error: input must be a PDF: $INPUT" >&2; exit 1;;
esac

if ! [[ "$CHUNK_SIZE" =~ ^[0-9]+$ ]] || [ "$CHUNK_SIZE" -le 0 ]; then
  echo "Error: chunk_size must be a positive integer (got: $CHUNK_SIZE)" >&2
  exit 1
fi

require_cmd pdfinfo
require_cmd pdfseparate
require_cmd pdfunite

mkdir -p "$OUTDIR"

# Determine total pages
PAGES=$(pdfinfo "$INPUT" 2>/dev/null | awk '/^Pages:/ {print $2}') || true
if ! [[ "$PAGES" =~ ^[0-9]+$ ]] || [ -z "$PAGES" ]; then
  echo "Error: could not determine page count for: $INPUT" >&2
  exit 1
fi
if [ "$PAGES" -eq 0 ]; then
  echo "Error: PDF reports zero pages: $INPUT" >&2
  exit 1
fi

BASENAME=$(basename -- "$INPUT")
BASENAME_NOEXT="${BASENAME%.pdf}"

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "[PROGRESS] Splitting $INPUT into single pages... ($PAGES pages)"
pdfseparate "$INPUT" "$TMPDIR/page_%06d.pdf"

echo "[PROGRESS] Grouping into chunks of $CHUNK_SIZE pages..."
chunk=1
start=1
while [ "$start" -le "$PAGES" ]; do
  end=$(( start + CHUNK_SIZE - 1 ))
  if [ "$end" -gt "$PAGES" ]; then end="$PAGES"; fi

  files=()
  i="$start"
  while [ "$i" -le "$end" ]; do
    files+=("$TMPDIR/page_$(printf '%06d' "$i").pdf")
    i=$(( i + 1 ))
  done

  out="$OUTDIR/${BASENAME_NOEXT}_chunk_$(printf '%03d' "$chunk").pdf"

  if [ "${#files[@]}" -eq 1 ]; then
    # Single page chunk: just copy
    cp -f "${files[0]}" "$out"
  else
    pdfunite "${files[@]}" "$out"
  fi

  echo "[CHUNK] Created: $out (pages $start-$end)"
  chunk=$(( chunk + 1 ))
  start=$(( end + 1 ))
done

echo "[DONE] Created $((chunk-1)) chunk PDF(s) in $OUTDIR"

