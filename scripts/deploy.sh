#!/bin/bash
set -e

# 🚀 Universal Deployment Script for Pessoa
# Local build + push workflow (no GitHub Actions)

DEPLOYMENT_TYPE=${1:-"help"}

show_help() {
    echo "🚀 Pessoa Local Deployment Script"
    echo ""
    echo "Usage: ./scripts/deploy.sh [OPTION]"
    echo ""
    echo "Options:"
    echo "  build-and-push   🏗️  Build locally + push + deploy (complete workflow)"
    echo "  push-current     📦 Push already-built images + deploy (no rebuild)"
    echo "  status          📊 Show current deployment status"
    echo "  help            ❓ Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/deploy.sh build-and-push    # Full build + deploy workflow"
    echo "  ./scripts/deploy.sh push-current      # Deploy already-built images"
    echo "  ./scripts/deploy.sh status            # Check current status"
    echo ""
    echo "💡 Local workflow benefits:"
    echo "  ✅ No GitHub Actions concurrency issues"
    echo "  ✅ Full control over build process"
    echo "  ✅ Faster builds (local hardware)"
    echo "  ✅ No CI/CD minutes consumed"
    echo ""
}

case $DEPLOYMENT_TYPE in
    "build-and-push")
        echo "🏗️  Starting complete build + push + deploy workflow..."
        ./scripts/build_and_push.sh
        ;;
    
    "push-current")
        echo "📦 Pushing already-built images + deploy..."
        ./scripts/push_current_build.sh
        ;;
    
    "status")
        echo "📊 Checking deployment status..."
        echo ""
        
        echo "🏠 Local repository:"
        echo "  Branch: $(git rev-parse --abbrev-ref HEAD)"
        echo "  Commit: $(git rev-parse --short HEAD)"
        echo "  Status: $(git status --porcelain | wc -l) uncommitted changes"
        echo ""
        
        echo "🐳 Local Docker images:"
        echo "Backend images:"
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep "pessoa-backend" | head -5 || echo "  No backend images found"
        echo ""
        echo "Frontend images:"
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep "pessoa-frontend" | head -5 || echo "  No frontend images found"
        echo ""
        
        echo "🌐 Production server status:"
        ssh roman@mylayer.org << 'EOF'
            cd /opt/pessoa
            echo "  IMAGE_TAG: $(grep '^IMAGE_TAG=' .env | cut -d'=' -f2)"
            echo "  Container Status:"
            docker compose -f docker-compose.hetzner-github-actions.yml ps --format "table {{.Service}}\t{{.State}}\t{{.Status}}"
EOF
        echo ""
        echo "🔗 Live Sites:"
        echo "  Production: https://mylayer.org:8443"
        echo "  Test: https://pessoa.com.de:8443"
        echo ""
        ;;
    
    "help"|*)
        show_help
        ;;
esac 