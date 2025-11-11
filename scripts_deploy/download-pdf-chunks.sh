#!/bin/bash

# Download PDF chunks and original file from production
# Usage: ./download-pdf-chunks.sh

set -euo pipefail

SERVER="91.99.69.115"
USER="root"
REMOTE_UPLOADS_DIR="/home/admin/app/backend/uploads"
LOCAL_DIR="./pdf_chunks_comparison"

# Create local directory
mkdir -p "$LOCAL_DIR"

echo "🔍 Connecting to production server..."

# First, find all files related to the PDF
echo "📋 Finding all chunk files and original PDF..."
ssh "$USER@$SERVER" "find $REMOTE_UPLOADS_DIR -type f -name '*cfb1e5ac-6f5a-402a-9ff0-f3e3977933e1*' | sort"

echo ""
echo "📥 Downloading files..."

# Download all files matching the pattern
ssh "$USER@$SERVER" "find $REMOTE_UPLOADS_DIR -type f -name '*cfb1e5ac-6f5a-402a-9ff0-f3e3977933e1*'" | while read remote_file; do
    filename=$(basename "$remote_file")
    echo "  ⬇️  $filename"
    scp "$USER@$SERVER:$remote_file" "$LOCAL_DIR/$filename"
done

echo ""
echo "✅ Download complete!"
echo "📁 Files saved to: $LOCAL_DIR"
echo ""
echo "Contents:"
ls -lh "$LOCAL_DIR"
