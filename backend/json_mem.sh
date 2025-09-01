#!/bin/bash
# Safe JSON memory file helper for chunked script import
#
# Usage:
#   json_mem.sh init [MEM_FILE]
#   json_mem.sh add <CHUNK_JSON> [MEM_FILE]
#
# Defaults:
#   MEM_FILE defaults to /tmp/script_data.json
#
# Behavior:
#   - Uses jq to validate and append JSON safely
#   - Accepts existing memory as [] or {"chunks": [...]}; normalizes to wrapper
#   - Performs atomic writes via temporary file and rename

set -euo pipefail

MEM_DEFAULT="/tmp/script_data.json"

usage() {
  echo "Usage: $0 init [MEM_FILE]" >&2
  echo "       $0 add <CHUNK_JSON> [MEM_FILE]" >&2
  exit 2
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not installed" >&2
    exit 1
  fi
}

cmd_init() {
  local mem=${1:-$MEM_DEFAULT}
  require_jq
  local tmp="${mem}.tmp"
  # Initialize with wrapper form
  printf '{"chunks": []}\n' >"$tmp"
  # Validate and atomically replace
  jq -e . "$tmp" >/dev/null
  mv -f "$tmp" "$mem"
  echo "[PROGRESS] Initialized memory file at $mem"
}

cmd_add() {
  local chunk=${1:-}
  local mem=${2:-$MEM_DEFAULT}
  if [ -z "${chunk}" ]; then
    echo "Error: missing CHUNK_JSON" >&2
    usage
  fi
  if [ ! -f "$chunk" ]; then
    echo "Error: chunk file not found: $chunk" >&2
    exit 1
  fi
  require_jq

  # Validate chunk JSON
  jq -e . "$chunk" >/dev/null || {
    echo "Error: invalid JSON in chunk: $chunk" >&2
    exit 1
  }

  # Ensure mem exists (wrapper form)
  if [ ! -f "$mem" ]; then
    printf '{"chunks": []}\n' >"${mem}"
  fi

  # Validate existing mem JSON
  jq -e . "$mem" >/dev/null || {
    echo "Error: memory file is invalid JSON: $mem" >&2
    exit 1
  }

  # Normalize and append using jq -s (slurp both files)
  local tmp="${mem}.tmp"
  jq -s '
    def norm(m):
      if (m|type)=="array" then {"chunks": m}
      elif (m|type)=="object" and ((m.chunks // null)|type)=="array" then m
      else {"chunks": []} end;
    (norm(.[0])) as $mem |
    (.[1]) as $chunk |
    {chunks: ($mem.chunks + [$chunk])}
  ' "$mem" "$chunk" > "$tmp"

  # Validate and atomically replace
  jq -e . "$tmp" >/dev/null
  mv -f "$tmp" "$mem"
  echo "[PROGRESS] Appended chunk $(basename "$chunk") to $mem"
}

main() {
  local cmd=${1:-}
  shift || true
  case "$cmd" in
    init) cmd_init "$@" ;;
    add)  cmd_add  "$@" ;;
    *) usage ;;
  esac
}

main "$@"
