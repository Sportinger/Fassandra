#!/bin/bash
cd /home/admins/projects/pessoa/frontend
echo "Testing TypeScript compilation for refactored components..."
npx tsc --noEmit src/components/scripts/ScriptList/index.tsx src/components/scripts/ScriptCard/index.tsx src/components/scripts/modals/ShareScriptModal/index.tsx src/components/scripts/modals/DeleteConfirmModal/index.tsx 2>&1 | grep -E "error|Error"
if [ $? -eq 0 ]; then
  echo "Found errors in compilation"
else
  echo "No errors found - components compile successfully!"
fi