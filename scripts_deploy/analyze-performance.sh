#!/bin/bash
# Comprehensive performance analysis script
# Analyzes frontend bundle, backend dependencies, and suggests optimizations

set -e

FRONTEND_DIR="/home/admin/Desktop/Fassandra/frontend"
BACKEND_DIR="/home/admin/Desktop/Fassandra/backend"
REPORT_FILE="/tmp/fassandra-performance-report.txt"

echo "🔍 Fassandra Performance Analysis"
echo "=================================="
echo ""

# Clear previous report
> "$REPORT_FILE"

log_section() {
    echo "" | tee -a "$REPORT_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$REPORT_FILE"
    echo "$1" | tee -a "$REPORT_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
}

# 1. Frontend Bundle Analysis
log_section "📦 FRONTEND BUNDLE ANALYSIS"

if [ -d "$FRONTEND_DIR/dist" ]; then
    echo "Bundle sizes:" | tee -a "$REPORT_FILE"
    du -h "$FRONTEND_DIR/dist" --max-depth=2 | sort -hr | head -n 20 | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"

    # Find large JS files
    echo "Largest JavaScript files:" | tee -a "$REPORT_FILE"
    find "$FRONTEND_DIR/dist" -name "*.js" -type f -exec du -h {} + | sort -hr | head -n 10 | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
else
    echo "⚠️  No dist folder found. Run 'npm run build' first." | tee -a "$REPORT_FILE"
fi

# 2. Frontend Dependencies Analysis
log_section "📚 FRONTEND DEPENDENCIES"

cd "$FRONTEND_DIR"

echo "Large dependencies (> 500KB):" | tee -a "$REPORT_FILE"
npx -y vite-bundle-visualizer --sourcemap 2>/dev/null || echo "Install vite-bundle-visualizer for detailed analysis: npm i -D vite-bundle-visualizer" | tee -a "$REPORT_FILE"

# List all dependencies with sizes
echo "" | tee -a "$REPORT_FILE"
echo "Top 20 largest dependencies:" | tee -a "$REPORT_FILE"
du -sh node_modules/* 2>/dev/null | sort -hr | head -n 20 | tee -a "$REPORT_FILE"

# 3. Frontend Code Analysis
log_section "🔍 FRONTEND CODE PATTERNS"

echo "Checking for performance anti-patterns..." | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Check for console.logs in production
console_count=$(grep -r "console\\.log" "$FRONTEND_DIR/src" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l || echo "0")
echo "• Console.log statements: $console_count (should remove for production)" | tee -a "$REPORT_FILE"

# Check for useEffect without dependencies
useeffect_issues=$(grep -r "useEffect.*\[\]" "$FRONTEND_DIR/src" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
echo "• useEffect with empty deps: $useeffect_issues (verify if needed)" | tee -a "$REPORT_FILE"

# Check for inline arrow functions in JSX
inline_functions=$(grep -r "onClick={().*=>" "$FRONTEND_DIR/src" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
echo "• Inline arrow functions in onClick: $inline_functions (consider useCallback)" | tee -a "$REPORT_FILE"

# Check for heavy components
echo "" | tee -a "$REPORT_FILE"
echo "Largest component files (potential refactor candidates):" | tee -a "$REPORT_FILE"
find "$FRONTEND_DIR/src/components" -name "*.tsx" -type f -exec wc -l {} + | sort -rn | head -n 10 | tee -a "$REPORT_FILE"

# 4. Backend Analysis
log_section "⚙️  BACKEND ANALYSIS"

cd "$BACKEND_DIR"

echo "Cargo dependencies:" | tee -a "$REPORT_FILE"
cargo tree --depth 1 | head -n 30 | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo "Binary size:" | tee -a "$REPORT_FILE"
if [ -f "target/release/backend" ]; then
    ls -lh target/release/backend | tee -a "$REPORT_FILE"
else
    echo "⚠️  No release binary found. Run 'cargo build --release' first." | tee -a "$REPORT_FILE"
fi

# 5. Database Query Analysis
log_section "💾 DATABASE QUERIES"

echo "Checking for N+1 query patterns in backend..." | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Look for loops with database queries
loop_queries=$(grep -r "for.*in.*{" "$BACKEND_DIR/src" -A 10 | grep -E "(query|fetch|execute)" | wc -l || echo "0")
echo "• Potential N+1 queries in loops: $loop_queries" | tee -a "$REPORT_FILE"

# Check for missing indexes (look for common WHERE clauses)
echo "• Common WHERE clause fields (ensure indexed):" | tee -a "$REPORT_FILE"
grep -rh "WHERE" "$BACKEND_DIR/src" --include="*.rs" | grep -oE "WHERE [a-z_]+" | sort | uniq -c | sort -rn | head -n 5 | tee -a "$REPORT_FILE"

# 6. Recommendations
log_section "💡 OPTIMIZATION RECOMMENDATIONS"

cat << 'EOF' | tee -a "$REPORT_FILE"
IMMEDIATE ACTIONS:
1. Remove all console.log statements from production code
2. Enable code splitting for large components (React.lazy)
3. Add React.memo to frequently re-rendering components
4. Use useCallback for event handlers in lists
5. Implement virtual scrolling for long lists (react-window)
6. Optimize images (compress, use WebP, lazy load)
7. Add service worker for caching static assets
8. Review and remove unused dependencies

BACKEND OPTIMIZATIONS:
1. Add database connection pooling limits
2. Implement query result caching for static data
3. Add indexes on frequently queried columns
4. Use EXPLAIN ANALYZE for slow queries
5. Consider compressing WebSocket messages (Yjs updates)
6. Review and optimize Yjs compaction frequency

MONITORING:
1. Add Web Vitals tracking (LCP, FID, CLS)
2. Set up Prometheus alerts for high resource usage
3. Monitor WebSocket connection count and message sizes
4. Track database query performance

LONG-TERM:
1. Consider CDN for static assets
2. Implement lazy loading for routes
3. Add server-side rendering for initial load
4. Optimize Docker images (multi-stage builds)
5. Review Yjs document size limits
EOF

log_section "✅ ANALYSIS COMPLETE"

echo "Full report saved to: $REPORT_FILE"
echo ""
echo "To monitor live: ./monitor-live.sh"
echo "To deploy optimizations: ./deploy.prod.sh"
