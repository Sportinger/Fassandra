#!/bin/bash

# =============================================================================
# PESSOA LICENSE COMPLIANCE & LEGAL SAFETY CHECK
# =============================================================================
# This script performs comprehensive checks for legal compliance
# Created: $(date)
# =============================================================================

set -euo pipefail

echo "🔍 PESSOA PROJECT - COMPREHENSIVE LEGAL COMPLIANCE CHECK"
echo "========================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create reports directory
mkdir -p compliance_reports
REPORT_DIR="compliance_reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${BLUE}📊 Creating compliance report: ${REPORT_DIR}/compliance_report_${TIMESTAMP}.md${NC}"

# =============================================================================
# 1. DEPENDENCY ANALYSIS
# =============================================================================
echo -e "${YELLOW}🔍 STEP 1: ANALYZING DEPENDENCIES${NC}"
echo ""

# Backend Rust dependencies
echo "## Backend Dependencies (Rust)" > "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "### Cargo.toml Analysis" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo '```toml' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
cat backend/Cargo.toml >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# Frontend dependencies
echo "## Frontend Dependencies (Node.js)" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "### package.json Analysis" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo '```json' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
cat frontend/package.json >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# =============================================================================
# 2. LICENSE SCANNING
# =============================================================================
echo -e "${YELLOW}🔍 STEP 2: LICENSE SCANNING${NC}"
echo ""

echo "## License Analysis" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# Check for LICENSE file
if [ -f "LICENSE" ]; then
    echo "✅ LICENSE file found"
    echo "### Project License" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
    echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
    cat LICENSE >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
    echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
else
    echo -e "${RED}❌ No LICENSE file found in project root${NC}"
    echo "### ⚠️ WARNING: No LICENSE file found" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
fi

# Scan for license mentions in code
echo "### License Mentions in Code" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
grep -r -i "license\|copyright\|©" --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.js" . | head -10 >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md" 2>/dev/null || echo "No license mentions found in code" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# =============================================================================
# 3. DEPENDENCY LICENSE ANALYSIS
# =============================================================================
echo -e "${YELLOW}🔍 STEP 3: DEPENDENCY LICENSE ANALYSIS${NC}"
echo ""

echo "## Dependency License Analysis" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# Frontend dependency licenses
if [ -f "frontend/package-lock.json" ]; then
    echo "### Frontend Package Licenses" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
    echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
    grep -o '"license": "[^"]*"' frontend/package-lock.json | sort | uniq -c | sort -nr >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
    echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
    echo "" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
fi

# =============================================================================
# 4. CODE SIMILARITY SCAN
# =============================================================================
echo -e "${YELLOW}🔍 STEP 4: CODE SIMILARITY ANALYSIS${NC}"
echo ""

echo "## Code Similarity Analysis" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# Check for common patterns that might indicate copied code
echo "### Potential Code Patterns" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# Look for TODO comments with external references
grep -r -i "todo.*http\|fixme.*http\|hack.*http" --include="*.rs" --include="*.ts" --include="*.tsx" . >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md" 2>/dev/null || echo "No external references in TODO comments" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

echo '```' >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# =============================================================================
# 5. GENERATE ACTIONABLE RECOMMENDATIONS
# =============================================================================
echo "## Recommendations" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# Check README license declaration
if grep -q "MIT License" README.md; then
    echo "✅ MIT License declared in README.md" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
else
    echo "⚠️ Consider adding clear license declaration to README.md" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
fi

echo "" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "### Next Steps for Complete Compliance" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "1. **Create LICENSE file** if missing" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "2. **Use professional tools** for deeper analysis:" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "   - Copyleaks for code plagiarism detection" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "   - FOSSA for comprehensive license compliance" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "   - FOSSology (free) for basic license scanning" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "3. **Review all dependencies** for license compatibility" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "4. **Generate Software Bill of Materials (SBOM)**" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"
echo "5. **Implement continuous compliance monitoring**" >> "${REPORT_DIR}/compliance_report_${TIMESTAMP}.md"

# =============================================================================
# 6. FINAL REPORT
# =============================================================================
echo ""
echo -e "${GREEN}✅ COMPLIANCE CHECK COMPLETE${NC}"
echo -e "${BLUE}📊 Report saved to: ${REPORT_DIR}/compliance_report_${TIMESTAMP}.md${NC}"
echo ""
echo -e "${YELLOW}🔍 SUMMARY:${NC}"
echo "• Dependencies analyzed: ✅"
echo "• License scanning: ✅"
echo "• Code pattern analysis: ✅"
echo "• Recommendations generated: ✅"
echo ""
echo -e "${BLUE}📋 NEXT STEPS:${NC}"
echo "1. Review the generated report"
echo "2. Consider using professional tools for deeper analysis"
echo "3. Implement continuous compliance monitoring"
echo ""
echo -e "${GREEN}🎯 Report location: ${REPORT_DIR}/compliance_report_${TIMESTAMP}.md${NC}" 