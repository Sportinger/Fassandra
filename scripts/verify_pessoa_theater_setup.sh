#!/bin/bash

# 🔍 Pessoa.Theater Pre-Deployment Verification
# Check if everything is ready for deployment

echo "🔍 Pessoa.Theater Pre-Deployment Verification"
echo "=============================================="
echo ""

ERRORS=0
WARNINGS=0

# Check local prerequisites
echo "📋 Checking local prerequisites..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Docker is running"
fi

# Check if we can access GitHub Container Registry
if ! docker pull hello-world > /dev/null 2>&1; then
    echo "❌ Cannot access Docker registry"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Docker registry access OK"
fi

# Check if we're in the right directory
if [ ! -f "scripts/build_and_push_pessoa_theater.sh" ]; then
    echo "❌ Not in the correct directory (missing deployment script)"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Deployment script found"
fi

# Check if environment file exists
if [ ! -f "env.pessoa.theater.production" ]; then
    echo "❌ Environment file not found (env.pessoa.theater.production)"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Environment file found"
fi

# Check if docker-compose file exists
if [ ! -f "docker-compose.hetzner-github-actions.yml" ]; then
    echo "❌ Docker compose file not found"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Docker compose file found"
fi

echo ""
echo "🌐 Checking server connectivity..."

# Check SSH access
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes roman@pessoa.theater exit 2>/dev/null; then
    echo "❌ Cannot SSH to roman@pessoa.theater"
    echo "   Make sure you have SSH key access configured"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ SSH access to pessoa.theater OK"
fi

# Check DNS resolution
if ! dig pessoa.theater +short > /dev/null 2>&1; then
    echo "❌ Cannot resolve pessoa.theater DNS"
    ERRORS=$((ERRORS + 1))
else
    PESSOA_IP=$(dig pessoa.theater +short | head -1)
    echo "✅ DNS resolution OK (IP: $PESSOA_IP)"
fi

echo ""
echo "🔐 Checking server configuration..."

# Check if server directory exists
if ssh roman@pessoa.theater "[ -d /opt/pessoa ]" 2>/dev/null; then
    echo "✅ Server directory /opt/pessoa exists"
else
    echo "⚠️  Server directory /opt/pessoa does not exist"
    echo "   Run: ssh roman@pessoa.theater 'sudo mkdir -p /opt/pessoa && sudo chown roman:roman /opt/pessoa'"
    WARNINGS=$((WARNINGS + 1))
fi

# Check if SSL certificates exist
if ssh roman@pessoa.theater "[ -f /etc/letsencrypt/live/pessoa.theater/fullchain.pem ]" 2>/dev/null; then
    echo "✅ SSL certificates found"
else
    echo "⚠️  SSL certificates not found"
    echo "   Run: ssh roman@pessoa.theater 'sudo certbot certonly --standalone -d pessoa.theater'"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🛠️  Checking local build requirements..."

# Check if we can build backend
if [ -f "backend/Dockerfile" ]; then
    echo "✅ Backend Dockerfile found"
else
    echo "❌ Backend Dockerfile not found"
    ERRORS=$((ERRORS + 1))
fi

# Check if we can build frontend
if [ -f "frontend/Dockerfile.https" ]; then
    echo "✅ Frontend Dockerfile.https found"
else
    echo "❌ Frontend Dockerfile.https not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📊 Verification Results:"
echo "======================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 ALL CHECKS PASSED! Ready for deployment."
    echo ""
    echo "🚀 To deploy, run:"
    echo "   ./scripts/build_and_push_pessoa_theater.sh"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "✅ No critical errors found"
    echo "⚠️  $WARNINGS warnings need attention"
    echo ""
    echo "🔄 You can proceed with deployment, but address warnings first:"
    echo "   ./scripts/build_and_push_pessoa_theater.sh"
    echo ""
    exit 0
else
    echo "❌ $ERRORS critical errors found"
    echo "⚠️  $WARNINGS warnings found"
    echo ""
    echo "🔧 Fix the errors above before deploying"
    echo ""
    exit 1
fi 