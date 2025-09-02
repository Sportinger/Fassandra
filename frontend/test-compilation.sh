#!/bin/bash
# Resolve to the frontend directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
echo "Testing TypeScript compilation for refactored components..."
npx tsc --noEmit src/components/scripts/ScriptList/index.tsx src/components/scripts/ScriptCard/index.tsx src/components/scripts/modals/ShareScriptModal/index.tsx src/components/scripts/modals/DeleteConfirmModal/index.tsx 2>&1 | grep -E "error|Error"
if [ $? -eq 0 ]; then
  echo "Found errors in compilation"
else
  echo "No errors found - components compile successfully!"
fi
